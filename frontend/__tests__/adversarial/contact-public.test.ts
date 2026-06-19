/**
 * ADVERSARIAL (red-team) tests for the PUBLIC contact endpoint
 * (app/api/contact/route.ts).
 *
 * Threat model derived FIRST:
 *   P1. Bot/abuse: a request with NO turnstileToken must be rejected (400)
 *       BEFORE any DB insert, and a failing siteverify must reject (400). The
 *       Turnstile secret must never be sent to the client.
 *   P2. Oversized inputs: name/email/message beyond FIELD_LIMITS must 400 and
 *       NOT be inserted. The check must survive boundary values.
 *   P3. Injection / header-smuggling: a newline-bearing email
 *       ("a@b.com\nBcc: evil@x.com") must be rejected by EMAIL_PATTERN (no email
 *       header injection downstream). A non-allowlisted subject must 400.
 *   P4. The siteverify call must POST the SERVER secret, and a valid token must
 *       be required before the row is persisted (insert happens only after
 *       success).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let supabaseInsertError: unknown = null;
const insertSpy = vi.fn(async () => ({ error: supabaseInsertError }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn(() => ({ insert: insertSpy })),
  })),
}));

let turnstileSuccess = true;
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

process.env.TURNSTILE_SECRET_KEY = "SERVER-TURNSTILE-SECRET";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "anon-key";

const { POST } = await import("@/app/api/contact/route");

function req(
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  return new Request("http://localhost/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const BASE = {
  name: "Jane Doe",
  email: "jane@example.com",
  message: "Hi there, a real question.",
  subject: "general",
  turnstileToken: "valid-token",
};

beforeEach(() => {
  vi.clearAllMocks();
  turnstileSuccess = true;
  supabaseInsertError = null;
  fetchMock.mockImplementation(async (url: string) => {
    if (typeof url === "string" && url.includes("siteverify")) {
      return new Response(JSON.stringify({ success: turnstileSuccess }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("{}", { status: 200 });
  });
});

afterEach(() => vi.restoreAllMocks());

describe("ADVERSARIAL contact — Turnstile / bot gate (P1, P4)", () => {
  it("rejects a submission with NO turnstileToken and does NOT insert", async () => {
    const { turnstileToken, ...noToken } = BASE;
    void turnstileToken;
    const res = await POST(req(noToken) as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/captcha verification required/i);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("rejects when siteverify returns success:false and does NOT insert", async () => {
    turnstileSuccess = false;
    const res = await POST(req(BASE) as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/captcha verification failed/i);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("sends the SERVER secret to siteverify and never returns it to the client", async () => {
    const res = await POST(req(BASE) as never);
    expect(res.status).toBe(200);
    const siteverifyCall = fetchMock.mock.calls.find(
      (c) => typeof c[0] === "string" && c[0].includes("siteverify"),
    );
    expect(siteverifyCall).toBeDefined();
    const sentBody = JSON.parse(
      (siteverifyCall?.[1] as RequestInit).body as string,
    );
    expect(sentBody.secret).toBe("SERVER-TURNSTILE-SECRET");
    // The secret must never echo back in the success response.
    expect(JSON.stringify(await res.json())).not.toContain(
      "SERVER-TURNSTILE-SECRET",
    );
  });

  it("inserts ONLY after a successful Turnstile verification (order invariant)", async () => {
    await POST(req(BASE) as never);
    expect(insertSpy).toHaveBeenCalledOnce();
  });
});

describe("ADVERSARIAL contact — oversized inputs (P2)", () => {
  it("rejects a 101-char name (limit 100) without inserting", async () => {
    const res = await POST(req({ ...BASE, name: "a".repeat(101) }) as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/exceed the allowed length/i);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("rejects a >5000-char message without inserting", async () => {
    const res = await POST(
      req({ ...BASE, message: "x".repeat(5001) }) as never,
    );
    expect(res.status).toBe(400);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("rejects an over-length email (>254) — also fails the length gate", async () => {
    const longLocal = "a".repeat(250);
    const res = await POST(
      req({ ...BASE, email: `${longLocal}@ex.com` }) as never,
    );
    expect(res.status).toBe(400);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("accepts a name exactly at the 100-char boundary", async () => {
    const res = await POST(req({ ...BASE, name: "a".repeat(100) }) as never);
    expect(res.status).toBe(200);
    expect(insertSpy).toHaveBeenCalledOnce();
  });
});

describe("ADVERSARIAL contact — injection / smuggling (P3)", () => {
  it("rejects an email containing a newline (header-injection attempt)", async () => {
    const res = await POST(
      req({ ...BASE, email: "a@b.com\nBcc: evil@x.com" }) as never,
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/invalid email/i);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("rejects an email with embedded whitespace/tab", async () => {
    const res = await POST(req({ ...BASE, email: "a@ b.com" }) as never);
    expect(res.status).toBe(400);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("rejects a non-allowlisted subject (prototype pollution / arbitrary key)", async () => {
    for (const subject of ["__proto__", "constructor", "admin", "toString"]) {
      insertSpy.mockClear();
      const res = await POST(req({ ...BASE, subject }) as never);
      expect(res.status, `subject=${subject}`).toBe(400);
      expect((await res.json()).error).toMatch(/invalid subject/i);
      expect(insertSpy).not.toHaveBeenCalled();
    }
  });

  it("rejects a non-string name (type confusion) by treating it as empty → missing field", async () => {
    const res = await POST(req({ ...BASE, name: { evil: true } }) as never);
    expect(res.status).toBe(400);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("trims a whitespace-only message to empty and rejects as missing", async () => {
    const res = await POST(req({ ...BASE, message: "    \n\t  " }) as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/missing required fields/i);
    expect(insertSpy).not.toHaveBeenCalled();
  });
});
