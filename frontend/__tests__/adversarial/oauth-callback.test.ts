/**
 * ADVERSARIAL (red-team) tests for the Google OAuth callback
 * (app/api/contact/auth/google/callback/route.ts).
 *
 * Threat model derived FIRST:
 *   O1. Authorization: only a DIRECTOR may complete the connect flow and have a
 *       refresh token written to a profile. A member/client who somehow reaches
 *       the callback with a valid state must be redirected with reason=not_director
 *       and NO token write must occur.
 *   O2. Open redirect: the post-flow redirect target must always be the app's
 *       OWN /dashboard/settings (same origin as the request), never an
 *       attacker-controlled absolute URL. Attacker-controlled query values
 *       (e.g. ?error=...) must only appear as a *query parameter* of that
 *       same-origin URL, not as the redirect host.
 *   O3. Replay: the state cookie must be deleted as part of handling so a
 *       captured (cookie,state) pair can't be replayed on a second request.
 *
 * The existing google-oauth.test.ts covers the happy CSRF path. This suite adds
 * the authorization gate and open-redirect assertions it omits.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cookieJar = new Map<string, { value: string }>();
const mockCookieStore = {
  get: vi.fn((name: string) => {
    const e = cookieJar.get(name);
    return e ? { name, value: e.value } : undefined;
  }),
  set: vi.fn((name: string, value: string) => cookieJar.set(name, { value })),
  delete: vi.fn((name: string) => cookieJar.delete(name)),
};
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => mockCookieStore),
}));

const mockGetToken = vi.fn();
class MockOAuth2 {
  generateAuthUrl = vi.fn(() => "https://accounts.google.com/auth");
  getToken = mockGetToken;
}
vi.mock("googleapis", () => ({
  google: { auth: { OAuth2: MockOAuth2 } },
}));

let mockUser: unknown = { id: "user-123" };
let mockProfile: unknown = { id: "p1", role: "director", config: {} };
let mockProfileError: unknown = null;
const profileUpdateEq = vi.fn(async () => ({ error: null }));
const profileUpdate = vi.fn(() => ({ eq: profileUpdateEq }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({
            data: mockProfile,
            error: mockProfileError,
          })),
        })),
      })),
      update: profileUpdate,
    })),
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: mockUser }, error: null })),
    },
  })),
}));

process.env.GOOGLE_CLIENT_ID = "cid";
process.env.GOOGLE_CLIENT_SECRET = "csecret";
process.env.GOOGLE_REDIRECT_URI =
  "http://localhost/api/contact/auth/google/callback";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SECRET_KEY = "secret";

const { GET: callbackGET } = await import(
  "@/app/api/contact/auth/google/callback/route"
);

const VALID_STATE = "state-abc-123";

function makeReq(params: Record<string, string>, base = "http://localhost") {
  const url = new URL("/api/contact/auth/google/callback", base);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url.toString());
}

describe("ADVERSARIAL OAuth callback — authorization gate (O1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieJar.clear();
    cookieJar.set("google_oauth_state", { value: VALID_STATE });
    mockUser = { id: "user-123" };
    mockProfile = { id: "p1", role: "director", config: {} };
    mockProfileError = null;
    mockGetToken.mockResolvedValue({
      tokens: {
        refresh_token: "rt",
        access_token: "at",
        scope: "s",
        token_type: "Bearer",
        expiry_date: 1,
      },
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it("a MEMBER with a valid state is rejected (reason=not_director) and NO token is written", async () => {
    mockProfile = { id: "p1", role: "member", config: {} };
    const res = await callbackGET(makeReq({ code: "c", state: VALID_STATE }));
    const loc = res.headers.get("location") ?? "";
    expect(loc).toMatch(/google=error/);
    expect(loc).toMatch(/reason=not_director/);
    expect(profileUpdate).not.toHaveBeenCalled();
  });

  it("a CLIENT with a valid state is rejected and NO token is written", async () => {
    mockProfile = { id: "p1", role: "client", config: {} };
    const res = await callbackGET(makeReq({ code: "c", state: VALID_STATE }));
    expect(res.headers.get("location") ?? "").toMatch(/reason=not_director/);
    expect(profileUpdate).not.toHaveBeenCalled();
  });

  it("an unauthenticated caller (valid state) cannot write tokens", async () => {
    mockUser = null;
    const res = await callbackGET(makeReq({ code: "c", state: VALID_STATE }));
    expect(res.headers.get("location") ?? "").toMatch(/reason=unauthenticated/);
    expect(profileUpdate).not.toHaveBeenCalled();
  });
});

describe("ADVERSARIAL OAuth callback — open redirect (O2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieJar.clear();
    cookieJar.set("google_oauth_state", { value: VALID_STATE });
    mockUser = { id: "user-123" };
    mockProfile = { id: "p1", role: "director", config: {} };
    mockGetToken.mockResolvedValue({
      tokens: {
        refresh_token: "rt",
        access_token: "at",
        scope: "s",
        token_type: "Bearer",
        expiry_date: 1,
      },
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it("success redirect targets the SAME origin /dashboard/settings, not an external host", async () => {
    const res = await callbackGET(
      makeReq({ code: "c", state: VALID_STATE }, "https://portal.example.com"),
    );
    const loc = new URL(res.headers.get("location")!);
    expect(loc.origin).toBe("https://portal.example.com");
    expect(loc.pathname).toBe("/dashboard/settings");
  });

  it("attacker-controlled ?error value is reflected ONLY as a query param of the same-origin settings URL", async () => {
    // Provide an oauth `error` whose value tries to inject a different host.
    const evil = "https://evil.com/phish";
    const res = await callbackGET(
      makeReq(
        { state: VALID_STATE, error: evil },
        "https://portal.example.com",
      ),
    );
    const loc = new URL(res.headers.get("location")!);
    // The redirect must NOT navigate to evil.com — host stays the app's.
    expect(loc.origin).toBe("https://portal.example.com");
    expect(loc.pathname).toBe("/dashboard/settings");
    // The evil string is safely contained inside the `reason` query param.
    expect(loc.searchParams.get("reason")).toBe(evil);
  });

  it("does NOT honour a forged origin from a spoofed Host-style absolute URL in code", async () => {
    // The route derives origin from new URL(req.url).origin; ensure a code param
    // containing a URL cannot redirect off-site.
    const res = await callbackGET(
      makeReq(
        { code: "https://evil.com/steal", state: VALID_STATE },
        "https://portal.example.com",
      ),
    );
    const loc = new URL(res.headers.get("location")!);
    expect(loc.origin).toBe("https://portal.example.com");
  });
});

describe("ADVERSARIAL OAuth callback — replay protection (O3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieJar.clear();
    mockUser = { id: "user-123" };
    mockProfile = { id: "p1", role: "director", config: {} };
    mockGetToken.mockResolvedValue({
      tokens: {
        refresh_token: "rt",
        access_token: "at",
        scope: "s",
        token_type: "Bearer",
        expiry_date: 1,
      },
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it("a captured (cookie,state) pair cannot be replayed — second call has no cookie and 400s", async () => {
    cookieJar.set("google_oauth_state", { value: VALID_STATE });
    // First (legit) call consumes + deletes the cookie.
    const first = await callbackGET(makeReq({ code: "c", state: VALID_STATE }));
    expect(first.status).not.toBe(400);
    expect(mockCookieStore.delete).toHaveBeenCalledWith("google_oauth_state");
    expect(cookieJar.has("google_oauth_state")).toBe(false);

    // Replay the SAME state — cookie is gone, so CSRF guard rejects.
    const replay = await callbackGET(
      makeReq({ code: "c", state: VALID_STATE }),
    );
    expect(replay.status).toBe(400);
    expect(await replay.text()).toMatch(/invalid or missing oauth state/i);
  });
});
