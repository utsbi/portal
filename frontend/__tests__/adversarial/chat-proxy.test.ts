/**
 * ADVERSARIAL (red-team) tests for app/api/chat/route.ts POST handler.
 *
 * Threat model derived FIRST:
 *   C1. Authorization spoofing: a client must NEVER be able to influence the
 *       Bearer token forwarded to the FastAPI backend. The forwarded token must
 *       always be the server-resolved session.access_token, regardless of any
 *       client-supplied `Authorization` request header or `access_token` body
 *       field. (A bypass here = full impersonation of any user at the backend.)
 *   C2. Error leakage: raw upstream error detail must never reach the client,
 *       across DIFFERENT failure shapes — 500 with sensitive body, non-JSON
 *       body, AND a network-level throw from fetch().
 *   C3. UUID handling: a non-canonical / uppercase / trailing-junk public_id is
 *       handled safely (accepted-and-normalised or ignored), never crashing and
 *       never granting cross-user access (RLS scopes by uid).
 *
 * Over-mock note (documented in the report): the existing chat.test.ts cannot
 * prove session-ownership enforcement because its session lookup returns a fixed
 * row regardless of the queried id. These tests deliberately exercise the
 * Authorization-forwarding invariant which the route enforces in code, not in
 * the mock.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ getAll: () => [], set: vi.fn() })),
}));

type State = {
  user: unknown;
  session: unknown;
  sessionRow: { data: unknown; error: unknown };
  insertSessionRow: { data: unknown; error: unknown };
  insertMessageRow: { data: unknown; error: unknown };
  insertAsstRow: { data: unknown; error: unknown };
  updateResult: { error: unknown };
  // Returned by the chat_begin_turn RPC mock (replaces serial inserts on happy path).
  beginTurnRow: {
    data: {
      user_message_id: number | null;
      assistant_message_id: number;
      active_leaf_id: number;
    } | null;
    error: { message: string } | null;
  };
};

const state: State = {
  user: null,
  session: null,
  sessionRow: { data: null, error: null },
  insertSessionRow: { data: { id: 1 }, error: null },
  insertMessageRow: { data: { id: 10 }, error: null },
  insertAsstRow: { data: { id: 11 }, error: null },
  updateResult: { error: null },
  beginTurnRow: {
    data: { user_message_id: 10, assistant_message_id: 11, active_leaf_id: 11 },
    error: null,
  },
};

function makeDbChain(tableResult: { data: unknown; error: unknown }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => tableResult);
  chain.single = vi.fn(async () => tableResult);
  chain.insert = vi.fn(() => chain);
  chain.update = vi.fn(() => ({ eq: vi.fn(async () => state.updateResult) }));
  chain.order = vi.fn(() => chain);
  return chain;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () =>
        state.user
          ? { data: { user: state.user }, error: null }
          : { data: { user: null }, error: { message: "Not authenticated" } },
      ),
      getSession: vi.fn(async () =>
        state.session
          ? { data: { session: state.session }, error: null }
          : { data: { session: null }, error: null },
      ),
    },
    // chat_begin_turn RPC: atomic user+assistant row creation (replaces serial inserts).
    rpc: vi.fn((_fn: string, _args: unknown) => ({
      single: vi.fn(async () => state.beginTurnRow),
    })),
    from: vi.fn((table: string) => {
      if (table === "client_chat_sessions") {
        const c = makeDbChain(state.sessionRow);
        c.insert = vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => state.insertSessionRow),
          })),
        }));
        c.update = vi.fn(() => ({ eq: vi.fn(async () => state.updateResult) }));
        return c;
      }
      if (table === "client_chat_messages") {
        const c = makeDbChain({ data: [], error: null });
        let callCount = 0;
        c.insert = vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => {
              callCount++;
              return callCount === 1
                ? state.insertMessageRow
                : state.insertAsstRow;
            }),
          })),
        }));
        c.update = vi.fn(() => ({ eq: vi.fn(async () => state.updateResult) }));
        return c;
      }
      return makeDbChain({ data: null, error: null });
    }),
  })),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
vi.stubGlobal("crypto", {
  ...globalThis.crypto,
  randomUUID: vi.fn(() => "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"),
});

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "anon-key";
process.env.BACKEND_URL = "http://backend:8000";

const { POST } = await import("@/app/api/chat/route");

function makeReq(
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  const ac = new AbortController();
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: ac.signal,
  });
}

function backendOkStream(answer = "ok") {
  const encoder = new TextEncoder();
  const chunks = [
    `data: ${JSON.stringify({ type: "result", answer, sources: [] })}\n\n`,
    "data: [DONE]\n\n",
  ];
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) controller.enqueue(encoder.encode(chunks[i++]));
      else controller.close();
    },
  });
}

async function drain(res: Response) {
  if (!res.body) return;
  const reader = res.body.getReader();
  while (true) {
    const { done } = await reader.read();
    if (done) break;
  }
}

describe("ADVERSARIAL POST /api/chat — Authorization spoofing (C1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.user = { id: "uid-victim" };
    state.session = { access_token: "SERVER-RESOLVED-TOKEN" };
    state.sessionRow = { data: null, error: null };
    state.insertSessionRow = { data: { id: 1 }, error: null };
    state.insertMessageRow = { data: { id: 10 }, error: null };
    state.insertAsstRow = { data: { id: 11 }, error: null };
    state.updateResult = { error: null };
    state.beginTurnRow = {
      data: { user_message_id: 10, assistant_message_id: 11, active_leaf_id: 11 },
      error: null,
    };
  });

  afterEach(() => vi.restoreAllMocks());

  it("ignores a client-supplied Authorization header — forwards the SERVER token", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(backendOkStream(), { status: 200 }),
    );
    const req = makeReq(
      { query: "hi" },
      { Authorization: "Bearer ATTACKER-FORGED-TOKEN" },
    );
    const res = await POST(req as never);
    await drain(res);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const auth = (init.headers as Record<string, string>).Authorization;
    expect(auth).toBe("Bearer SERVER-RESOLVED-TOKEN");
    expect(auth).not.toContain("ATTACKER-FORGED-TOKEN");
  });

  it("ignores an access_token field in the JSON body — forwards the SERVER token", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(backendOkStream(), { status: 200 }),
    );
    const req = makeReq({ query: "hi", access_token: "BODY-FORGED-TOKEN" });
    const res = await POST(req as never);
    await drain(res);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const auth = (init.headers as Record<string, string>).Authorization;
    expect(auth).toBe("Bearer SERVER-RESOLVED-TOKEN");
    expect(JSON.stringify(init.body)).not.toContain("BODY-FORGED-TOKEN");
  });

  it("returns 404 and does NOT forward to backend when a session_id resolves to no owned row (RLS-denied)", async () => {
    // A session_id belonging to ANOTHER user is invisible under RLS, so the
    // .maybeSingle() lookup yields null. The route must 404 and never reach the
    // backend fetch — no cross-user conversation hijack.
    state.sessionRow = { data: null, error: null };
    const req = makeReq({ query: "hi", session_id: 9999 });
    const res = await POST(req as never);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.detail).toMatch(/not found or not owned/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards the session's STORED project_id, not a client-supplied project_id, for an existing session", async () => {
    // Existing session is fixed to project 7. Client lies that it's project 999.
    state.sessionRow = {
      data: { id: 50, metadata: {}, project_id: 7 },
      error: null,
    };
    fetchMock.mockResolvedValueOnce(
      new Response(backendOkStream(), { status: 200 }),
    );
    const req = makeReq({ query: "hi", session_id: 50, project_id: 999 });
    const res = await POST(req as never);
    await drain(res);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const fwd = JSON.parse(init.body as string);
    // Must forward the stored 7, NOT the attacker's 999 — prevents mid-chat
    // re-scoping into another project's live data.
    expect(fwd.project_id).toBe(7);
  });
});

describe("ADVERSARIAL POST /api/chat — upstream error leakage across failure shapes (C2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.user = { id: "uid-1" };
    state.session = { access_token: "tok" };
    state.sessionRow = { data: null, error: null };
    state.insertSessionRow = { data: { id: 1 }, error: null };
    state.insertMessageRow = { data: { id: 10 }, error: null };
    state.insertAsstRow = { data: { id: 11 }, error: null };
    state.updateResult = { error: null };
    state.beginTurnRow = {
      data: { user_message_id: 10, assistant_message_id: 11, active_leaf_id: 11 },
      error: null,
    };
  });
  afterEach(() => vi.restoreAllMocks());

  it("500 with a sensitive plaintext body → generic 502, no leak", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        "psql: FATAL password authentication failed for user postgres",
        {
          status: 500,
        },
      ),
    );
    const res = await POST(makeReq({ query: "x" }) as never);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.detail).toMatch(/upstream request failed/i);
    expect(JSON.stringify(body)).not.toMatch(/password|postgres|FATAL/i);
  });

  it("500 with a JSON error body → generic 502, no leak of internal detail", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ detail: "Traceback: secret_key=sk-live-1234 leaked" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      ),
    );
    const res = await POST(makeReq({ query: "x" }) as never);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toMatch(/sk-live|secret_key|Traceback/i);
  });

  it("503 with an EMPTY body → still a clean generic 502", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));
    const res = await POST(makeReq({ query: "x" }) as never);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.detail).toMatch(/upstream request failed/i);
  });

  // Network-level fetch errors (DNS, ECONNREFUSED, TLS) are now caught in-route
  // and returned as a clean generic 502. The internal host/IP must never appear
  // in the client-facing response body.
  it("network throw from fetch() is caught and returned as a clean 502 (no internal detail leaked)", async () => {
    fetchMock.mockRejectedValueOnce(
      new Error("connect ECONNREFUSED 10.0.0.5:8000 (internal backend host)"),
    );
    // POST must not throw — it must return a Response.
    const res = await POST(makeReq({ query: "x" }) as never);
    expect(res.status).toBe(502);
    const text = await res.text().catch(() => "");
    // The response body must contain the generic message, not the internal detail.
    expect(text).toMatch(/upstream request failed/i);
    expect(text).not.toMatch(/ECONNREFUSED|10\.0\.0\.5|internal backend host/);
  });
});

describe("ADVERSARIAL POST /api/chat — public_id / UUID handling (C3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.user = { id: "uid-1" };
    state.session = { access_token: "tok" };
    state.sessionRow = { data: null, error: null };
    state.insertSessionRow = { data: { id: 1 }, error: null };
    state.insertMessageRow = { data: { id: 10 }, error: null };
    state.insertAsstRow = { data: { id: 11 }, error: null };
    state.updateResult = { error: null };
    state.beginTurnRow = {
      data: { user_message_id: 10, assistant_message_id: 11, active_leaf_id: 11 },
      error: null,
    };
    fetchMock.mockResolvedValue(
      new Response(backendOkStream(), { status: 200 }),
    );
  });
  afterEach(() => vi.restoreAllMocks());

  const cases: Array<{ label: string; id: string }> = [
    {
      // UUID_RE has /i — accepted (Postgres normalises case).
      label: "uppercase canonical UUID",
      id: "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE",
    },
    {
      // ignored — must not crash
      label: "non-canonical hyphenation (8-4-4-4-12 broken)",
      id: "aaaaaaaa-bbbbcccc-dddd-eeeeeeeeeeee",
    },
    {
      // anchored regex rejects → ignored, not injected
      label: "valid UUID with trailing junk",
      id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'; DROP TABLE x;--",
    },
  ];

  for (const { label, id } of cases) {
    it(`handles ${label} safely (no crash, RLS-scoped insert)`, async () => {
      const res = await POST(makeReq({ query: "hi", public_id: id }) as never);
      // Must always return a stream, never a 4xx/5xx caused by the id shape.
      expect(res.status).toBe(200);
      await drain(res);
      // Whether or not the id was honoured, the session insert is always scoped
      // to the authenticated uid (RLS); the id is an identifier, not a capability.
      // We simply assert the request did not error out.
      expect(fetchMock).toHaveBeenCalled();
    });
  }
});
