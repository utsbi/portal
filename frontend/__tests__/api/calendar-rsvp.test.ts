/**
 * Tests for POST /api/contact/calendar/client-events/rsvp/route.ts
 *
 * Covers:
 *  - Invalid JSON body → 400
 *  - Missing / invalid request fields → 400
 *  - Invalid RSVP response value ("maybe") → 400
 *  - Unauthenticated request → 401
 *  - Caller profile not found → 404
 *  - Caller is not the project owner → 403
 *  - No directors linked to the project → 404
 *  - No director owns the given calendarId → 404
 *  - Director found but has no Google refresh token → 404
 *  - Google Calendar event cannot be fetched → 404
 *  - Caller's email not on the event attendees list → 403
 *  - Google patch error is REDACTED (raw Google error must not leak) → 502
 *  - Successful RSVP update → 200 { ok: true, response }
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mutable state (read by mock closures at call-time) ───────────────────────
let authUser: unknown = { id: "uid-123" };
let authError: unknown = null;

let callerProfileResult: { data: unknown; error: unknown } = {
  data: { id: "profile-1", email: "client@example.com" },
  error: null,
};

let ownershipResult: { data: unknown; error: unknown } = {
  data: { profile_id: "profile-1", role: "owner" },
  error: null,
};

let directorMembersResult: { data: unknown; error: unknown } = {
  data: [{ profile_id: "dir-1" }],
  error: null,
};

let directorsResult: { data: unknown; error: unknown } = {
  data: [
    {
      id: "dir-1",
      config: {
        google: {
          calendar_id: "cal-abc",
          refresh_token: "plain-refresh-token",
        },
      },
    },
  ],
  error: null,
};

let eventsGetShouldReject = false;
let eventsGetResult: unknown = {
  data: {
    attendees: [
      { email: "client@example.com", responseStatus: "needsAction" },
      { email: "other@example.com", responseStatus: "accepted" },
    ],
  },
};

let eventsPatchShouldThrow = false;
let eventsPatchError: unknown = new Error(
  "Google: CALENDAR_ACCESS_FORBIDDEN for cal-abc — contains internal scope hints",
);

// ─── googleapis mocks ─────────────────────────────────────────────────────────
const mockSetCredentials = vi.fn();
const mockEventsGet = vi.fn();
const mockEventsPatch = vi.fn();

class MockOAuth2 {
  constructor(_clientId: string, _clientSecret: string, _redirectUri: string) {}
  setCredentials = mockSetCredentials;
}

vi.mock("googleapis", () => ({
  google: {
    auth: { OAuth2: MockOAuth2 },
    // Returns the same mockEventsGet / mockEventsPatch references each time so
    // beforeEach re-implementations are always picked up.
    calendar: vi.fn(() => ({
      events: {
        get: mockEventsGet,
        patch: mockEventsPatch,
      },
    })),
  },
}));

// ─── @/lib/crypto/tokens mock ─────────────────────────────────────────────────
// decryptToken is called with the raw (possibly encrypted) refresh token.
// We return a deterministic "decrypted:" prefix so tests can assert it was called
// without needing a real AES key (TOKEN_ENCRYPTION_KEY is set in vitest.config.ts
// but we side-step actual crypto entirely by mocking the module).
vi.mock("@/lib/crypto/tokens", () => ({
  decryptToken: vi.fn((stored: string) => `decrypted:${stored}`),
}));

// ─── @/lib/supabase/server mock ───────────────────────────────────────────────
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: authUser },
        error: authError,
      })),
    },
  })),
}));

// ─── @/lib/supabase/admin mock ────────────────────────────────────────────────
// The route issues four distinct queries through createAdminClient():
//
//   from("profiles").select("id, email").eq(...).single()          → callerProfileResult
//   from("project_members").select("profile_id, role").eq(x3).maybeSingle()  → ownershipResult
//   from("project_members").select("profile_id").eq(x2)  [thenable]          → directorMembersResult
//   from("profiles").select("id, config").in(...)                  → directorsResult
//
// We dispatch on (table, select-column string) to return the appropriate chain.
const mockAdminFrom = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: mockAdminFrom,
  })),
}));

// ─── Env vars ─────────────────────────────────────────────────────────────────
process.env.GOOGLE_CLIENT_ID = "test-client-id";
process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
process.env.GOOGLE_REDIRECT_URI =
  "http://localhost/api/contact/auth/google/callback";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SECRET_KEY = "test-service-role-key";

// ─── Import route AFTER mocks ─────────────────────────────────────────────────
const { POST } = await import(
  "@/app/api/contact/calendar/client-events/rsvp/route"
);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function callPost(body: unknown) {
  return POST(
    new Request("http://localhost/api/contact/calendar/client-events/rsvp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    eventId: "evt-xyz",
    calendarId: "cal-abc",
    projectId: 7,
    response: "accepted",
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("POST /api/contact/calendar/client-events/rsvp", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset state to happy-path defaults.
    authUser = { id: "uid-123" };
    authError = null;

    callerProfileResult = {
      data: { id: "profile-1", email: "client@example.com" },
      error: null,
    };

    ownershipResult = {
      data: { profile_id: "profile-1", role: "owner" },
      error: null,
    };

    directorMembersResult = {
      data: [{ profile_id: "dir-1" }],
      error: null,
    };

    directorsResult = {
      data: [
        {
          id: "dir-1",
          config: {
            google: {
              calendar_id: "cal-abc",
              refresh_token: "plain-refresh-token",
            },
          },
        },
      ],
      error: null,
    };

    eventsGetShouldReject = false;
    eventsGetResult = {
      data: {
        attendees: [
          { email: "client@example.com", responseStatus: "needsAction" },
          { email: "other@example.com", responseStatus: "accepted" },
        ],
      },
    };

    eventsPatchShouldThrow = false;
    eventsPatchError = new Error(
      "Google: CALENDAR_ACCESS_FORBIDDEN for cal-abc — contains internal scope hints",
    );

    // Re-wire event mocks (clearAllMocks wipes mockImplementation).
    mockEventsGet.mockImplementation(async () => {
      if (eventsGetShouldReject) throw new Error("Event not found");
      return eventsGetResult;
    });

    mockEventsPatch.mockImplementation(async () => {
      if (eventsPatchShouldThrow) throw eventsPatchError;
      return { data: {} };
    });

    // Re-wire admin from() dispatch.
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockImplementation((cols: string) => {
            if (cols === "id, email") {
              // Caller profile: .eq("uid", authUser.id).single()
              return {
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue(callerProfileResult),
                }),
              };
            }
            // "id, config" — directors: .in("id", directorIds)
            return {
              in: vi.fn().mockResolvedValue(directorsResult),
            };
          }),
        };
      }

      if (table === "project_members") {
        return {
          select: vi.fn().mockImplementation((cols: string) => {
            if (cols === "profile_id, role") {
              // Ownership check: .eq(x3).maybeSingle()
              const deep: {
                eq: ReturnType<typeof vi.fn>;
                maybeSingle: ReturnType<typeof vi.fn>;
              } = {
                eq: vi.fn(),
                maybeSingle: vi.fn().mockResolvedValue(ownershipResult),
              };
              deep.eq.mockReturnValue(deep);
              return { eq: vi.fn().mockReturnValue(deep) };
            }
            // "profile_id" — directors list: .eq(x2), awaited as thenable
            const chain: {
              eq: ReturnType<typeof vi.fn>;
              // biome-ignore lint/suspicious/noThenProperty: intentional thenable — mirrors Supabase's await-able query builder
              then: (
                onF: (v: unknown) => unknown,
                onR?: (e: unknown) => unknown,
              ) => Promise<unknown>;
            } = {
              eq: vi.fn(),
              then: (onF, onR) =>
                Promise.resolve(directorMembersResult).then(onF, onR),
            };
            chain.eq.mockReturnValue(chain);
            return chain;
          }),
        };
      }

      return { select: vi.fn() };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 400: invalid JSON ──────────────────────────────────────────────────────
  it("returns 400 when the request body is not valid JSON", async () => {
    const res = await POST(
      new Request("http://localhost/api/contact/calendar/client-events/rsvp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not json {{",
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid json/i);
  });

  // ── 400: missing required fields ──────────────────────────────────────────
  it("returns 400 when required fields are missing from the body", async () => {
    // eventId present but calendarId, projectId, response all missing.
    const res = await callPost({ eventId: "evt-xyz" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/missing or invalid/i);
  });

  // ── 400: invalid RSVP response value ─────────────────────────────────────
  it('returns 400 when "response" is not one of accepted/declined/tentative', async () => {
    const res = await callPost(validBody({ response: "maybe" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/missing or invalid/i);
  });

  // ── 401: unauthenticated ──────────────────────────────────────────────────
  it("returns 401 when the request has no valid session", async () => {
    authUser = null;
    authError = { message: "JWT expired" };
    const res = await callPost(validBody());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });

  // ── 404: caller profile not found ─────────────────────────────────────────
  it("returns 404 when the authenticated user has no profile row", async () => {
    callerProfileResult = {
      data: null,
      error: { message: "No profile row for this uid" },
    };
    const res = await callPost(validBody());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/profile not found/i);
  });

  // ── 403: caller is not the project owner ─────────────────────────────────
  it("returns 403 when the caller is not the project owner", async () => {
    ownershipResult = { data: null, error: null };
    const res = await callPost(validBody());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/only project owners/i);
  });

  // ── 404: no directors on the project ─────────────────────────────────────
  it("returns 404 when there are no directors linked to the project", async () => {
    directorMembersResult = { data: [], error: null };
    const res = await callPost(validBody());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/no directors/i);
  });

  // ── 404: no director owns the requested calendarId ────────────────────────
  it("returns 404 when no director has the given calendarId in their config", async () => {
    directorsResult = {
      data: [
        {
          id: "dir-1",
          config: {
            google: {
              calendar_id: "completely-different-cal",
              refresh_token: "rt",
            },
          },
        },
      ],
      error: null,
    };
    const res = await callPost(validBody());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/calendar not connected/i);
  });

  // ── 404: director has no Google refresh token stored ─────────────────────
  it("returns 404 when the matched director has no refresh token in config", async () => {
    directorsResult = {
      data: [
        {
          id: "dir-1",
          config: {
            google: { calendar_id: "cal-abc" }, // refresh_token intentionally absent
          },
        },
      ],
      error: null,
    };
    const res = await callPost(validBody());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/google account is not connected/i);
  });

  // ── 404: Google Calendar event not found ─────────────────────────────────
  it("returns 404 when the Google Calendar event cannot be fetched", async () => {
    eventsGetShouldReject = true;
    const res = await callPost(validBody());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/couldn't find the event/i);
  });

  // ── 403: caller not on the attendees list ────────────────────────────────
  it("returns 403 when the caller's email is not on the event attendee list", async () => {
    eventsGetResult = {
      data: {
        attendees: [
          // Neither entry matches "client@example.com".
          { email: "director@example.com", responseStatus: "accepted" },
          { email: "someone-else@example.com", responseStatus: "tentative" },
        ],
      },
    };
    const res = await callPost(validBody());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/not on the attendees list/i);
  });

  // ── 502: Google patch error is REDACTED ──────────────────────────────────
  it("returns 502 and does NOT leak the raw Google error message to the client", async () => {
    eventsPatchShouldThrow = true;
    eventsPatchError = new Error(
      "Google rejected: CALENDAR_ACCESS_FORBIDDEN cal-abc scope=calendar.events.readonly",
    );
    const res = await callPost(validBody());
    expect(res.status).toBe(502);
    const body = await res.json();
    // User-facing message must be generic.
    expect(body.error).toMatch(/couldn't save your rsvp/i);
    // Raw Google internals must NOT appear anywhere in the response body.
    const serialised = JSON.stringify(body);
    expect(serialised).not.toMatch(/CALENDAR_ACCESS_FORBIDDEN/);
    expect(serialised).not.toMatch(/cal-abc/);
    expect(serialised).not.toMatch(/scope/);
  });

  // ── 200: successful RSVP update ───────────────────────────────────────────
  it("returns 200 with { ok: true, response } on a successful RSVP update", async () => {
    const res = await callPost(validBody({ response: "declined" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.response).toBe("declined");
  });

  // ── accepts all valid RSVP values ─────────────────────────────────────────
  it.each([
    "accepted",
    "tentative",
    "declined",
  ] as const)('accepts "%s" as a valid RSVP value and returns 200', async (response) => {
    const res = await callPost(validBody({ response }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.response).toBe(response);
  });
});
