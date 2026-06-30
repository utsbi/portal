/**
 * Tests for app/dashboard/questionnaire/actions.ts — saveDraft and submitForm.
 *
 * Security gate coverage for both actions:
 *   - unauthenticated caller (requireAuth gate)
 *   - authenticated but no profile row (verifyProjectMembership)
 *   - user is not a member of the project (project_members lookup empty)
 *   - form is not assigned to the project (custom_form_assignments lookup empty)
 *   - form inactive or missing (loadSchema returns null)
 *   - answer exceeding MAX_ANSWER_LENGTH=4000 chars
 *   - submitForm only: form window "not_yet" / "closed" (formWindowState)
 *   - successful upsert — asserts payload shape (form_id, user_id, project_id,
 *     answers, status)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Environment vars (must be set before any import) ─────────────────────────
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "anon-key";
process.env.SUPABASE_SECRET_KEY = "service-role-secret";

// ─── Mutable per-test state ───────────────────────────────────────────────────
const state = {
  user: null as unknown,
  profile: null as unknown,
  membership: null as unknown,
  assignment: null as unknown,
  schemaData: null as unknown,
  upsertResult: { data: null as unknown, error: null as unknown },
};

// Captures the row object passed to .upsert() so tests can assert its shape.
const upsertSpy = vi.fn();

// ─── @/lib/supabase/server mock ───────────────────────────────────────────────
// The actions call createClient() at runtime; each call gets a fresh mock
// client. The from() dispatch reads state lazily so per-test overrides land.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => {
    /**
     * Return-this fluent chain for .select().eq()…maybeSingle() patterns.
     * The terminal methods (maybeSingle / single) resolve from the given thunk
     * so that per-test state mutations take effect at call-time, not at
     * chain-construction time.
     */
    function makeChain(resolve: () => { data: unknown; error: unknown }) {
      const chain: Record<string, unknown> = {};
      const select = vi.fn(() => chain);
      const eq = vi.fn(() => chain);
      const maybeSingle = vi.fn(async () => resolve());
      const single = vi.fn(async () => resolve());
      chain.select = select;
      chain.eq = eq;
      chain.maybeSingle = maybeSingle;
      chain.single = single;
      return chain;
    }

    return {
      auth: {
        getUser: vi.fn(async () =>
          state.user
            ? { data: { user: state.user }, error: null }
            : {
                data: { user: null },
                error: { message: "Not authenticated" },
              },
        ),
      },
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return makeChain(() => ({ data: state.profile, error: null }));
        }
        if (table === "project_members") {
          return makeChain(() => ({ data: state.membership, error: null }));
        }
        if (table === "custom_form_assignments") {
          return makeChain(() => ({ data: state.assignment, error: null }));
        }
        if (table === "custom_form_schemas") {
          return makeChain(() => ({ data: state.schemaData, error: null }));
        }
        if (table === "custom_form_submissions") {
          return {
            upsert: vi.fn((payload: unknown) => {
              upsertSpy(payload);
              return {
                select: vi.fn(() => ({
                  single: vi.fn(async () => state.upsertResult),
                })),
              };
            }),
          };
        }
        // Fallback for tables the actions don't explicitly read in these paths.
        return makeChain(() => ({ data: null, error: null }));
      }),
    };
  }),
}));

// ─── next/cache mock ──────────────────────────────────────────────────────────
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// ─── Director guard (not exercised here — always short-circuits to rejected) ──
vi.mock("@/lib/auth/guards", () => ({
  requireDirector: vi.fn(async () => ({
    ok: false,
    error: "Not authorized",
  })),
}));

// ─── Discord notification (best-effort side-effect; must never reach webhook) ─
vi.mock("@/lib/questionnaire/notify", () => ({
  notifyFormSubmission: vi.fn(async () => {}),
}));

// ─── Public-sharing helpers (director-only paths; not exercised here) ─────────
vi.mock("@/lib/questionnaire/public", () => ({
  generatePublicToken: vi.fn(() => "tok_test"),
  hashPassword: vi.fn((pw: string) => `hashed:${pw}`),
}));

// Import AFTER mocks are registered.
const { saveDraft, submitForm } = await import(
  "@/app/dashboard/questionnaire/actions"
);

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const FORM_ID = 7;
const PROJECT_ID = 3;
const USER_ID = "uid-alice";
const PROFILE_ID = 42;

/** Active schema with a single optional field (no validation errors on submit). */
const ACTIVE_SCHEMA_ROW = {
  fields: [
    { id: "q1", type: "short_text", label: "Question 1", required: false },
  ],
  version: 2,
  is_active: true,
  opens_at: null,
  closes_at: null,
};

const VALID_ANSWERS = { q1: "Hello world" };

/** Put state into a fully-authorised happy-path baseline. */
function setHappyPath() {
  state.user = { id: USER_ID };
  state.profile = { id: PROFILE_ID };
  state.membership = { project_id: PROJECT_ID };
  state.assignment = { id: 1 };
  state.schemaData = { ...ACTIVE_SCHEMA_ROW };
  state.upsertResult = { data: { id: 99 }, error: null };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("questionnaire/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.user = null;
    state.profile = null;
    state.membership = null;
    state.assignment = null;
    state.schemaData = null;
    state.upsertResult = { data: null, error: null };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── saveDraft ──────────────────────────────────────────────────────────────

  describe("saveDraft", () => {
    it("returns 'Not authenticated' when no user session exists", async () => {
      // state.user stays null
      const result = await saveDraft({
        formId: FORM_ID,
        projectId: PROJECT_ID,
        answers: {},
      });
      expect((result as { error?: string }).error).toMatch(
        /not authenticated/i,
      );
    });

    it("returns 'Profile not found' when the auth uid has no matching profile row", async () => {
      state.user = { id: USER_ID };
      // state.profile stays null → verifyProjectMembership returns "Profile not found"
      const result = await saveDraft({
        formId: FORM_ID,
        projectId: PROJECT_ID,
        answers: {},
      });
      expect((result as { error?: string }).error).toMatch(
        /profile not found/i,
      );
    });

    it("returns membership error when the user is not a member of the project", async () => {
      state.user = { id: USER_ID };
      state.profile = { id: PROFILE_ID };
      // state.membership stays null → project_members lookup returns nothing
      const result = await saveDraft({
        formId: FORM_ID,
        projectId: PROJECT_ID,
        answers: {},
      });
      expect((result as { error?: string }).error).toMatch(/not a member/i);
    });

    it("returns assignment error when the form is not assigned to the project", async () => {
      state.user = { id: USER_ID };
      state.profile = { id: PROFILE_ID };
      state.membership = { project_id: PROJECT_ID };
      // state.assignment stays null → custom_form_assignments lookup returns nothing
      const result = await saveDraft({
        formId: FORM_ID,
        projectId: PROJECT_ID,
        answers: {},
      });
      expect((result as { error?: string }).error).toMatch(/not assigned/i);
    });

    it("returns 'Form not found or inactive' when the schema row is missing", async () => {
      state.user = { id: USER_ID };
      state.profile = { id: PROFILE_ID };
      state.membership = { project_id: PROJECT_ID };
      state.assignment = { id: 1 };
      // state.schemaData stays null → loadSchema returns null
      const result = await saveDraft({
        formId: FORM_ID,
        projectId: PROJECT_ID,
        answers: {},
      });
      expect((result as { error?: string }).error).toMatch(
        /form not found or inactive/i,
      );
    });

    it("returns 'Form not found or inactive' when is_active is false", async () => {
      state.user = { id: USER_ID };
      state.profile = { id: PROFILE_ID };
      state.membership = { project_id: PROJECT_ID };
      state.assignment = { id: 1 };
      state.schemaData = { ...ACTIVE_SCHEMA_ROW, is_active: false };
      const result = await saveDraft({
        formId: FORM_ID,
        projectId: PROJECT_ID,
        answers: {},
      });
      expect((result as { error?: string }).error).toMatch(
        /form not found or inactive/i,
      );
    });

    it("returns character-limit error when an answer string exceeds 4000 chars", async () => {
      setHappyPath();
      const result = await saveDraft({
        formId: FORM_ID,
        projectId: PROJECT_ID,
        answers: { q1: "x".repeat(4001) },
      });
      expect((result as { error?: string }).error).toMatch(/4000.character/i);
    });

    it("succeeds and returns submissionId with correct upsert payload", async () => {
      setHappyPath();
      const result = await saveDraft({
        formId: FORM_ID,
        projectId: PROJECT_ID,
        answers: VALID_ANSWERS,
      });

      // No error on the result.
      expect((result as { error?: string }).error).toBeUndefined();
      expect((result as { submissionId?: number }).submissionId).toBe(99);

      // Upsert was called exactly once with the correct row shape.
      expect(upsertSpy).toHaveBeenCalledTimes(1);
      const payload = upsertSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(payload.form_id).toBe(FORM_ID);
      expect(payload.user_id).toBe(USER_ID);
      expect(payload.project_id).toBe(PROJECT_ID);
      expect(payload.data).toEqual(VALID_ANSWERS);
      expect(payload.status).toBe("draft");
    });
  });

  // ── submitForm ─────────────────────────────────────────────────────────────

  describe("submitForm", () => {
    it("returns 'Not authenticated' when no user session exists", async () => {
      // state.user stays null
      const result = await submitForm({
        formId: FORM_ID,
        projectId: PROJECT_ID,
        answers: {},
      });
      expect((result as { error?: string }).error).toMatch(
        /not authenticated/i,
      );
    });

    it("returns 'Profile not found' when the auth uid has no matching profile row", async () => {
      state.user = { id: USER_ID };
      // state.profile stays null
      const result = await submitForm({
        formId: FORM_ID,
        projectId: PROJECT_ID,
        answers: {},
      });
      expect((result as { error?: string }).error).toMatch(
        /profile not found/i,
      );
    });

    it("returns membership error when the user is not a member of the project", async () => {
      state.user = { id: USER_ID };
      state.profile = { id: PROFILE_ID };
      // state.membership stays null
      const result = await submitForm({
        formId: FORM_ID,
        projectId: PROJECT_ID,
        answers: {},
      });
      expect((result as { error?: string }).error).toMatch(/not a member/i);
    });

    it("returns assignment error when the form is not assigned to the project", async () => {
      state.user = { id: USER_ID };
      state.profile = { id: PROFILE_ID };
      state.membership = { project_id: PROJECT_ID };
      // state.assignment stays null
      const result = await submitForm({
        formId: FORM_ID,
        projectId: PROJECT_ID,
        answers: {},
      });
      expect((result as { error?: string }).error).toMatch(/not assigned/i);
    });

    it("returns 'Form not found or inactive' when the schema row is missing", async () => {
      state.user = { id: USER_ID };
      state.profile = { id: PROFILE_ID };
      state.membership = { project_id: PROJECT_ID };
      state.assignment = { id: 1 };
      // state.schemaData stays null
      const result = await submitForm({
        formId: FORM_ID,
        projectId: PROJECT_ID,
        answers: {},
      });
      expect((result as { error?: string }).error).toMatch(
        /form not found or inactive/i,
      );
    });

    it("returns character-limit error when an answer string exceeds 4000 chars", async () => {
      setHappyPath();
      const result = await submitForm({
        formId: FORM_ID,
        projectId: PROJECT_ID,
        answers: { q1: "y".repeat(4001) },
      });
      expect((result as { error?: string }).error).toMatch(/4000.character/i);
    });

    it("returns 'not open yet' when the form window state is 'not_yet'", async () => {
      setHappyPath();
      // opens_at in the far future → formWindowState returns "not_yet"
      state.schemaData = {
        ...ACTIVE_SCHEMA_ROW,
        opens_at: "2099-01-01T00:00:00Z",
        closes_at: null,
      };
      const result = await submitForm({
        formId: FORM_ID,
        projectId: PROJECT_ID,
        answers: VALID_ANSWERS,
      });
      expect((result as { error?: string }).error).toMatch(/not open yet/i);
    });

    it("returns 'closed' when the form window state is 'closed'", async () => {
      setHappyPath();
      // closes_at in the past → formWindowState returns "closed"
      state.schemaData = {
        ...ACTIVE_SCHEMA_ROW,
        opens_at: null,
        closes_at: "2020-01-01T00:00:00Z",
      };
      const result = await submitForm({
        formId: FORM_ID,
        projectId: PROJECT_ID,
        answers: VALID_ANSWERS,
      });
      expect((result as { error?: string }).error).toMatch(/closed/i);
    });

    it("succeeds and returns submissionId with status=submitted in the upsert payload", async () => {
      setHappyPath();
      const result = await submitForm({
        formId: FORM_ID,
        projectId: PROJECT_ID,
        answers: VALID_ANSWERS,
      });

      // No error on the result.
      expect((result as { error?: string }).error).toBeUndefined();
      expect((result as { submissionId?: number }).submissionId).toBe(99);

      // Upsert was called exactly once with the correct row shape.
      expect(upsertSpy).toHaveBeenCalledTimes(1);
      const payload = upsertSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(payload.form_id).toBe(FORM_ID);
      expect(payload.user_id).toBe(USER_ID);
      expect(payload.project_id).toBe(PROJECT_ID);
      expect(payload.data).toEqual(VALID_ANSWERS);
      expect(payload.status).toBe("submitted");
    });
  });
});
