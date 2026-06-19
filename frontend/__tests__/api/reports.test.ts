/**
 * Tests for app/api/reports/route.ts  GET handler.
 *
 * The route uses createServerClient from @supabase/ssr directly (not the
 * @/lib/supabase/server wrapper), so we mock @supabase/ssr and next/headers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Minimal cookie store mock ───────────────────────────────────────────────
const cookieStoreMock = {
  getAll: vi.fn(() => []),
  set: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStoreMock),
}));

// ─── Supabase mock ────────────────────────────────────────────────────────────
// The route calls createServerClient from @supabase/ssr with a cookie adapter.
// We intercept the call and return a configurable mock client.

type MockChain = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  _resolve: (v: { data: unknown; error: unknown }) => void;
  // Make the chain thenable so `await query` (list query, no .single()) works.
  then: (
    onFulfilled: (v: unknown) => unknown,
    onRejected?: (e: unknown) => unknown,
  ) => Promise<unknown>;
};

function makeChain(
  result: { data: unknown; error: unknown } = { data: null, error: null },
): MockChain {
  let resolveWith = result;
  const chain: MockChain = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
    order: vi.fn(),
    _resolve: (v) => {
      resolveWith = v;
    },
    // biome-ignore lint/suspicious/noThenProperty: intentional thenable — mocks Supabase's await-able query builder for list queries
    then: (onFulfilled, onRejected) =>
      Promise.resolve(resolveWith).then(onFulfilled, onRejected),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.single.mockImplementation(async () => resolveWith);
  chain.order.mockReturnValue(chain);
  return chain;
}

// Mutable state shared between tests.
let authResult: { data: { user: unknown }; error: unknown } = {
  data: { user: null },
  error: { message: "Not authenticated" },
};
let profileResult: { data: unknown; error: unknown } = {
  data: null,
  error: { message: "Not found" },
};
let membershipResult: { data: unknown; error: unknown } = {
  data: null,
  error: { message: "Not member" },
};
let ticketsResult: { data: unknown; error: unknown } = {
  data: [],
  error: null,
};

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => authResult),
    },
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return makeChain(profileResult);
      }
      if (table === "project_members") {
        return makeChain(membershipResult);
      }
      if (table === "tickets") {
        // List query — no .single(); awaited directly.
        const c = makeChain(ticketsResult);
        // Also override .eq to keep returning the chain (for chained .eq().eq())
        return c;
      }
      return makeChain({ data: null, error: null });
    }),
  })),
}));

// Set env vars before importing the route.
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "anon-key";

// Import AFTER mocks are set up.
const { GET } = await import("@/app/api/reports/route");

// Helper to call GET with a URL.
function callGet(url = "http://localhost/api/reports") {
  return GET(new Request(url));
}

describe("GET /api/reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieStoreMock.getAll.mockReturnValue([]);
    authResult = {
      data: { user: null },
      error: { message: "Not authenticated" },
    };
    profileResult = { data: null, error: { message: "Not found" } };
    membershipResult = { data: null, error: { message: "Not member" } };
    ticketsResult = { data: [], error: null };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 401 when unauthenticated ─────────────────────────────────────────────
  it("returns 401 when there is no authenticated user", async () => {
    authResult = {
      data: { user: null },
      error: { message: "Not authenticated" },
    };

    const res = await callGet();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/not authenticated/i);
  });

  // ── 403 when profile is missing ──────────────────────────────────────────
  it("returns 403 when the user has no profile row", async () => {
    authResult = { data: { user: { id: "uid-1" } }, error: null };
    profileResult = { data: null, error: { message: "No profile" } };

    const res = await callGet();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/profile not found/i);
  });

  // ── 400 when non-director omits project_id ───────────────────────────────
  it("returns 400 when a non-director omits project_id", async () => {
    authResult = { data: { user: { id: "uid-member" } }, error: null };
    profileResult = { data: { id: 10, role: "member" }, error: null };

    const res = await callGet("http://localhost/api/reports");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/project_id is required/i);
  });

  // ── 403 when non-director is not a member of the requested project ───────
  it("returns 403 when a non-director is not a member of the given project", async () => {
    authResult = { data: { user: { id: "uid-member" } }, error: null };
    profileResult = { data: { id: 10, role: "member" }, error: null };
    membershipResult = { data: null, error: { message: "Not found" } };

    const res = await callGet("http://localhost/api/reports?project_id=5");
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/forbidden/i);
  });

  // ── 200 when a member IS a member of the requested project ──────────────
  it("returns 200 and reports for a project member", async () => {
    authResult = { data: { user: { id: "uid-member" } }, error: null };
    profileResult = { data: { id: 10, role: "member" }, error: null };
    membershipResult = { data: { project_id: 5 }, error: null };
    ticketsResult = {
      data: [
        {
          id: "1",
          title: "Test Report",
          department: "Engineering",
          director: "Alice",
          status: "pending",
          created_at: "2024-01-01T00:00:00Z",
          projects: { company_name: "Acme" },
        },
      ],
      error: null,
    };

    const res = await callGet("http://localhost/api/reports?project_id=5");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].title).toBe("Test Report");
    expect(body[0].project).toBe("Acme");
    expect(body[0].status).toBe("Pending");
  });

  // ── 200 for a director without project_id ────────────────────────────────
  it("returns 200 for a director who omits project_id (scans all)", async () => {
    authResult = { data: { user: { id: "uid-director" } }, error: null };
    profileResult = { data: { id: 1, role: "director" }, error: null };
    ticketsResult = {
      data: [
        {
          id: "2",
          title: "Director Report",
          department: "General",
          director: "Bob",
          status: "done",
          created_at: "2024-02-01T00:00:00Z",
          projects: null,
        },
      ],
      error: null,
    };

    const res = await callGet("http://localhost/api/reports");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].status).toBe("Done");
  });

  // ── 200 for a director WITH project_id ───────────────────────────────────
  it("returns 200 for a director who provides project_id (scoped)", async () => {
    authResult = { data: { user: { id: "uid-director" } }, error: null };
    profileResult = { data: { id: 1, role: "director" }, error: null };
    ticketsResult = { data: [], error: null };

    const res = await callGet("http://localhost/api/reports?project_id=99");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  // ── Status normalisation ─────────────────────────────────────────────────
  it("normalises various status strings correctly", async () => {
    authResult = { data: { user: { id: "uid-director" } }, error: null };
    profileResult = { data: { id: 1, role: "director" }, error: null };

    const statuses = [
      { raw: "completed", expected: "Done" },
      { raw: "in_progress", expected: "In Progress" },
      { raw: "active", expected: "In Progress" },
      { raw: "rejected", expected: "Denied" },
      { raw: "unknown", expected: "Pending" },
    ];

    for (const { raw, expected } of statuses) {
      ticketsResult = {
        data: [
          {
            id: "x",
            title: "T",
            department: "G",
            director: "D",
            status: raw,
            created_at: "2024-01-01T00:00:00Z",
            projects: null,
          },
        ],
        error: null,
      };
      const res = await callGet();
      const body = await res.json();
      expect(body[0].status, `expected "${raw}" → "${expected}"`).toBe(
        expected,
      );
    }
  });
});
