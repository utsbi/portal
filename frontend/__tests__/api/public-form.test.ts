/**
 * Tests for lib/questionnaire/public.ts — submitPublicForm and its helpers.
 *
 * Critical ordering invariant (P2-G fix): Turnstile is verified BEFORE the
 * password gate. A request with a bad captcha token is rejected with a captcha
 * error even when the password is also wrong — the password gate is never
 * consulted until the bot challenge passes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mutable DB-state shared by tests ────────────────────────────────────────

// What the custom_form_schemas select query resolves to.
let formRowResult: { data: unknown; error: unknown } = {
  data: null,
  error: null,
};
// What the custom_form_submissions insert resolves to.
let insertResult: { error: unknown } = { error: null };
// Captures the payload passed to .insert() so tests can assert the exact shape.
const insertSpy = vi.fn();

// ─── Supabase admin client mock ───────────────────────────────────────────────
// createAdminClient() is called twice within submitPublicForm:
//   1. loadPublicFormRow  → custom_form_schemas select chain
//   2. submit insert      → custom_form_submissions.insert()
// notifyFormSubmission is fully mocked below so its internal DB calls are absent.

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => {
    // Fresh chain per client instantiation; maybeSingle() reads formRowResult
    // at call time (not construction time) via the arrow-function closure.
    const schemaChain = {
      select: vi.fn(() => schemaChain),
      eq: vi.fn(() => schemaChain),
      maybeSingle: vi.fn(async () => formRowResult),
    };
    return {
      from: vi.fn((table: string) => {
        if (table === "custom_form_schemas") return schemaChain;
        if (table === "custom_form_submissions") {
          return {
            insert: vi.fn((payload: unknown) => {
              insertSpy(payload);
              return Promise.resolve(insertResult);
            }),
          };
        }
        return {};
      }),
    };
  }),
}));

// ─── Notification mock ────────────────────────────────────────────────────────
vi.mock("@/lib/questionnaire/notify", () => ({
  notifyFormSubmission: vi.fn(async () => {}),
}));

// ─── fetch mock (Cloudflare Turnstile siteverify) ─────────────────────────────
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

// ─── Environment ──────────────────────────────────────────────────────────────
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SECRET_KEY = "test-service-role-key";
process.env.TURNSTILE_SECRET_KEY = "test-turnstile-secret";

// ─── Imports (after mocks) ────────────────────────────────────────────────────
const { submitPublicForm, hashPassword, verifyPassword, verifyTurnstile } =
  await import("@/lib/questionnaire/public");

const { notifyFormSubmission } = await import("@/lib/questionnaire/notify");

// Pre-compute a password hash once — scrypt is intentionally slow; no need to
// repeat it in every test case that needs a stored hash.
const TEST_PASSWORD = "correct-password-123";
const TEST_PASSWORD_HASH = hashPassword(TEST_PASSWORD);

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Minimal valid open form row as stored in the DB (link-visibility, no window). */
const OPEN_ROW = {
  id: 1,
  title: "Test Form",
  description: null,
  visibility: "link",
  public_password_hash: null,
  // One non-required short_text field so validateAnswers can pass.
  fields: [{ id: "q1", type: "short_text", label: "Question 1" }],
  version: 1,
  is_active: true,
  opens_at: null,
  closes_at: null,
};

/** Minimal valid submit input for a link-visibility (no password) form. */
const VALID_INPUT = {
  token: "a".repeat(32), // >= 16 chars, passes the early-exit guard
  submitterName: "Test User",
  submitterEmail: "test@example.com",
  answers: { q1: "Hello" },
  turnstileToken: "valid-cf-token",
};

// Helper: make fetchMock return a Cloudflare Turnstile response.
function stubTurnstile(success: boolean) {
  fetchMock.mockImplementation(async (url: string) => {
    if (String(url).includes("cloudflare.com")) {
      return new Response(JSON.stringify({ success }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("OK", { status: 204 });
  });
}

// ─── verifyPassword (unit) ────────────────────────────────────────────────────

describe("verifyPassword", () => {
  it("returns false for a malformed stored hash (wrong number of segments)", () => {
    expect(verifyPassword("any", "not-a-hash")).toBe(false);
    expect(verifyPassword("any", "only:two")).toBe(false);
    expect(verifyPassword("any", "extra:prefix:abc:def")).toBe(false);
  });

  it("returns false when the password does not match", () => {
    expect(verifyPassword("wrong-password", TEST_PASSWORD_HASH)).toBe(false);
  });

  it("returns true when the password matches the stored hash (constant-time)", () => {
    expect(verifyPassword(TEST_PASSWORD, TEST_PASSWORD_HASH)).toBe(true);
  });
});

// ─── verifyTurnstile (unit) ───────────────────────────────────────────────────

describe("verifyTurnstile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TURNSTILE_SECRET_KEY = "test-turnstile-secret";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns false when TURNSTILE_SECRET_KEY is not configured", async () => {
    const saved = process.env.TURNSTILE_SECRET_KEY;
    delete process.env.TURNSTILE_SECRET_KEY;
    expect(await verifyTurnstile("some-token")).toBe(false);
    // Restore so subsequent tests are unaffected.
    process.env.TURNSTILE_SECRET_KEY = saved;
  });

  it("returns false immediately when the token is null (no fetch call)", async () => {
    expect(await verifyTurnstile(null)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns false when fetch throws a network error", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network error"));
    expect(await verifyTurnstile("any-token")).toBe(false);
  });

  it("returns false when Cloudflare responds with success: false", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false }), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(await verifyTurnstile("bad-token")).toBe(false);
  });

  it("returns true when Cloudflare responds with success: true", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(await verifyTurnstile("good-token")).toBe(true);
  });
});

// ─── submitPublicForm ─────────────────────────────────────────────────────────

describe("submitPublicForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TURNSTILE_SECRET_KEY = "test-turnstile-secret";
    // Default: open link-visibility form, insert succeeds, Turnstile passes.
    formRowResult = { data: { ...OPEN_ROW }, error: null };
    insertResult = { error: null };
    stubTurnstile(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Token / form availability ────────────────────────────────────────────

  it("rejects a token shorter than 16 characters without hitting the DB", async () => {
    const result = await submitPublicForm({ ...VALID_INPUT, token: "short" });
    expect(result).toEqual({ error: "This form is not available." });
  });

  it("returns unavailable when the DB has no matching row", async () => {
    formRowResult = { data: null, error: null };
    const result = await submitPublicForm(VALID_INPUT);
    expect(result).toEqual({ error: "This form is not available." });
  });

  it("returns unavailable when the form is inactive (is_active: false)", async () => {
    formRowResult = {
      data: { ...OPEN_ROW, is_active: false },
      error: null,
    };
    const result = await submitPublicForm(VALID_INPUT);
    expect(result).toEqual({ error: "This form is not available." });
  });

  it("returns unavailable when visibility is not 'link' or 'password'", async () => {
    formRowResult = {
      data: { ...OPEN_ROW, visibility: "private" },
      error: null,
    };
    const result = await submitPublicForm(VALID_INPUT);
    expect(result).toEqual({ error: "This form is not available." });
  });

  // ── Window state ─────────────────────────────────────────────────────────

  it("returns not-open-yet when opens_at is in the future", async () => {
    formRowResult = {
      data: { ...OPEN_ROW, opens_at: "2099-01-01T00:00:00Z" },
      error: null,
    };
    const result = await submitPublicForm(VALID_INPUT);
    expect(result).toEqual({ error: "This form is not open yet." });
  });

  it("returns closed when closes_at is in the past", async () => {
    formRowResult = {
      data: { ...OPEN_ROW, closes_at: "2020-01-01T00:00:00Z" },
      error: null,
    };
    const result = await submitPublicForm(VALID_INPUT);
    expect(result).toEqual({ error: "This form is closed." });
  });

  // ── Turnstile BEFORE password (P2-G ordering invariant) ──────────────────
  //
  // Turnstile must run before the password gate to prevent a timing/response
  // oracle: if the password were checked first, an attacker could distinguish
  // "correct password + bad captcha" from "wrong password + bad captcha" by
  // observing whether they get "Incorrect password." vs. "Captcha failed."

  it("returns captcha error when Turnstile fails, even when the password is also wrong (ordering enforced)", async () => {
    formRowResult = {
      data: {
        ...OPEN_ROW,
        visibility: "password",
        public_password_hash: TEST_PASSWORD_HASH,
      },
      error: null,
    };
    stubTurnstile(false);

    const result = await submitPublicForm({
      ...VALID_INPUT,
      password: "wrong-password",
      turnstileToken: "bad-token",
    });

    // Must be the captcha error — NOT "Incorrect password."
    expect(result).toEqual({
      error: "Captcha verification failed. Please try again.",
    });
    expect((result as { error: string }).error).not.toMatch(/password/i);
  });

  it("returns captcha error when Turnstile fails and no password is provided at all", async () => {
    // If the password gate were checked first, an absent password on a
    // password-protected form would return "Incorrect password." before the
    // captcha error ever ran. This test proves that ordering cannot happen.
    formRowResult = {
      data: {
        ...OPEN_ROW,
        visibility: "password",
        public_password_hash: TEST_PASSWORD_HASH,
      },
      error: null,
    };
    stubTurnstile(false);

    // No password field at all in the input.
    const result = await submitPublicForm({
      ...VALID_INPUT,
      turnstileToken: "bad-token",
    });

    expect(result).toEqual({
      error: "Captcha verification failed. Please try again.",
    });
    expect((result as { error: string }).error).not.toMatch(/password/i);
  });

  // ── Password gate (only reached after Turnstile passes) ──────────────────

  it("returns incorrect-password error when Turnstile passes but the password is wrong", async () => {
    formRowResult = {
      data: {
        ...OPEN_ROW,
        visibility: "password",
        public_password_hash: TEST_PASSWORD_HASH,
      },
      error: null,
    };

    const result = await submitPublicForm({
      ...VALID_INPUT,
      password: "totally-wrong",
      turnstileToken: "valid-cf-token",
    });

    expect(result).toEqual({ error: "Incorrect password." });
  });

  it("passes the password gate and succeeds when Turnstile passes and the password is correct", async () => {
    formRowResult = {
      data: {
        ...OPEN_ROW,
        visibility: "password",
        public_password_hash: TEST_PASSWORD_HASH,
      },
      error: null,
    };

    const result = await submitPublicForm({
      ...VALID_INPUT,
      password: TEST_PASSWORD,
      turnstileToken: "valid-cf-token",
    });

    expect(result).toEqual({ ok: true });
  });

  // ── Submitter identity ────────────────────────────────────────────────────

  it("rejects when the submitter name is blank (whitespace only)", async () => {
    const result = await submitPublicForm({
      ...VALID_INPUT,
      submitterName: "   ",
    });
    expect(result).toEqual({ error: "Please enter your name." });
  });

  it("rejects when the submitter email is not a valid address", async () => {
    for (const bad of ["not-an-email", "missing@", "@nodomain", "no-at-sign"]) {
      const result = await submitPublicForm({
        ...VALID_INPUT,
        submitterEmail: bad,
      });
      expect(result, `expected rejection for email "${bad}"`).toEqual({
        error: "Please enter a valid email.",
      });
    }
  });

  // ── Schema validation ─────────────────────────────────────────────────────

  it("returns a validation error when a required field has no answer", async () => {
    formRowResult = {
      data: {
        ...OPEN_ROW,
        fields: [
          {
            id: "req1",
            type: "short_text",
            label: "Required Question",
            required: true,
          },
        ],
      },
      error: null,
    };

    const result = await submitPublicForm({ ...VALID_INPUT, answers: {} });
    expect(result).toEqual({
      error: "Please complete 1 required or invalid field.",
    });
  });

  it("pluralises the validation error when multiple required fields are unanswered", async () => {
    formRowResult = {
      data: {
        ...OPEN_ROW,
        fields: [
          { id: "r1", type: "short_text", label: "Q1", required: true },
          { id: "r2", type: "short_text", label: "Q2", required: true },
        ],
      },
      error: null,
    };

    const result = await submitPublicForm({ ...VALID_INPUT, answers: {} });
    expect(result).toEqual({
      error: "Please complete 2 required or invalid fields.",
    });
  });

  // ── Answer bounds (storage / DoS guard) ──────────────────────────────────

  it("rejects when a single answer value exceeds 50 KB", async () => {
    const result = await submitPublicForm({
      ...VALID_INPUT,
      // 51 KB of data in one answer value.
      answers: { q1: "x".repeat(51 * 1024) },
    });
    expect(result).toEqual({
      error: "Your submission is too large. Please shorten your answers.",
    });
  });

  it("rejects when the answer map has more than 500 keys", async () => {
    const bigAnswers: Record<string, string> = {};
    // 501 keys exceeds MAX_ANSWER_ENTRIES (500).
    for (let i = 0; i <= 500; i++) {
      bigAnswers[`key_${i}`] = "v";
    }
    const result = await submitPublicForm({
      ...VALID_INPUT,
      answers: bigAnswers,
    });
    expect(result).toEqual({
      error: "Your submission is too large. Please shorten your answers.",
    });
  });

  // ── DB insert error ───────────────────────────────────────────────────────

  it("returns a generic error and does NOT leak the raw DB message when insert fails", async () => {
    insertResult = {
      error: {
        message:
          'duplicate key value violates unique constraint "custom_form_submissions_secret_idx"',
      },
    };

    const result = await submitPublicForm(VALID_INPUT);

    expect(result).toEqual({ error: "Could not submit. Please try again." });
    // Raw DB internals must never be surfaced to the caller.
    expect(JSON.stringify(result)).not.toMatch(
      /custom_form_submissions_secret_idx|duplicate key/,
    );
  });

  // ── Successful submission ─────────────────────────────────────────────────

  it("returns { ok: true } and inserts a correctly-shaped row on success", async () => {
    const result = await submitPublicForm(VALID_INPUT);

    expect(result).toEqual({ ok: true });

    // Exactly one insert call with the expected payload shape.
    expect(insertSpy).toHaveBeenCalledTimes(1);
    const payload = insertSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.form_id).toBe(1);
    expect(payload.user_id).toBeNull();
    expect(payload.project_id).toBeNull();
    expect(payload.data).toEqual({ q1: "Hello" });
    expect(payload.status).toBe("submitted");
    expect(payload.schema_version).toBe(1);
    expect(payload.submitter_name).toBe("Test User");
    expect(payload.submitter_email).toBe("test@example.com");
  });

  it("fires the notification webhook on successful submission with correct args", async () => {
    await submitPublicForm(VALID_INPUT);

    expect(vi.mocked(notifyFormSubmission)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(notifyFormSubmission)).toHaveBeenCalledWith({
      formId: 1,
      via: "public",
      submitterName: "Test User",
      submitterEmail: "test@example.com",
    });
  });

  it("does NOT fire the notification when the insert fails", async () => {
    insertResult = { error: { message: "connection refused" } };

    await submitPublicForm(VALID_INPUT);

    expect(vi.mocked(notifyFormSubmission)).not.toHaveBeenCalled();
  });

  it("trims leading and trailing whitespace from name and email before persisting", async () => {
    await submitPublicForm({
      ...VALID_INPUT,
      submitterName: "  Padded Name  ",
      submitterEmail: "  padded@example.com  ",
    });

    const payload = insertSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.submitter_name).toBe("Padded Name");
    expect(payload.submitter_email).toBe("padded@example.com");
  });
});
