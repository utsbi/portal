/**
 * Tests for Google OAuth CSRF-state fix.
 *
 * Covers:
 *  Connect route (app/api/contact/auth/google/route.ts):
 *  - Sets google_oauth_state cookie (httpOnly, sameSite lax)
 *  - Includes matching state in the generated Google auth redirect URL
 *
 *  Callback route (app/api/contact/auth/google/callback/route.ts):
 *  - Returns 400 when state cookie is absent
 *  - Returns 400 when state query param is absent
 *  - Returns 400 when cookie and param are present but differ
 *  - Proceeds to token exchange (does NOT 400) when cookie === param
 *  - Deletes the state cookie during callback handling
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Shared state ─────────────────────────────────────────────────────────────
const FIXED_UUID = "aaaabbbb-cccc-dddd-eeee-ffffffffffff";

// ─── crypto.randomUUID stub ───────────────────────────────────────────────────
// Applied before any module import so the connect route always gets our UUID.
vi.stubGlobal("crypto", {
  ...globalThis.crypto,
  randomUUID: vi.fn(() => FIXED_UUID),
});

// ─── Cookie store mock ────────────────────────────────────────────────────────
// We share a single mutable cookie jar so both routes operate on the same
// in-memory store, matching how Next.js cookies() works in a real request.
const cookieJar = new Map<string, { value: string; options?: unknown }>();

const mockCookieStore = {
  get: vi.fn((name: string) => {
    const entry = cookieJar.get(name);
    return entry ? { name, value: entry.value } : undefined;
  }),
  set: vi.fn((name: string, value: string, options?: unknown) => {
    cookieJar.set(name, { value, options });
  }),
  delete: vi.fn((name: string) => {
    cookieJar.delete(name);
  }),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => mockCookieStore),
}));

// ─── googleapis mock ──────────────────────────────────────────────────────────
// We intercept generateAuthUrl so we can assert the state param, and getToken
// so we can verify the exchange path is (or is not) reached.
// OAuth2 is used with `new`, so the mock must be a real class / constructor.
const mockGetToken = vi.fn();
const mockGenerateAuthUrl = vi.fn((opts: Record<string, unknown>) => {
  const url = new URL("https://accounts.google.com/o/oauth2/auth");
  if (opts.state) url.searchParams.set("state", opts.state as string);
  if (opts.scope) {
    const scopes = Array.isArray(opts.scope)
      ? opts.scope.join(" ")
      : opts.scope;
    url.searchParams.set("scope", scopes as string);
  }
  return url.toString();
});

class MockOAuth2 {
  generateAuthUrl = mockGenerateAuthUrl;
  getToken = mockGetToken;
}

vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: MockOAuth2,
    },
  },
}));

// ─── Supabase mocks ───────────────────────────────────────────────────────────
// The callback route uses two Supabase clients:
//   1. @/lib/supabase/server  — auth.getUser()
//   2. @supabase/supabase-js  — admin client for profile select + update

let mockUser: unknown = { id: "user-123" };
let mockProfile: unknown = {
  id: "profile-456",
  role: "director",
  config: {},
};
let mockProfileError: unknown = null;
let mockUpdateError: unknown = null;

const mockUpdateChain = {
  eq: vi.fn(),
};
mockUpdateChain.eq.mockResolvedValue({ error: null });

const mockSelectChain = {
  select: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
};
mockSelectChain.select.mockReturnValue(mockSelectChain);
mockSelectChain.eq.mockReturnValue(mockSelectChain);

const mockAdminFrom = vi.fn((_table: string) => ({
  select: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      single: vi.fn().mockImplementation(async () => ({
        data: mockProfile,
        error: mockProfileError,
      })),
    }),
  }),
  update: vi.fn().mockReturnValue({
    eq: vi.fn().mockImplementation(async () => ({
      error: mockUpdateError,
    })),
  }),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: mockAdminFrom,
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: mockUser },
        error: null,
      })),
    },
  })),
}));

// ─── Env vars ─────────────────────────────────────────────────────────────────
process.env.GOOGLE_CLIENT_ID = "test-client-id";
process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
process.env.GOOGLE_REDIRECT_URI =
  "http://localhost/api/contact/auth/google/callback";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SECRET_KEY = "test-secret-key";

// ─── Import routes AFTER mocks ────────────────────────────────────────────────
const { GET: connectGET } = await import("@/app/api/contact/auth/google/route");
const { GET: callbackGET } = await import(
  "@/app/api/contact/auth/google/callback/route"
);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeCallbackRequest(params: Record<string, string>) {
  const url = new URL("http://localhost/api/contact/auth/google/callback");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString());
}

// ─── Connect route tests ──────────────────────────────────────────────────────
describe("GET /api/contact/auth/google (connect)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieJar.clear();
    // Re-stub because clearAllMocks wipes mockReturnValue etc.
    mockCookieStore.get.mockImplementation((name: string) => {
      const entry = cookieJar.get(name);
      return entry ? { name, value: entry.value } : undefined;
    });
    mockCookieStore.set.mockImplementation(
      (name: string, value: string, options?: unknown) => {
        cookieJar.set(name, { value, options });
      },
    );
    mockCookieStore.delete.mockImplementation((name: string) => {
      cookieJar.delete(name);
    });
    (crypto.randomUUID as ReturnType<typeof vi.fn>).mockReturnValue(FIXED_UUID);
    mockGenerateAuthUrl.mockImplementation((opts: Record<string, unknown>) => {
      const url = new URL("https://accounts.google.com/o/oauth2/auth");
      if (opts.state) url.searchParams.set("state", opts.state as string);
      return url.toString();
    });
    // Reset mockGetToken to a no-op default for connect tests.
    mockGetToken.mockResolvedValue({ tokens: { refresh_token: null } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sets the google_oauth_state cookie with httpOnly and sameSite lax", async () => {
    await connectGET();

    expect(mockCookieStore.set).toHaveBeenCalledOnce();
    const [name, value, options] = mockCookieStore.set.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ];
    expect(name).toBe("google_oauth_state");
    expect(value).toBe(FIXED_UUID);
    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      maxAge: 600,
    });
  });

  it("includes the state value in the Google auth redirect URL", async () => {
    const response = await connectGET();

    // The route returns a redirect — location header holds the Google URL.
    const location = response.headers.get("location");
    expect(location).not.toBeNull();
    const redirectUrl = new URL(location as string);
    expect(redirectUrl.searchParams.get("state")).toBe(FIXED_UUID);
  });

  it("uses the same state value in both the cookie and the redirect URL", async () => {
    const response = await connectGET();

    const setCookieCall = mockCookieStore.set.mock.calls[0] as [string, string];
    const cookieState = setCookieCall[1];

    const location = response.headers.get("location") as string;
    const urlState = new URL(location).searchParams.get("state");

    expect(cookieState).toBe(urlState);
  });
});

// ─── Callback route tests ─────────────────────────────────────────────────────
describe("GET /api/contact/auth/google/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieJar.clear();

    // Restore cookie store behaviour.
    mockCookieStore.get.mockImplementation((name: string) => {
      const entry = cookieJar.get(name);
      return entry ? { name, value: entry.value } : undefined;
    });
    mockCookieStore.set.mockImplementation(
      (name: string, value: string, options?: unknown) => {
        cookieJar.set(name, { value, options });
      },
    );
    mockCookieStore.delete.mockImplementation((name: string) => {
      cookieJar.delete(name);
    });

    // Default: user is a director and token exchange succeeds.
    mockUser = { id: "user-123" };
    mockProfile = { id: "profile-456", role: "director", config: {} };
    mockProfileError = null;
    mockUpdateError = null;
    mockGetToken.mockResolvedValue({
      tokens: {
        refresh_token: "rt-abc",
        access_token: "at-xyz",
        scope: "calendar",
        token_type: "Bearer",
        expiry_date: 9999999999,
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── CSRF guard: missing cookie ─────────────────────────────────────────────
  it("returns 400 when the state cookie is absent", async () => {
    // No cookie seeded — jar is empty.
    const req = makeCallbackRequest({
      code: "auth-code",
      state: FIXED_UUID,
    });
    const res = await callbackGET(req);
    expect(res.status).toBe(400);
    expect(await res.text()).toMatch(/invalid or missing oauth state/i);
  });

  // ── CSRF guard: missing query param ───────────────────────────────────────
  it("returns 400 when the state query param is absent", async () => {
    cookieJar.set("google_oauth_state", { value: FIXED_UUID });
    // No state param in the URL.
    const req = makeCallbackRequest({ code: "auth-code" });
    const res = await callbackGET(req);
    expect(res.status).toBe(400);
    expect(await res.text()).toMatch(/invalid or missing oauth state/i);
  });

  // ── CSRF guard: mismatch ───────────────────────────────────────────────────
  it("returns 400 when cookie and state param do not match", async () => {
    cookieJar.set("google_oauth_state", { value: FIXED_UUID });
    const req = makeCallbackRequest({
      code: "auth-code",
      state: "totally-different-state",
    });
    const res = await callbackGET(req);
    expect(res.status).toBe(400);
    expect(await res.text()).toMatch(/invalid or missing oauth state/i);
  });

  // ── CSRF guard: match → token exchange reached ─────────────────────────────
  it("does NOT return 400 and reaches token exchange when cookie === param", async () => {
    cookieJar.set("google_oauth_state", { value: FIXED_UUID });
    const req = makeCallbackRequest({
      code: "auth-code",
      state: FIXED_UUID,
    });
    const res = await callbackGET(req);
    // Should not be a CSRF rejection.
    expect(res.status).not.toBe(400);
    // getToken must have been called with the auth code.
    expect(mockGetToken).toHaveBeenCalledWith("auth-code");
  });

  // ── Cookie deletion ────────────────────────────────────────────────────────
  it("deletes the google_oauth_state cookie during callback handling", async () => {
    cookieJar.set("google_oauth_state", { value: FIXED_UUID });
    const req = makeCallbackRequest({
      code: "auth-code",
      state: FIXED_UUID,
    });
    await callbackGET(req);
    expect(mockCookieStore.delete).toHaveBeenCalledWith("google_oauth_state");
  });

  it("deletes the cookie even when the CSRF check fails (state mismatch)", async () => {
    cookieJar.set("google_oauth_state", { value: FIXED_UUID });
    const req = makeCallbackRequest({
      code: "auth-code",
      state: "wrong-state",
    });
    await callbackGET(req);
    expect(mockCookieStore.delete).toHaveBeenCalledWith("google_oauth_state");
  });

  // ── Token exchange NOT reached on CSRF failure ─────────────────────────────
  it("does NOT call getToken when CSRF check fails", async () => {
    cookieJar.set("google_oauth_state", { value: FIXED_UUID });
    const req = makeCallbackRequest({
      code: "auth-code",
      state: "mismatched",
    });
    await callbackGET(req);
    expect(mockGetToken).not.toHaveBeenCalled();
  });

  // ── Successful flow redirects to settings with google=connected ────────────
  it("redirects to settings with google=connected on success", async () => {
    cookieJar.set("google_oauth_state", { value: FIXED_UUID });
    const req = makeCallbackRequest({
      code: "auth-code",
      state: FIXED_UUID,
    });
    const res = await callbackGET(req);
    const location = res.headers.get("location") ?? "";
    expect(location).toMatch(/google=connected/);
  });
});
