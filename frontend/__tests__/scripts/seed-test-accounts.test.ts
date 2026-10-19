// @vitest-environment node
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  seedTestAccounts,
  verifyTestAccounts,
} from "../../scripts/seed-test-accounts";

const emails = ["director@utsbi.org", "client@utsbi.org", "member@utsbi.org"];
const profiles = emails.map((email, i) => ({
  id: i + 1,
  email,
  role: ["director", "client", "member"][i],
}));

function fixture(existing = true) {
  const users = emails.map((email, i) => ({ email, id: `uid-${i}` }));
  const admin = {
    listUsers: vi.fn().mockResolvedValue({
      data: { users: existing ? users : [] },
      error: null,
    }),
    updateUserById: vi.fn().mockImplementation(async (id: string) => ({
      data: { user: { id } },
      error: null,
    })),
    createUser: vi
      .fn()
      .mockImplementation(async ({ email }: { email: string }) => ({
        data: { user: { id: `uid-${emails.indexOf(email)}` } },
        error: null,
      })),
    deleteUser: vi.fn(),
  };
  let projectExists = existing;
  let membershipsExist = false;
  const writes: Array<{ table: string; payload: unknown }> = [];
  const from = vi.fn((table: string) => {
    let filter: unknown;
    let payload: Record<string, unknown> | undefined;
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn((_column: string, value: unknown) => {
        filter = value;
        return chain;
      }),
      insert: vi.fn((value: Record<string, unknown>) => {
        payload = value;
        writes.push({ table, payload });
        return chain;
      }),
      maybeSingle: vi.fn(async () => ({
        data: existing
          ? profiles[Number(String(filter).replace("uid-", ""))]
          : null,
        error: null,
      })),
      single: vi.fn(async () => {
        if (table === "projects") projectExists = true;
        return {
          data:
            table === "profiles"
              ? profiles[Number(String(payload?.uid).replace("uid-", ""))]
              : { id: 42, url_slug: payload?.url_slug },
          error: null,
        };
      }),
      limit: vi.fn(async () => ({
        data: (table === "projects" ? projectExists : membershipsExist)
          ? [{ id: 42 }]
          : [],
        error: null,
      })),
      in: vi.fn(async () => ({ data: profiles, error: null })),
      delete: vi.fn(() => {
        throw new Error("Deletion must never be called");
      }),
    };
    return chain;
  });
  const signInClient = {
    auth: {
      signInWithPassword: vi
        .fn()
        .mockImplementation(async ({ email }: { email: string }) => ({
          data: { user: { id: `uid-${emails.indexOf(email)}` } },
          error: null,
        })),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  };
  return {
    supabase: { auth: { admin }, from } as unknown as SupabaseClient,
    signInClient: signInClient as unknown as SupabaseClient,
    admin,
    from,
    writes,
    signIn: signInClient.auth.signInWithPassword,
    signOut: signInClient.auth.signOut,
    setProjectExists: (value: boolean) => {
      projectExists = value;
    },
    setMembershipsExist: (value: boolean) => {
      membershipsExist = value;
    },
  };
}

describe("test-account seeding", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("resets existing passwords without deleting data or duplicating projects", async () => {
    const f = fixture();
    await seedTestAccounts(f.supabase, "test-password");
    await seedTestAccounts(f.supabase, "test-password");
    expect(f.admin.updateUserById).toHaveBeenCalledTimes(6);
    expect(f.admin.updateUserById).toHaveBeenCalledWith("uid-0", {
      password: "test-password",
      email_confirm: true,
    });
    expect(f.admin.createUser).not.toHaveBeenCalled();
    expect(f.admin.deleteUser).not.toHaveBeenCalled();
    expect(f.writes).toEqual([]);
  });

  it("creates missing accounts, profiles, and a client project", async () => {
    const f = fixture(false);
    await seedTestAccounts(f.supabase, "test-password");
    expect(f.admin.createUser).toHaveBeenCalledTimes(3);
    expect(f.admin.updateUserById).not.toHaveBeenCalled();
    expect(f.writes.filter((w) => w.table === "profiles")).toHaveLength(3);
    expect(f.writes.filter((w) => w.table === "projects")).toHaveLength(1);
  });

  it("preserves a client's existing project membership even without an owned project", async () => {
    const f = fixture();
    f.setProjectExists(false);
    f.setMembershipsExist(true);
    await seedTestAccounts(f.supabase, "test-password");
    expect(f.writes).toEqual([]);
  });

  it("finds existing users beyond the first page", async () => {
    const f = fixture();
    f.admin.listUsers.mockResolvedValueOnce({
      data: {
        users: Array.from({ length: 100 }, (_, i) => ({
          email: `other-${i}@example.com`,
          id: `other-${i}`,
        })),
      },
      error: null,
    });
    await seedTestAccounts(f.supabase, "test-password");
    expect(f.admin.listUsers).toHaveBeenCalledWith({ page: 2, perPage: 100 });
    expect(f.admin.updateUserById).toHaveBeenCalledTimes(3);
    expect(f.admin.createUser).not.toHaveBeenCalled();
  });

  it("stops on list-user errors instead of attempting duplicate accounts", async () => {
    const f = fixture();
    f.admin.listUsers.mockResolvedValueOnce({
      data: null,
      error: { message: "Permission denied" },
    });
    await expect(seedTestAccounts(f.supabase, "test-password")).rejects.toThrow(
      "Cannot list auth users",
    );
    expect(f.admin.createUser).not.toHaveBeenCalled();
    expect(f.admin.updateUserById).not.toHaveBeenCalled();
  });

  it("rejects a missing password before making any requests", async () => {
    const f = fixture();
    await expect(seedTestAccounts(f.supabase, "")).rejects.toThrow(
      "SEED_TEST_PASSWORD",
    );
    expect(f.admin.listUsers).not.toHaveBeenCalled();
  });

  it("propagates password reset errors", async () => {
    const f = fixture();
    f.admin.updateUserById.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "Password too weak" },
    });
    await expect(seedTestAccounts(f.supabase, "test-password")).rejects.toThrow(
      "Password too weak",
    );
    expect(f.from).not.toHaveBeenCalled();
  });

  it("returns success only when all profiles and sign-ins pass", async () => {
    const f = fixture();
    expect(
      await verifyTestAccounts(f.supabase, f.signInClient, "test-password"),
    ).toBe(true);
    expect(f.signIn).toHaveBeenCalledTimes(3);
    expect(f.signOut).toHaveBeenCalledTimes(3);
  });

  it("fails verification when one sign-in fails, but checks all accounts", async () => {
    const f = fixture();
    f.signIn.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "Invalid login credentials" },
    });
    expect(
      await verifyTestAccounts(f.supabase, f.signInClient, "test-password"),
    ).toBe(false);
    expect(f.signIn).toHaveBeenCalledTimes(3);
  });

  it("fails verification when one profile is missing", async () => {
    const f = fixture();
    const chain = f.from("profiles");
    chain.in.mockResolvedValueOnce({ data: profiles.slice(1), error: null });
    f.from.mockReturnValueOnce(chain);
    expect(
      await verifyTestAccounts(f.supabase, f.signInClient, "test-password"),
    ).toBe(false);
  });
});
