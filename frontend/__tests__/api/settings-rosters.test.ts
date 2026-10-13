import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  projects: [] as Record<string, unknown>[],
  profiles: [] as Record<string, unknown>[],
  memberships: [] as Record<string, unknown>[],
  mutations: [] as string[],
  authenticated: true,
}));

vi.mock("@/lib/auth/guards", () => ({
  requireDirector: async () =>
    state.authenticated
      ? { ok: true, profileId: 1, role: "director" }
      : { ok: false, error: "Not authenticated" },
}));
vi.mock("@/lib/email/send", () => ({
  getPortalOrigin: () => "https://test.invalid",
  sendAccountInvite: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      let rows =
        table === "profiles"
          ? [...state.profiles]
          : table === "projects"
            ? [...state.projects]
            : [...state.memberships];
      const value = (row: Record<string, unknown>, column: string) =>
        column === "config->>workspace_type"
          ? (row.config as { workspace_type?: string })?.workspace_type
          : row[column];
      const chain = {
        select() {
          return chain;
        },
        eq(column: string, v: unknown) {
          rows = rows.filter((r) => value(r, column) === v);
          return chain;
        },
        neq(column: string, v: unknown) {
          rows = rows.filter((r) => value(r, column) !== v);
          return chain;
        },
        is(column: string, v: unknown) {
          rows = rows.filter((r) => value(r, column) === v);
          return chain;
        },
        in(column: string, v: unknown[]) {
          rows = rows.filter((r) => v.includes(value(r, column)));
          return chain;
        },
        not(column: string, op: string, v: unknown) {
          rows = rows.filter((r) =>
            op === "is"
              ? value(r, column) !== v
              : !(v as string)
                  .slice(1, -1)
                  .split(",")
                  .includes(String(value(r, column))),
          );
          return chain;
        },
        order() {
          return chain;
        },
        maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
        single: async () => ({ data: rows[0] ?? null, error: null }),
        insert: async () => {
          state.mutations.push(`insert:${table}`);
          return { error: null };
        },
        delete() {
          state.mutations.push(`delete:${table}`);
          return chain;
        },
        // biome-ignore lint/suspicious/noThenProperty: awaitable Supabase query mock
        then(resolve: (result: { data: unknown[]; error: null }) => unknown) {
          const data =
            table === "project_members"
              ? rows.map((r) => ({
                  ...r,
                  profiles:
                    state.profiles.find((p) => p.id === r.profile_id) ?? null,
                  assigner: null,
                  created_at: null,
                }))
              : rows;
          return Promise.resolve({ data, error: null }).then(resolve);
        },
      };
      return chain;
    },
  }),
}));

const {
  listAccounts,
  listMemberProfiles,
  listProjectMembers,
  listUnassignedMembers,
  assignMemberToProject,
  assignOwnerToProject,
  removeMemberFromProject,
  archiveProject,
} = await import("@/app/dashboard/settings/actions");

const p = (
  id: number,
  role: string,
  uid: string | null = null,
  activated: string | null = null,
) => ({
  id,
  name: `Person ${id}`,
  role,
  uid,
  portal_activated_at: activated,
  email: null,
  contact_email: null,
});

beforeEach(() => {
  state.authenticated = true;
  state.projects = [
    {
      id: 6,
      company_name: "SBI",
      config: { workspace_type: "sbi" },
      is_default: true,
      archived_at: null,
    },
    {
      id: 7,
      company_name: "Client Project",
      config: {},
      is_default: false,
      archived_at: null,
    },
  ];
  state.profiles = [
    p(1, "director", "director", "active"),
    p(2, "member"),
    p(3, "member", "pending"),
    p(4, "member", "active", "active"),
    p(5, "client", "client", "active"),
    p(8, "president", "president", "active"),
  ];
  state.memberships = [
    { id: 100, profile_id: 5, project_id: 7, role: "owner" },
    { id: 101, profile_id: 2, project_id: 6, role: "member" },
  ];
  state.mutations = [];
});

describe("settings rosters", () => {
  it("Accounts includes everyone with a login, including pending members", async () => {
    const result = await listAccounts();
    expect(result.accounts?.map((p) => p.id)).toEqual([1, 3, 4, 5, 8]);
  });
  it("Member profiles includes only members without a login", async () => {
    expect((await listMemberProfiles()).members?.map((p) => p.id)).toEqual([2]);
  });
  it("SBI returns all non-clients, including staff missing membership rows", async () => {
    const result = await listProjectMembers(6);
    expect(result.members.map((p) => p.profile_id)).toEqual([1, 2, 3, 4, 8]);
    expect(result.members.every((p) => !p.canRemove)).toBe(true);
  });
  it("client projects return the owner first with the account role", async () => {
    const result = await listProjectMembers(7);
    expect(result.members[0]).toMatchObject({
      profile_id: 5,
      isOwner: true,
      role: "client",
    });
    expect(result.members.some((p) => p.profile_id === 2)).toBe(false);
  });
  it("SBI has no available members to add manually", async () => {
    expect(await listUnassignedMembers(6)).toEqual({ members: [] });
  });
  it("available client-project members excludes clients and those already assigned", async () => {
    state.memberships.push({
      id: 102,
      profile_id: 2,
      project_id: 7,
      role: "member",
    });
    expect((await listUnassignedMembers(7)).members?.map((p) => p.id)).toEqual([
      3, 4,
    ]);
  });
  it("blocks manual SBI assignment and removal without mutating", async () => {
    expect((await assignMemberToProject(2, 6)).error).toMatch(/automatic/i);
    expect((await removeMemberFromProject(101)).error).toMatch(/automatic/i);
    expect(state.mutations).toEqual([]);
  });
  it("blocks client ownership of SBI and SBI archiving", async () => {
    expect((await assignOwnerToProject(5, 6)).error).toMatch(/clients/i);
    expect((await archiveProject(6)).error).toMatch(/cannot be archived/i);
    expect(state.mutations).toEqual([]);
  });
  it("rejects adding a client through the staff picker", async () => {
    expect((await assignMemberToProject(5, 7)).error).toMatch(
      /only member profiles/i,
    );
    expect(state.mutations).toEqual([]);
  });
  it("protects client-project ownership from removal", async () => {
    expect((await removeMemberFromProject(100)).error).toMatch(/owners/i);
    expect(state.mutations).toEqual([]);
  });
  it("preserves normal member assignment to client projects", async () => {
    expect(await assignMemberToProject(2, 7)).toEqual({ success: true });
    expect(state.mutations).toEqual(["insert:project_members"]);
  });
  it("does not expose rosters to an unauthenticated caller", async () => {
    state.authenticated = false;
    expect((await listProjectMembers(6)).error).toBe("Not authenticated");
  });
});
