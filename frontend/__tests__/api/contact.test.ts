/**
 * Tests for app/api/contact/route.ts  POST handler.
 *
 * Covers:
 *  - Missing required fields → 400
 *  - Field length limits → 400
 *  - Invalid email → 400
 *  - Invalid subject → 400
 *  - Missing Turnstile token → 400
 *  - Missing TURNSTILE_SECRET_KEY env var → 500
 *  - Turnstile verification fails → 400
 *  - Supabase insert error → 500
 *  - Happy path → 200
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Supabase server mock ─────────────────────────────────────────────────────
let supabaseInsertError: unknown = null;

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      insert: vi.fn(async () => ({ error: supabaseInsertError })),
    })),
  })),
}));

// ─── fetch mock (Turnstile + Discord webhook) ─────────────────────────────────
let turnstileSuccess = true;
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

// Set env vars.
process.env.TURNSTILE_SECRET_KEY = "test-turnstile-secret";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "anon-key";

// Import AFTER mocks.
const { POST } = await import("@/app/api/contact/route");

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  name: "Jane Doe",
  email: "jane@example.com",
  message: "Hello, I have a question.",
  subject: "general",
  turnstileToken: "cf-token-valid",
};

describe("POST /api/contact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    turnstileSuccess = true;
    supabaseInsertError = null;
    process.env.TURNSTILE_SECRET_KEY = "test-turnstile-secret";

    // Default fetch: Turnstile succeeds, Discord webhook succeeds.
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("cloudflare.com")) {
        return new Response(JSON.stringify({ success: turnstileSuccess }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      // Discord webhook
      return new Response("OK", { status: 204 });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Missing required fields ─────────────────────────────────────────────
  it("returns 400 when name is missing", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, name: "" }) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/missing required fields/i);
  });

  it("returns 400 when email is missing", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, email: "" }) as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 when message is missing", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, message: "" }) as never);
    expect(res.status).toBe(400);
  });

  // ── Field length limits ─────────────────────────────────────────────────
  it("returns 400 when name exceeds 100 characters", async () => {
    const res = await POST(
      makeRequest({ ...VALID_BODY, name: "a".repeat(101) }) as never,
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/exceed.*allowed length/i);
  });

  it("returns 400 when message exceeds 5000 characters", async () => {
    const res = await POST(
      makeRequest({ ...VALID_BODY, message: "x".repeat(5001) }) as never,
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when email exceeds 254 characters", async () => {
    // 249 'a' chars + "@b.com" = 255 chars, which exceeds the 254-char limit
    const longEmail = `${"a".repeat(249)}@b.com`;
    expect(longEmail.length).toBe(255);
    const res = await POST(
      makeRequest({ ...VALID_BODY, email: longEmail }) as never,
    );
    expect(res.status).toBe(400);
  });

  // ── Invalid email ────────────────────────────────────────────────────────
  it("returns 400 for an invalid email address", async () => {
    const res = await POST(
      makeRequest({ ...VALID_BODY, email: "not-an-email" }) as never,
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid email/i);
  });

  // ── Invalid subject ──────────────────────────────────────────────────────
  it("returns 400 for an unrecognised subject", async () => {
    const res = await POST(
      makeRequest({ ...VALID_BODY, subject: "hacking" }) as never,
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid subject/i);
  });

  it("accepts all valid subjects", async () => {
    for (const subject of ["general", "project", "membership", "partnership"]) {
      const res = await POST(makeRequest({ ...VALID_BODY, subject }) as never);
      expect(res.status, `subject "${subject}" should be accepted`).toBe(200);
    }
  });

  // ── Missing Turnstile token ──────────────────────────────────────────────
  it("returns 400 when turnstileToken is absent", async () => {
    const { turnstileToken: _drop, ...withoutToken } = VALID_BODY;
    const res = await POST(makeRequest(withoutToken) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/captcha verification required/i);
  });

  // ── Missing TURNSTILE_SECRET_KEY env var ─────────────────────────────────
  it("returns 500 when TURNSTILE_SECRET_KEY is not configured", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    const res = await POST(makeRequest(VALID_BODY) as never);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/server configuration error/i);
    // Restore for other tests.
    process.env.TURNSTILE_SECRET_KEY = "test-turnstile-secret";
  });

  // ── Turnstile verification fails ─────────────────────────────────────────
  it("returns 400 when Turnstile verification fails", async () => {
    turnstileSuccess = false;
    const res = await POST(makeRequest(VALID_BODY) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/captcha verification failed/i);
  });

  // ── Supabase insert error ────────────────────────────────────────────────
  it("returns 500 when the Supabase insert fails", async () => {
    supabaseInsertError = { message: "unique_violation" };
    const res = await POST(makeRequest(VALID_BODY) as never);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/failed to submit form/i);
  });

  // ── Happy path ───────────────────────────────────────────────────────────
  it("returns 200 on a valid submission", async () => {
    const res = await POST(makeRequest(VALID_BODY) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("calls Turnstile with the provided token", async () => {
    await POST(makeRequest(VALID_BODY) as never);
    const turnstileCall = fetchMock.mock.calls.find((call: unknown[]) =>
      String(call[0]).includes("cloudflare.com"),
    );
    expect(turnstileCall).toBeDefined();
    const init = turnstileCall![1] as RequestInit;
    const sentBody = JSON.parse(init.body as string);
    expect(sentBody.response).toBe(VALID_BODY.turnstileToken);
    expect(sentBody.secret).toBe("test-turnstile-secret");
  });

  // ── Discord webhook failure does not fail the request ───────────────────
  it("still returns 200 even when Discord webhook fails", async () => {
    process.env.DISCORD_CONTACT_WEBHOOK_URL = "https://discord.example.com/webhook";
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("cloudflare.com")) {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      // Discord webhook returns error
      return new Response("Bad Request", { status: 400 });
    });

    const res = await POST(makeRequest(VALID_BODY) as never);
    expect(res.status).toBe(200);
    delete process.env.DISCORD_CONTACT_WEBHOOK_URL;
  });
});
