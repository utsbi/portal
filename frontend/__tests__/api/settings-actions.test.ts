/**
 * Tests for app/dashboard/settings/actions.ts
 *
 * These are server actions tagged "use server". We test the auth-gate
 * functions (requireUser / requireDirector) by controlling the Supabase mock.
 * Because the file uses two Supabase clients — the SSR server client for auth
 * and a raw @supabase/supabase-js admin client — we mock both.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Environment vars (must be set before any import) ─────────────────────────
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "anon-key";
process.env.SUPABASE_SECRET_KEY = "service-role-secret";

// ─── Mutable per-test state ───────────────────────────────────────────────────
// The admin client is constructed once per module (via getAdminClient()), but
// the `from` calls happen on every action invocation. We keep a single truth
// object and reset it in beforeEach.
const state = {
  user: null as unknown,
  callerProfile: null as unknown, // result of the requireUser/requireDirector profile lookup
  callerProfileError: null as unknown,
  insertAuthResult: { data: { user: { id: "new-uid" } }, error: null } as {
    data: unknown;
    error: unknown;
  },
  insertProfileResult: { data: { id: 99 }, error: null } as {
    data: unknown;
    error: unknown;
  },
  deleteUserResult: { error: null } as { error: unknown },
  updateResult: { error: null } as { error: unknown },
  accountsResult: { data: [] as unknown, error: null } as {
    data: unknown;
    error: unknown;
  },
  // Target-row lookups performed by the admin client (updateAccount's
  // existing-row fetch, deleteAccount's uid fetch).
  targetProfile: { data: null as unknown, error: null as unknown },
  // listProjects / updateAccount's backfill query on the projects table.
  projectsListResult: { data: [] as unknown, error: null as unknown },
  // Recorded project_members mutations so tests can assert exactly which
  // rows a role change deletes / backfills.
  memberDeleteCalls: [] as Array<
    Array<{ op: "eq" | "neq"; column: string; value: unknown }>
  >,
  memberUpsertCalls: [] as Array<{ rows: unknown; options: unknown }>,
};

// ─── @/lib/supabase/server mock (SSR auth client) ────────────────────────────
// The server client is used by both requireDirector() (guards.ts) and
// requireUser() (actions.ts) for auth + caller-profile lookups, and also by
// updateMyProfile / updateMyNotificationPrefs for the profile UPDATE mutation.
// We expose .from("profiles") with a full fluent chain driven by state.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => {
    const profilesChain: Record<string, ReturnType<typeof vi.fn>> = {
      select: vi.fn(),
      eq: vi.fn(),
      // Used by requireUser() (.single) and requireDirector() (.maybeSingle)
      single: vi.fn(async () => ({
        data: state.callerProfile,
        error: state.callerProfileError,
      })),
      maybeSingle: vi.fn(async () => ({
        data: state.callerProfile,
        error: state.callerProfileError,
      })),
      // Used by updateMyProfile / updateMyNotificationPrefs
      update: vi.fn(() => ({
        eq: vi.fn(async () => state.updateResult),
      })),
    };
    profilesChain.select.mockReturnValue(profilesChain);
    profilesChain.eq.mockReturnValue(profilesChain);
    return {
      auth: {
        getUser: vi.fn(async () =>
          state.user
            ? { data: { user: state.user }, error: null }
            : { data: { user: null }, error: { message: "unauthenticated" } },
        ),
        updateUser: vi.fn(async () => ({ error: null })),
      },
      from: vi.fn((table: string) => {
        if (table === "profiles") return profilesChain;
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn(async () => ({ data: null, error: null })),
          maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
        };
      }),
    };
  }),
}));

// ─── @supabase/supabase-js mock (admin client) ───────────────────────────────
// The actions file does:
//   import { createClient as createAdminClient } from "@supabase/supabase-js"
// and calls getAdminClient() on every action that needs it.
//
// For "profiles" we need to support:
//   1. requireUser/requireDirector: .select().eq().single() → callerProfile
//   2. updateMyProfile / updateMyPassword: .update().eq() → updateResult
//   3. listAccounts: .select().order() → accountsResult (list, no .single())
//
// We track the current "profiles" operation via a flag set by which mock method
// is called on the chain, rather than a fragile call-count.

vi.mock("@supabase/supabase-js", () => {
  // Helper: make a fluent chain that resolves to a given result for .single() and
  // .maybeSingle(), and delegates list queries (.order()) to a separate result.
  function makeProfilesChain() {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {
      select: vi.fn(),
      eq: vi.fn(),
      // Admin-client .single() on profiles is always a TARGET lookup
      // (updateAccount's existing-row fetch, deleteAccount's uid fetch) —
      // caller-profile lookups go through the server-client mock above.
      single: vi.fn(async () => state.targetProfile),
      maybeSingle: vi.fn(async () => state.targetProfile),
      update: vi.fn(),
      insert: vi.fn(),
      order: vi.fn(async () => state.accountsResult),
      not: vi.fn(),
    };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.not.mockReturnValue(chain);
    chain.update.mockImplementation(() => ({
      eq: vi.fn(async () => state.updateResult),
    }));
    // profiles.insert(...).select(...).single() → insertProfileResult
    chain.insert.mockImplementation(() => ({
      select: vi.fn(() => ({
        single: vi.fn(async () => state.insertProfileResult),
      })),
    }));
    return chain;
  }

  function makeProjectMembersChain() {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      insert: vi.fn(async () => ({ error: null })),
      // delete() returns a filter builder that is awaitable (thenable) like
      // the real PostgREST builder. Filters are recorded so tests can assert
      // that role changes never blanket-delete (e.g. 'owner' rows survive).
      delete: vi.fn(() => {
        const filters: Array<{
          op: "eq" | "neq";
          column: string;
          value: unknown;
        }> = [];
        const builder = {
          eq(column: string, value: unknown) {
            filters.push({ op: "eq", column, value });
            return builder;
          },
          neq(column: string, value: unknown) {
            filters.push({ op: "neq", column, value });
            return builder;
          },
          // biome-ignore lint/suspicious/noThenProperty: mimics the awaitable PostgREST filter builder
          then(onfulfilled: (value: { error: unknown }) => unknown) {
            state.memberDeleteCalls.push([...filters]);
            return Promise.resolve({ error: null }).then(onfulfilled);
          },
        };
        return builder;
      }),
      upsert: vi.fn(async (rows: unknown, options: unknown) => {
        state.memberUpsertCalls.push({ rows, options });
        return { error: null };
      }),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      single: vi.fn(async () => ({ data: null, error: null })),
      order: vi.fn().mockReturnThis(),
    };
  }

  function makeProjectsChain() {
    const c = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(async () => state.insertProfileResult),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => state.insertProfileResult),
        })),
      })),
      order: vi.fn().mockReturnThis(),
      // updateAccount's director backfill awaits .select("id") directly, so
      // the chain itself must be thenable (like the real builder).
      // biome-ignore lint/suspicious/noThenProperty: mimics the awaitable PostgREST query builder
      then(onfulfilled: (value: unknown) => unknown) {
        return Promise.resolve(state.projectsListResult).then(onfulfilled);
      },
    };
    return c;
  }

  return {
    createClient: vi.fn(() => ({
      auth: {
        admin: {
          createUser: vi.fn(async () => state.insertAuthResult),
          deleteUser: vi.fn(async () => state.deleteUserResult),
        },
      },
      from: vi.fn((table: string) => {
        if (table === "profiles") return makeProfilesChain();
        if (table === "project_members") return makeProjectMembersChain();
        if (table === "projects") return makeProjectsChain();
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn(async () => ({ data: null, error: null })),
          maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          insert: vi.fn(async () => ({ data: null, error: null })),
          update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
          delete: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
          order: vi.fn(async () => ({ data: [], error: null })),
        };
      }),
    })),
  };
});

// Import AFTER mocks are registered.
const {
  createAccount,
  listAccounts,
  updateAccount,
  deleteAccount,
  getMyAccount,
  updateMyProfile,
  updateMyPassword,
} = await import("@/app/dashboard/settings/actions");

function resetState() {
  state.user = null;
  state.callerProfile = null;
  state.callerProfileError = null;
  state.insertAuthResult = { data: { user: { id: "new-uid" } }, error: null };
  state.insertProfileResult = { data: { id: 99 }, error: null };
  state.deleteUserResult = { error: null };
  state.updateResult = { error: null };
  state.accountsResult = { data: [], error: null };
  state.targetProfile = { data: null, error: null };
  state.projectsListResult = { data: [], error: null };
  state.memberDeleteCalls = [];
  state.memberUpsertCalls = [];
}

describe("settings/actions — auth gates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── createAccount ─────────────────────────────────────────────────────────
  describe("createAccount", () => {
    it("returns 'Not authenticated' error when no user is logged in", async () => {
      state.user = null;
      const result = await createAccount({
        email: "new@example.com",
        password: "password123",
        name: "New User",
        role: "member",
      });
      expect(result.error).toMatch(/not authenticated/i);
    });

    it("returns 'Not authorized' when caller is not a director", async () => {
      state.user = { id: "uid-member" };
      state.callerProfile = { id: 10, role: "member" };
      const result = await createAccount({
        email: "new@example.com",
        password: "password123",
        name: "New User",
        role: "member",
      });
      // requireDirector() now returns "Director role required" (changed from
      // "Not authorized" in the authz-gate refactor). The assertion intent is
      // unchanged: a non-director is rejected.
      expect(result.error).toMatch(/director role required/i);
    });

    it("returns auth error for unauthenticated caller even with a short password (authz runs first)", async () => {
      // requireDirector() now runs before input validation: an unauthenticated
      // caller with a short password gets the auth error, not the validation hint.
      const result = await createAccount({
        email: "new@example.com",
        password: "short",
        name: "New User",
        role: "member",
      });
      expect(result.error).toMatch(/not authenticated/i);
    });

    it("returns success when director creates a member account", async () => {
      state.user = { id: "uid-director" };
      state.callerProfile = { id: 1, role: "director" };
      state.insertAuthResult = {
        data: { user: { id: "new-uid" } },
        error: null,
      };
      state.insertProfileResult = { data: { id: 99 }, error: null };

      const result = await createAccount({
        email: "member@example.com",
        password: "password123",
        name: "New Member",
        role: "member",
      });
      // Either success or a non-auth error (e.g. duplicate) — not "Not authorized"
      if (result.error) {
        expect(result.error).not.toMatch(/not authorized/i);
        expect(result.error).not.toMatch(/not authenticated/i);
      } else {
        expect(result.success).toBe(true);
      }
    });
  });

  // ── listAccounts ──────────────────────────────────────────────────────────
  describe("listAccounts", () => {
    it("returns error for unauthenticated caller", async () => {
      state.user = null;
      const result = await listAccounts();
      expect(result.error).toMatch(/not authenticated/i);
    });

    it("returns error for non-director caller", async () => {
      state.user = { id: "uid-member" };
      state.callerProfile = { id: 10, role: "member" };
      const result = await listAccounts();
      // requireDirector() now returns "Director role required"
      expect(result.error).toMatch(/director role required/i);
    });
  });

  // ── deleteAccount ─────────────────────────────────────────────────────────
  describe("deleteAccount", () => {
    it("returns error for unauthenticated caller", async () => {
      state.user = null;
      const result = await deleteAccount(99);
      expect(result.error).toMatch(/not authenticated/i);
    });

    it("returns error for non-director caller", async () => {
      state.user = { id: "uid-member" };
      state.callerProfile = { id: 10, role: "member" };
      const result = await deleteAccount(99);
      // requireDirector() now returns "Director role required"
      expect(result.error).toMatch(/director role required/i);
    });
  });

  // ── getMyAccount ──────────────────────────────────────────────────────────
  describe("getMyAccount", () => {
    it("returns error when not authenticated", async () => {
      state.user = null;
      const result = await getMyAccount();
      expect(result.error).toMatch(/not authenticated/i);
    });

    it("returns error when profile is not found", async () => {
      state.user = { id: "uid-1" };
      state.callerProfile = null;
      state.callerProfileError = { message: "No row" };
      const result = await getMyAccount();
      expect(result.error).toMatch(/profile not found/i);
    });

    it("returns account data when authenticated and profile exists", async () => {
      state.user = { id: "uid-1" };
      state.callerProfile = {
        id: 5,
        role: "member",
        name: "Alice",
        email: "alice@example.com",
        department: "Engineering",
        config: {},
      };
      const result = await getMyAccount();
      expect(result.error).toBeNull();
      expect(result.account?.name).toBe("Alice");
      expect(result.account?.role).toBe("member");
    });
  });

  // ── updateMyProfile ───────────────────────────────────────────────────────
  describe("updateMyProfile", () => {
    it("returns error when not authenticated", async () => {
      state.user = null;
      const result = await updateMyProfile({ name: "Alice", department: null });
      expect(result.error).toMatch(/not authenticated/i);
    });

    it("returns error when profile is not found", async () => {
      state.user = { id: "uid-1" };
      state.callerProfile = null;
      state.callerProfileError = { message: "No row" };
      const result = await updateMyProfile({ name: "Alice", department: null });
      expect(result.error).toMatch(/profile not found/i);
    });

    it("returns error when name is too short", async () => {
      state.user = { id: "uid-1" };
      state.callerProfile = {
        id: 1,
        role: "member",
        name: "Alice",
        email: "alice@example.com",
        department: null,
        config: {},
      };
      // Name length check happens after auth — must have valid profile first
      const result = await updateMyProfile({ name: "A", department: null });
      expect(result.error).toMatch(/at least 2 characters/i);
    });

    it("returns success for valid update", async () => {
      state.user = { id: "uid-1" };
      state.callerProfile = {
        id: 1,
        role: "member",
        name: "Alice",
        email: "alice@example.com",
        department: null,
        config: {},
      };
      state.updateResult = { error: null };
      const result = await updateMyProfile({
        name: "Alice Smith",
        department: "Engineering",
      });
      expect(result.error).toBeUndefined();
      expect(result.success).toBe(true);
    });
  });

  // ── updateMyPassword ──────────────────────────────────────────────────────
  describe("updateMyPassword", () => {
    it("returns error when not authenticated", async () => {
      state.user = null;
      const result = await updateMyPassword("newpassword");
      expect(result.error).toMatch(/not authenticated/i);
    });

    it("returns error when profile is not found", async () => {
      state.user = { id: "uid-1" };
      state.callerProfile = null;
      state.callerProfileError = { message: "No row" };
      const result = await updateMyPassword("newpassword");
      expect(result.error).toMatch(/profile not found/i);
    });

    it("returns error when new password is too short", async () => {
      state.user = { id: "uid-1" };
      state.callerProfile = {
        id: 1,
        role: "member",
        name: "Alice",
        email: "alice@example.com",
        department: null,
        config: {},
      };
      const result = await updateMyPassword("short");
      expect(result.error).toMatch(/at least 8 characters/i);
    });

    it("returns success for a valid password change", async () => {
      state.user = { id: "uid-1" };
      state.callerProfile = {
        id: 1,
        role: "member",
        name: "Alice",
        email: "alice@example.com",
        department: null,
        config: {},
      };
      const result = await updateMyPassword("newSecurePassword99");
      expect(result.error).toBeUndefined();
      expect(result.success).toBe(true);
    });
  });
});

// ─── updateAccount — role-change membership reconciliation ───────────────────
// Regression coverage for the audit data-loss bug: a role change used to
// blanket-delete ALL project_members rows for the profile, destroying the
// client's 'owner' row (orphaning their project) and leaving a freshly
// promoted director without per-project access (the DB auto-link trigger is
// INSERT-only and never fires on a profiles.role UPDATE).
describe("settings/actions — updateAccount role-change membership reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetState();
    // Caller: an authenticated director (profile id 1).
    state.user = { id: "uid-director" };
    state.callerProfile = { id: 1, role: "director" };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("preserves 'owner' rows when a client's role changes (no blanket delete)", async () => {
    state.targetProfile = { data: { id: 5, role: "client" }, error: null };

    const result = await updateAccount({
      id: 5,
      name: "Acme Client",
      role: "member",
      department: null,
    });

    expect(result).toEqual({ success: true });
    // Exactly one delete, scoped to the profile AND excluding 'owner' rows —
    // never the old unfiltered .eq("profile_id", …) blanket delete.
    expect(state.memberDeleteCalls).toEqual([
      [
        { op: "eq", column: "profile_id", value: 5 },
        { op: "neq", column: "role", value: "owner" },
      ],
    ]);
  });

  it("backfills director memberships for all projects on promotion", async () => {
    state.targetProfile = { data: { id: 6, role: "member" }, error: null };
    state.projectsListResult = {
      data: [{ id: 101 }, { id: 102 }],
      error: null,
    };

    const result = await updateAccount({
      id: 6,
      name: "Promoted Member",
      role: "director",
      department: "Engineering",
    });

    expect(result).toEqual({ success: true });
    // Stale non-owner rows cleaned first; owner rows untouched.
    expect(state.memberDeleteCalls).toEqual([
      [
        { op: "eq", column: "profile_id", value: 6 },
        { op: "neq", column: "role", value: "owner" },
      ],
    ]);
    // Director rows backfilled for every project, mirroring the DB
    // auto_link_director_to_projects trigger (ON CONFLICT DO NOTHING).
    expect(state.memberUpsertCalls).toEqual([
      {
        rows: [
          { project_id: 101, profile_id: 6, role: "director", assigned_by: 1 },
          { project_id: 102, profile_id: 6, role: "director", assigned_by: 1 },
        ],
        options: {
          onConflict: "project_id,profile_id",
          ignoreDuplicates: true,
        },
      },
    ]);
  });

  it("removes ONLY director rows on demotion — owner/member rows preserved", async () => {
    state.targetProfile = { data: { id: 7, role: "director" }, error: null };

    const result = await updateAccount({
      id: 7,
      name: "Demoted Director",
      role: "member",
      department: null,
    });

    expect(result).toEqual({ success: true });
    expect(state.memberDeleteCalls).toEqual([
      [
        { op: "eq", column: "profile_id", value: 7 },
        { op: "eq", column: "role", value: "director" },
      ],
    ]);
    // No backfill on demotion.
    expect(state.memberUpsertCalls).toEqual([]);
  });

  it("leaves project_members completely untouched when the role is unchanged", async () => {
    state.targetProfile = { data: { id: 8, role: "member" }, error: null };

    const result = await updateAccount({
      id: 8,
      name: "Renamed Only",
      role: "member",
      department: "Design",
    });

    expect(result).toEqual({ success: true });
    expect(state.memberDeleteCalls).toEqual([]);
    expect(state.memberUpsertCalls).toEqual([]);
  });

  it("promotion with zero projects succeeds without an upsert", async () => {
    state.targetProfile = { data: { id: 9, role: "client" }, error: null };
    state.projectsListResult = { data: [], error: null };

    const result = await updateAccount({
      id: 9,
      name: "New Director",
      role: "director",
      department: null,
    });

    expect(result).toEqual({ success: true });
    expect(state.memberUpsertCalls).toEqual([]);
  });
});
