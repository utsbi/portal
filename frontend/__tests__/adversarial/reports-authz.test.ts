/**
 * ADVERSARIAL (red-team) tests for app/api/reports/route.ts GET handler.
 *
 * Threat model derived FIRST, then tested against the real route:
 *   R1. A non-director must ONLY ever receive ticket rows for a project they are
 *       a *member* of. The route enforces this in two places:
 *         (a) membership probe: .eq("project_id", Number(projectId))
 *         (b) data query:       .eq("project_id", Number(projectId))
 *       SECURITY INVARIANT: the value used in (a) and (b) MUST be identical.
 *       If they ever diverge, a member of project A could read project B's data
 *       by sending a projectId that coerces differently between the two reads.
 *   R2. A projectId that coerces to NaN/Infinity must NOT authorise anything.
 *   R3. An array param (?project_id=1&project_id=2) must resolve to a single,
 *       well-defined value (URLSearchParams.get → first), and that same value
 *       must drive BOTH the membership check and the data query.
 *
 * Unlike the existing __tests__/api/reports.test.ts, this suite CAPTURES the
 * actual argument passed to .eq("project_id", ...) on both the membership and
 * the tickets query, so a coercion mismatch would be caught. The existing test
 * returns a fixed membershipResult regardless of the queried value, so it is
 * structurally incapable of detecting a cross-project coercion bug.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Cookie store mock ───────────────────────────────────────────────────────
const cookieStoreMock = {
  getAll: vi.fn(() => []),
  set: vi.fn(),
};
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStoreMock),
}));

// ─── Capturing Supabase mock ─────────────────────────────────────────────────
// We record every project_id value passed to .eq() per table so the test can
// assert the membership check and the data query agree.

interface Captured {
  membershipProjectIdArgs: unknown[];
  ticketsProjectIdArgs: unknown[];
}
const captured: Captured = {
  membershipProjectIdArgs: [],
  ticketsProjectIdArgs: [],
};

let authResult: { data: { user: unknown }; error: unknown };
let profileResult: { data: unknown; error: unknown };
// membershipForProject: given the coerced project id the route queried with,
// decide whether a membership row exists. Default: ONLY project 5 has the member.
let membershipForProject: (coerced: unknown) => boolean;
let ticketsResult: { data: unknown; error: unknown };

function makeMembershipChain() {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn((col: string, val: unknown) => {
    if (col === "project_id") captured.membershipProjectIdArgs.push(val);
    return chain;
  });
  // .single() resolves based on what project id was actually queried.
  chain.single = vi.fn(async () => {
    const last =
      captured.membershipProjectIdArgs[
        captured.membershipProjectIdArgs.length - 1
      ];
    return membershipForProject(last)
      ? { data: { project_id: last }, error: null }
      : { data: null, error: { message: "Not found" } };
  });
  return chain;
}

function makeProfileChain() {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.single = vi.fn(async () => profileResult);
  return chain;
}

function makeTicketsChain() {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.eq = vi.fn((col: string, val: unknown) => {
    if (col === "project_id") captured.ticketsProjectIdArgs.push(val);
    return chain;
  });
  // List query is awaited directly — make it thenable.
  (chain as { then: unknown }).then = (
    onFulfilled: (v: unknown) => unknown,
    onRejected?: (e: unknown) => unknown,
  ) => Promise.resolve(ticketsResult).then(onFulfilled, onRejected);
  return chain;
}

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: vi.fn(async () => authResult) },
    from: vi.fn((table: string) => {
      if (table === "profiles") return makeProfileChain();
      if (table === "project_members") return makeMembershipChain();
      if (table === "tickets") return makeTicketsChain();
      return makeProfileChain();
    }),
  })),
}));

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "anon-key";

const { GET } = await import("@/app/api/reports/route");

function callGet(query = "") {
  return GET(new Request(`http://localhost/api/reports${query}`));
}

describe("ADVERSARIAL GET /api/reports — projectId coercion & cross-project leakage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captured.membershipProjectIdArgs = [];
    captured.ticketsProjectIdArgs = [];
    authResult = { data: { user: { id: "uid-member" } }, error: null };
    profileResult = { data: { id: 10, role: "member" }, error: null };
    // The member belongs ONLY to project 5.
    membershipForProject = (coerced) => coerced === 5;
    ticketsResult = { data: [], error: null };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── INVARIANT R1: same coerced value drives both reads ───────────────────
  // For every coercible input, if the route returns 200 to a non-director, the
  // membership check and the data query MUST have used the identical project id.
  const coercible: Array<{ raw: string; coerced: number }> = [
    { raw: "5", coerced: 5 },
    { raw: " 5 ", coerced: 5 },
    { raw: "5.0", coerced: 5 },
    { raw: "05", coerced: 5 },
    { raw: "+5", coerced: 5 },
    { raw: "5e0", coerced: 5 },
  ];

  for (const { raw, coerced } of coercible) {
    it(`uses the SAME coerced project id (${coerced}) for membership AND data query for input ${JSON.stringify(raw)}`, async () => {
      // Member belongs to whatever the coerced value is, so the route proceeds.
      membershipForProject = (c) => c === coerced;
      const res = await callGet(`?project_id=${encodeURIComponent(raw)}`);
      expect(res.status).toBe(200);
      // Both reads must have happened with the identical coerced value.
      expect(captured.membershipProjectIdArgs).toContain(coerced);
      expect(captured.ticketsProjectIdArgs).toContain(coerced);
      // CRITICAL: no divergence — the value the data query filters on must equal
      // the value the membership check authorised.
      const memberVal =
        captured.membershipProjectIdArgs[
          captured.membershipProjectIdArgs.length - 1
        ];
      const dataVal =
        captured.ticketsProjectIdArgs[captured.ticketsProjectIdArgs.length - 1];
      expect(dataVal).toBe(memberVal);
    });
  }

  // ── R1 attack: member of project 5 tries to read project 6 ───────────────
  it("DENIES a member of project 5 who requests project 6 (no cross-project read)", async () => {
    membershipForProject = (c) => c === 5; // only project 5
    const res = await callGet("?project_id=6");
    expect(res.status).toBe(403);
    // The tickets query must NEVER run for an unauthorised project.
    expect(captured.ticketsProjectIdArgs).not.toContain(6);
    expect(captured.ticketsProjectIdArgs.length).toBe(0);
  });

  // ── R1 attack via exponent: "6e0" === 6, still not a member ──────────────
  it("DENIES exponent-form '6e0' (=6) for a member of only project 5", async () => {
    membershipForProject = (c) => c === 5;
    const res = await callGet("?project_id=6e0");
    expect(res.status).toBe(403);
    expect(captured.ticketsProjectIdArgs.length).toBe(0);
  });

  // ── R1 attack via hex: "0x6" === 6 ───────────────────────────────────────
  it("DENIES hex-form '0x6' (=6) for a member of only project 5", async () => {
    membershipForProject = (c) => c === 5;
    const res = await callGet("?project_id=0x6");
    expect(res.status).toBe(403);
    expect(captured.ticketsProjectIdArgs.length).toBe(0);
  });

  // ── R2: NaN-coercing input must authorise nothing ────────────────────────
  // "1abc" → Number => NaN. The membership .eq("project_id", NaN) returns no
  // row, so a non-director MUST be denied. Crucially the data query must not run.
  it("DENIES a non-director when project_id coerces to NaN ('1abc')", async () => {
    membershipForProject = (c) => Number.isFinite(c as number); // any finite id "matches"
    const res = await callGet("?project_id=1abc");
    expect(res.status).toBe(403);
    // NaN must have been the membership arg, and tickets must not have run.
    expect(captured.membershipProjectIdArgs.some((v) => Number.isNaN(v))).toBe(
      true,
    );
    expect(captured.ticketsProjectIdArgs.length).toBe(0);
  });

  // ── R2: Infinity ─────────────────────────────────────────────────────────
  it("DENIES a non-director when project_id is 'Infinity' (no such project)", async () => {
    membershipForProject = (c) => Number.isFinite(c as number);
    const res = await callGet("?project_id=Infinity");
    expect(res.status).toBe(403);
    expect(captured.ticketsProjectIdArgs.length).toBe(0);
  });

  // ── R3: array param resolves to a single value, used in BOTH reads ────────
  // ?project_id=5&project_id=6 → URLSearchParams.get returns "5" (first). The
  // member IS in project 5, so the route proceeds — and the data query must use
  // 5, never 6. If the data query ever used 6, the member would read a project
  // they were never authorised for.
  it("array param ?project_id=5&project_id=6 authorises and queries project 5 ONLY", async () => {
    membershipForProject = (c) => c === 5;
    ticketsResult = {
      data: [
        {
          id: "t1",
          title: "Project 5 report",
          department: "Eng",
          director: "Alice",
          status: "pending",
          created_at: "2024-01-01T00:00:00Z",
          projects: { company_name: "Acme" },
        },
      ],
      error: null,
    };
    const res = await callGet("?project_id=5&project_id=6");
    expect(res.status).toBe(200);
    // Data query must filter on 5 — and must NOT have filtered on 6.
    expect(captured.ticketsProjectIdArgs).toContain(5);
    expect(captured.ticketsProjectIdArgs).not.toContain(6);
    expect(captured.membershipProjectIdArgs).toContain(5);
  });

  // ── R3 attack: member of 6 but param order is 5,6 → first wins = 5 → deny ──
  it("array param ?project_id=5&project_id=6 DENIES a member of only project 6", async () => {
    membershipForProject = (c) => c === 6; // member of 6, not 5
    const res = await callGet("?project_id=5&project_id=6");
    // First value (5) drives the membership check → not a member → 403.
    expect(res.status).toBe(403);
    expect(captured.ticketsProjectIdArgs.length).toBe(0);
  });

  // ── Director path: a director with no project_id scans all (no leak gate) ──
  // This documents that directors intentionally bypass project scoping. It is a
  // robustness check, not a bug, but pins the behaviour so a regression that
  // accidentally lets a non-director through the director branch would surface
  // elsewhere.
  it("director with no project_id never touches the membership table", async () => {
    authResult = { data: { user: { id: "uid-director" } }, error: null };
    profileResult = { data: { id: 1, role: "director" }, error: null };
    ticketsResult = { data: [], error: null };
    const res = await callGet("");
    expect(res.status).toBe(200);
    expect(captured.membershipProjectIdArgs.length).toBe(0);
    // No project_id → tickets query is unscoped (no project_id .eq).
    expect(captured.ticketsProjectIdArgs.length).toBe(0);
  });
});
