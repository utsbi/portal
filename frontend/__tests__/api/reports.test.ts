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
  insert: ReturnType<typeof vi.fn>;
  _resolve: (v: { data: unknown; error: unknown }) => void;
  // Make the chain thenable so `await query` (list query, no .single()) works.
  then: (
    onFulfilled: (v: unknown) => unknown,
    onRejected?: (e: unknown) => unknown,
  ) => Promise<unknown>;
};

// Captures the payload passed to `.insert(...)` so POST tests can assert the
// exact row shape sent to the DB.
const insertSpy = vi.fn();
// Result the POST insert (`.insert().select().single()`) resolves to.
let insertResult: { data: unknown; error: unknown } = {
  data: null,
  error: null,
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
    insert: vi.fn(),
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
  // `.insert(payload)` records the payload and returns a fresh chain seeded with
  // insertResult, so `.insert().select().single()` resolves to insertResult.
  chain.insert.mockImplementation((payload: unknown) => {
    insertSpy(payload);
    return makeChain(insertResult);
  });
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
const { GET, POST } = await import("@/app/api/reports/route");

// Helper to call GET with a URL.
function callGet(url = "http://localhost/api/reports") {
  return GET(new Request(url));
}

// Helper to call POST with a JSON body.
function callPost(payload: unknown) {
  return POST(
    new Request("http://localhost/api/reports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
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

  // ── DB error is redacted (no raw Supabase message leaked) ────────────────
  it("returns a generic 500 and does NOT leak the raw Supabase error", async () => {
    authResult = { data: { user: { id: "uid-director" } }, error: null };
    profileResult = { data: { id: 1, role: "director" }, error: null };
    ticketsResult = {
      data: null,
      error: {
        message:
          'relation "internal_secret_table" does not exist (SQLSTATE 42P01)',
      },
    };

    const res = await callGet();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
    expect(JSON.stringify(body)).not.toMatch(/internal_secret_table|42P01/);
  });
});

describe("POST /api/reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieStoreMock.getAll.mockReturnValue([]);
    authResult = { data: { user: { id: "uid-1" } }, error: null };
    profileResult = {
      data: { id: 7, name: "Dana Director", role: "director", department: "Eng" },
      error: null,
    };
    membershipResult = { data: null, error: { message: "Not member" } };
    insertResult = {
      data: {
        id: 99,
        title: "Roof leak",
        subject: "Roof leak",
        message: "Water in unit 4",
        status: "pending",
        department: "Eng",
        director: "Dana Director",
        created_at: "2024-03-01T00:00:00Z",
        projects: { company_name: "Acme" },
      },
      error: null,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 400 when title or message is missing (pre-auth)", async () => {
    const res = await callPost({ title: "only title" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/title and message are required/i);
  });

  it("returns 401 when unauthenticated", async () => {
    authResult = { data: { user: null }, error: { message: "no session" } };
    const res = await callPost({ title: "t", message: "m" });
    expect(res.status).toBe(401);
    expect((await res.json()).error).toMatch(/not authenticated/i);
  });

  it("returns 403 when the profile is missing", async () => {
    profileResult = { data: null, error: { message: "no profile" } };
    const res = await callPost({ title: "t", message: "m" });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/profile not found/i);
  });

  it("returns 403 when the caller is neither director nor member", async () => {
    profileResult = {
      data: { id: 7, name: "Carl Client", role: "client", department: null },
      error: null,
    };
    const res = await callPost({ title: "t", message: "m" });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/directors or members/i);
  });

  it("returns 400 when the title exceeds the length cap", async () => {
    const res = await callPost({ title: "x".repeat(501), message: "m" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/title must be at most/i);
  });

  it("returns 400 when the message exceeds the length cap", async () => {
    const res = await callPost({ title: "t", message: "x".repeat(10_001) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/message must be at most/i);
  });

  it("returns 400 when a non-director omits project_id", async () => {
    profileResult = {
      data: { id: 7, name: "Mia Member", role: "member", department: "Eng" },
      error: null,
    };
    const res = await callPost({ title: "t", message: "m" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/project_id is required/i);
  });

  it("returns 403 when a non-director is not a member of the project", async () => {
    profileResult = {
      data: { id: 7, name: "Mia Member", role: "member", department: "Eng" },
      error: null,
    };
    membershipResult = { data: null, error: { message: "no row" } };
    const res = await callPost({ title: "t", message: "m", project_id: 5 });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/forbidden/i);
    // No insert should have happened for a non-member.
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("inserts a correctly-shaped report row and maps the response", async () => {
    const res = await callPost({
      title: "Roof leak",
      message: "Water in unit 4",
      department: "Facilities",
      project_id: "12",
    });

    expect(res.status).toBe(201);
    // Insert payload shape.
    expect(insertSpy).toHaveBeenCalledTimes(1);
    const payload = (insertSpy.mock.calls[0][0] as Array<Record<string, unknown>>)[0];
    expect(payload.ticket_type).toBe("report");
    expect(payload.title).toBe("Roof leak");
    expect(payload.subject).toBe("Roof leak");
    expect(payload.message).toBe("Water in unit 4");
    expect(payload.department).toBe("Facilities");
    expect(payload.director).toBe("Dana Director");
    expect(payload.status).toBe("pending");
    expect(payload.project_id).toBe(12);
    // Response mapping.
    const body = await res.json();
    expect(body.id).toBe("99");
    expect(body.title).toBe("Roof leak");
    expect(body.status).toBe("Pending");
    expect(body.project).toBe("Acme");
  });

  it("returns a generic 500 and does NOT leak the raw insert error", async () => {
    insertResult = {
      data: null,
      error: {
        message:
          'duplicate key value violates unique constraint "tickets_secret_idx"',
      },
    };
    const res = await callPost({ title: "t", message: "m" });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
    expect(JSON.stringify(body)).not.toMatch(/tickets_secret_idx|constraint/);
  });
});
