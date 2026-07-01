/**
 * ADVERSARIAL (red-team) tests for app/dashboard/settings/actions.ts.
 *
 * Privilege-escalation threat model derived FIRST:
 *   S1. Director-only actions (createAccount, updateAccount, deleteAccount,
 *       listAccounts, assign/remove members) MUST reject a caller whose profile
 *       role is NOT "director" — including an authenticated "member"/"client".
 *   S2. A director MUST NOT be able to change their OWN role (lockout / silent
 *       self-demotion-or-promotion bypass) — updateAccount blocks self role
 *       change.
 *   S3. A director MUST NOT be able to delete their OWN account.
 *   S4. updateMyProfile / updateMyPassword operate ONLY on the caller's own
 *       profile — there is no id parameter to target another user.
 *   S5. Input validation: password min length boundary (7 reject, 8 accept),
 *       empty / whitespace-only names rejected.
 *
 * Bug hunting note: createAccount validates password length BEFORE the
 * requireDirector() authz check. We assert the FINAL outcome (an unauthorised
 * caller never creates an account) regardless of error-message ordering, and
 * separately document the ordering as an info-disclosure smell.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "anon-key";
process.env.SUPABASE_SECRET_KEY = "service-role-secret";

const state = {
  user: null as unknown,
  callerProfile: null as unknown,
  callerProfileError: null as unknown,
  // Track side effects so we can prove an unauthorised caller changed nothing.
  createUserCalls: 0,
  deleteUserCalls: 0,
  profileUpdateCalls: [] as Array<{
    patch: Record<string, unknown>;
    id: unknown;
  }>,
  // existing row fetched by updateAccount (for role-change detection)
  existingProfile: { data: { id: 1, role: "director" }, error: null } as {
    data: unknown;
    error: unknown;
  },
  updateUserAuthCalls: 0,
  // Shared across profiles chains within one action invocation (see mock).
  profileSingleCalls: 0,
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => {
    // requireDirector() (guards.ts) and requireUser() (actions.ts) both use
    // the RLS-respecting server client for auth + caller-profile lookup.
    // updateMyProfile / updateMyPassword also mutate via this same client.
    // We expose .from("profiles") so those code paths work correctly.
    const profilesChain: Record<string, ReturnType<typeof vi.fn>> = {
      select: vi.fn(),
      eq: vi.fn(),
      // requireUser() → .single(); requireDirector() → .maybeSingle()
      single: vi.fn(async () => ({
        data: state.callerProfile,
        error: state.callerProfileError,
      })),
      maybeSingle: vi.fn(async () => ({
        data: state.callerProfile,
        error: state.callerProfileError,
      })),
      // updateMyProfile uses ctx.supabase.from("profiles").update().eq()
      // Track calls so S4 assertions can verify the correct profile id is
      // targeted and no spurious mutations occur on auth-rejected paths.
      update: vi.fn((patch: Record<string, unknown>) => ({
        eq: vi.fn(async (_col: string, id: unknown) => {
          state.profileUpdateCalls.push({ patch, id });
          return { error: null };
        }),
      })),
    };
    profilesChain.select.mockReturnValue(profilesChain);
    profilesChain.eq.mockReturnValue(profilesChain);
    return {
      auth: {
        getUser: vi.fn(async () => {
          // Every action begins with exactly one getUser() (via requireUser /
          // requireDirector). Reset the admin-mock single() counter here so
          // the "first vs second .single() in admin" routing stays correct
          // across back-to-back action calls in the same test.
          state.profileSingleCalls = 0;
          return state.user
            ? { data: { user: state.user }, error: null }
            : { data: { user: null }, error: { message: "unauthenticated" } };
        }),
        updateUser: vi.fn(async () => {
          state.updateUserAuthCalls++;
          return { error: null };
        }),
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

vi.mock("@supabase/supabase-js", () => {
  // Shared across every profiles chain in a single action invocation: the FIRST
  // .single() in an action is always the caller-profile lookup (requireUser /
  // requireDirector); a SECOND .single() (e.g. updateAccount's existing-row
  // fetch or deleteAccount's target fetch) returns existingProfile. The counter
  // is reset in beforeEach via reset().
  function makeProfilesChain() {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {
      select: vi.fn(),
      eq: vi.fn(),
      single: vi.fn(),
      maybeSingle: vi.fn(),
      update: vi.fn(),
      insert: vi.fn(),
      order: vi.fn(),
      not: vi.fn(),
      delete: vi.fn(),
    };
    chain.select.mockReturnValue(chain);
    chain.not.mockReturnValue(chain);
    chain.order.mockReturnValue(chain);
    // For requireUser/requireDirector AND updateAccount/deleteAccount's existing
    // fetch, the .eq().single() returns the caller profile on the FIRST call of
    // the action and the existing target row on the SECOND. The counter is
    // shared across chains (state.profileSingleCalls) because requireDirector and
    // the action each build their own from("profiles") chain.
    chain.eq.mockReturnValue(chain);
    // The caller-profile lookup (first .single() in the old design) has moved
    // to the server client mock above. The admin client's .single() on profiles
    // is now ALWAYS a TARGET lookup (updateAccount existing-row fetch,
    // deleteAccount uid fetch), so we return state.existingProfile directly
    // without any call-counter routing.
    chain.single.mockImplementation(async () => state.existingProfile);
    chain.maybeSingle.mockImplementation(async () => ({
      data: null,
      error: null,
    }));
    chain.update.mockImplementation((patch: Record<string, unknown>) => {
      return {
        eq: vi.fn(async (_col: string, id: unknown) => {
          state.profileUpdateCalls.push({ patch, id });
          return { error: null };
        }),
      };
    });
    chain.insert.mockImplementation(() => ({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({ data: { id: 99 }, error: null })),
      })),
    }));
    chain.delete.mockReturnValue({ eq: vi.fn(async () => ({ error: null })) });
    return chain;
  }

  return {
    createClient: vi.fn(() => ({
      auth: {
        admin: {
          createUser: vi.fn(async () => {
            state.createUserCalls++;
            return { data: { user: { id: "new-uid" } }, error: null };
          }),
          deleteUser: vi.fn(async () => {
            state.deleteUserCalls++;
            return { error: null };
          }),
        },
      },
      from: vi.fn((table: string) => {
        if (table === "profiles") return makeProfilesChain();
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn(async () => ({ data: null, error: null })),
          maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          insert: vi.fn(async () => ({ error: null })),
          update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
          delete: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
          order: vi.fn(async () => ({ data: [], error: null })),
          not: vi.fn().mockReturnThis(),
        };
      }),
    })),
  };
});

const {
  createAccount,
  updateAccount,
  deleteAccount,
  listAccounts,
  updateMyProfile,
  updateMyPassword,
} = await import("@/app/dashboard/settings/actions");

function reset() {
  state.user = null;
  state.callerProfile = null;
  state.callerProfileError = null;
  state.createUserCalls = 0;
  state.deleteUserCalls = 0;
  state.profileUpdateCalls = [];
  state.existingProfile = { data: { id: 1, role: "director" }, error: null };
  state.updateUserAuthCalls = 0;
  state.profileSingleCalls = 0;
}

describe("ADVERSARIAL settings — director-only authz (S1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reset();
  });
  afterEach(() => vi.restoreAllMocks());

  it("a MEMBER cannot createAccount and NO auth user is created", async () => {
    state.user = { id: "uid-member" };
    state.callerProfile = { id: 2, role: "member" };
    const res = await createAccount({
      email: "x@y.com",
      password: "longenough",
      name: "Mallory",
      role: "director", // tries to mint a director
    });
    expect(res.error).toBeTruthy();
    expect(state.createUserCalls).toBe(0);
  });

  it("a CLIENT cannot createAccount", async () => {
    state.user = { id: "uid-client" };
    state.callerProfile = { id: 3, role: "client" };
    const res = await createAccount({
      email: "x@y.com",
      password: "longenough",
      name: "Mallory",
      role: "member",
    });
    expect(res.error).toBeTruthy();
    expect(state.createUserCalls).toBe(0);
  });

  it("a MEMBER cannot deleteAccount and NO user is deleted", async () => {
    state.user = { id: "uid-member" };
    state.callerProfile = { id: 2, role: "member" };
    const res = await deleteAccount(1);
    expect(res.error).toBeTruthy();
    expect(state.deleteUserCalls).toBe(0);
  });

  it("a MEMBER cannot updateAccount and NO profile row is mutated", async () => {
    state.user = { id: "uid-member" };
    state.callerProfile = { id: 2, role: "member" };
    const res = await updateAccount({
      id: 1,
      name: "New",
      role: "director",
      department: null,
    });
    expect(res.error).toBeTruthy();
    expect(state.profileUpdateCalls.length).toBe(0);
  });

  it("a MEMBER cannot listAccounts (no data leak)", async () => {
    state.user = { id: "uid-member" };
    state.callerProfile = { id: 2, role: "member" };
    const res = await listAccounts();
    expect(res.error).toBeTruthy();
    expect(res.accounts).toEqual([]);
  });

  it("an UNAUTHENTICATED caller cannot createAccount even with a valid password", async () => {
    state.user = null;
    const res = await createAccount({
      email: "x@y.com",
      password: "longenough",
      name: "Mallory",
      role: "director",
    });
    expect(res.error).toBeTruthy();
    expect(state.createUserCalls).toBe(0);
  });

  // Authz runs BEFORE input validation: an unauthenticated caller with a short
  // password gets "Not authenticated", not a password hint. No account is created.
  it("createAccount authz gate runs before password validation — unauthenticated caller gets auth error", async () => {
    state.user = null; // unauthenticated
    const res = await createAccount({
      email: "x@y.com",
      password: "short", // < 8
      name: "Mallory",
      role: "director",
    });
    expect(res.error).toMatch(/not authenticated/i);
    // Authz ran first: no user created.
    expect(state.createUserCalls).toBe(0);
  });
});

describe("ADVERSARIAL settings — self role change & self delete (S2/S3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reset();
  });
  afterEach(() => vi.restoreAllMocks());

  it("a director cannot change their OWN role", async () => {
    state.user = { id: "uid-dir" };
    state.callerProfile = { id: 7, role: "director" };
    // The existing target row (id 7) currently director; caller tries to demote
    // themselves to member.
    state.existingProfile = { data: { id: 7, role: "director" }, error: null };
    const res = await updateAccount({
      id: 7,
      name: "Self",
      role: "member",
      department: null,
    });
    expect(res.error).toMatch(/can't change your own role/i);
    expect(state.profileUpdateCalls.length).toBe(0);
  });

  it("a director CAN rename themselves without a role change (control case)", async () => {
    state.user = { id: "uid-dir" };
    state.callerProfile = { id: 7, role: "director" };
    state.existingProfile = { data: { id: 7, role: "director" }, error: null };
    const res = await updateAccount({
      id: 7,
      name: "Renamed",
      role: "director",
      department: null,
    });
    expect(res).toEqual({ success: true });
    expect(state.profileUpdateCalls.length).toBe(1);
  });

  it("a director cannot delete their OWN account", async () => {
    state.user = { id: "uid-self" };
    state.callerProfile = { id: 7, role: "director" };
    // deleteAccount fetches the profile by id to read its uid; make that uid
    // match the caller's auth uid so the self-delete guard triggers.
    state.existingProfile = { data: { uid: "uid-self" }, error: null };
    const res = await deleteAccount(7);
    expect(res.error).toMatch(/cannot delete your own account/i);
    expect(state.deleteUserCalls).toBe(0);
  });
});

describe("ADVERSARIAL settings — input validation boundaries (S5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reset();
    state.user = { id: "uid-dir" };
    state.callerProfile = { id: 1, role: "director" };
  });
  afterEach(() => vi.restoreAllMocks());

  it("createAccount rejects a 7-char password (boundary)", async () => {
    const res = await createAccount({
      email: "a@b.com",
      password: "1234567",
      name: "Valid Name",
      role: "member",
    });
    expect(res.error).toMatch(/at least 8/i);
    expect(state.createUserCalls).toBe(0);
  });

  it("updateMyPassword rejects a 7-char password and accepts 8 (boundary)", async () => {
    // requireUser path: caller profile fetched, then auth.updateUser called.
    const tooShort = await updateMyPassword("1234567");
    expect(tooShort.error).toMatch(/at least 8/i);
    expect(state.updateUserAuthCalls).toBe(0);

    const ok = await updateMyPassword("12345678");
    expect(ok).toEqual({ success: true });
    expect(state.updateUserAuthCalls).toBe(1);
  });

  it("updateMyProfile rejects an empty / whitespace-only name", async () => {
    const empty = await updateMyProfile({ name: "   ", department: null });
    expect(empty.error).toMatch(/at least 2 characters/i);
    expect(state.profileUpdateCalls.length).toBe(0);
  });

  it("updateAccount rejects a 1-char name", async () => {
    state.existingProfile = { data: { id: 5, role: "member" }, error: null };
    const res = await updateAccount({
      id: 5,
      name: "A",
      role: "member",
      department: null,
    });
    expect(res.error).toMatch(/at least 2 characters/i);
    expect(state.profileUpdateCalls.length).toBe(0);
  });

  it("updateMyProfile updates ONLY the caller's own profile id (S4 — no target id param)", async () => {
    const res = await updateMyProfile({
      name: "Legit Name",
      department: "Eng",
    });
    expect(res).toEqual({ success: true });
    expect(state.profileUpdateCalls.length).toBe(1);
    // The update is keyed to the caller's profile id (1), never a client-chosen id.
    expect(state.profileUpdateCalls[0].id).toBe(1);
  });
});
