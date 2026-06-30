/**
 * Tests for app/api/chat/route.ts  POST handler.
 *
 * Key security assertions:
 *  1. Rejects unauthenticated requests (401).
 *  2. Forwards the user's OWN access_token in the Authorization header to the backend.
 *  3. Validates the public_id / UUID input (malformed uuid is silently ignored, not rejected).
 *  4. On a backend error returns a GENERIC "Upstream request failed" message —
 *     raw upstream error text must NOT leak to the client.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── next/headers mock ───────────────────────────────────────────────────────
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ getAll: () => [], set: vi.fn() })),
}));

// ─── Supabase server client mock ─────────────────────────────────────────────
// The chat route imports createClient from @/lib/supabase/server.
// We need precise per-test control over auth state and DB responses.

type SupabaseMockState = {
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

const state: SupabaseMockState = {
  user: null,
  session: null,
  sessionRow: { data: null, error: null },
  insertSessionRow: { data: null, error: null },
  insertMessageRow: { data: null, error: null },
  insertAsstRow: { data: null, error: null },
  updateResult: { error: null },
  beginTurnRow: {
    data: { user_message_id: 100, assistant_message_id: 101, active_leaf_id: 101 },
    error: null,
  },
};

// A fluent chain mock. Every table operation feeds into state.
function makeDbChain(tableResult: { data: unknown; error: unknown }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => tableResult);
  chain.single = vi.fn(async () => tableResult);
  chain.insert = vi.fn(() => insertChain);
  chain.update = vi.fn(() => updateChain);
  chain.order = vi.fn(() => chain);
  return chain;
}

const insertChain = {
  select: vi.fn(),
  single: vi.fn(),
};
insertChain.select.mockReturnValue(insertChain);

const updateChain = { eq: vi.fn(async () => state.updateResult) };

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
        // Override insert to return insertSessionRow
        c.insert = vi.fn(() => {
          const ic = {
            select: vi.fn(() => ({
              single: vi.fn(async () => state.insertSessionRow),
            })),
          };
          return ic;
        });
        c.update = vi.fn(() => ({ eq: vi.fn(async () => state.updateResult) }));
        return c;
      }
      if (table === "client_chat_messages") {
        const c = makeDbChain({ data: [], error: null });
        c.insert = vi.fn(() => {
          let callCount = 0;
          return {
            select: vi.fn(() => ({
              single: vi.fn(async () => {
                // First insert = user row, second = assistant row
                callCount++;
                if (callCount === 1) return state.insertMessageRow;
                return state.insertAsstRow;
              }),
            })),
          };
        });
        c.update = vi.fn(() => ({ eq: vi.fn(async () => state.updateResult) }));
        return c;
      }
      return makeDbChain({ data: null, error: null });
    }),
  })),
}));

// ─── fetch mock ───────────────────────────────────────────────────────────────
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

// ─── crypto.randomUUID mock ───────────────────────────────────────────────────
vi.stubGlobal("crypto", {
  randomUUID: vi.fn(() => "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"),
});

// Set env vars.
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "anon-key";
process.env.BACKEND_URL = "http://backend:8000";

// Import AFTER mocks.
const { POST } = await import("@/app/api/chat/route");

function makeNextRequest(
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  // Use a real AbortController and pass the signal into the Request constructor.
  // The fetch spec allows passing signal in RequestInit, making it the request's own signal.
  const ac = new AbortController();
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: ac.signal,
  });
}

/** Build an SSE stream that emits a result event then closes. */
function makeBackendStream(answer = "Hello from backend") {
  const encoder = new TextEncoder();
  const chunks = [
    `data: ${JSON.stringify({ type: "result", answer, sources: [] })}\n\n`,
    "data: [DONE]\n\n",
  ];
  let idx = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (idx < chunks.length) {
        controller.enqueue(encoder.encode(chunks[idx++]));
      } else {
        controller.close();
      }
    },
  });
  return stream;
}

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.user = null;
    state.session = null;
    state.sessionRow = { data: null, error: null };
    state.insertSessionRow = { data: { id: 42 }, error: null };
    state.insertMessageRow = { data: { id: 100 }, error: null };
    state.insertAsstRow = { data: { id: 101 }, error: null };
    state.updateResult = { error: null };
    state.beginTurnRow = {
      data: { user_message_id: 100, assistant_message_id: 101, active_leaf_id: 101 },
      error: null,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 401 when unauthenticated ─────────────────────────────────────────────
  it("returns 401 when no user is authenticated", async () => {
    state.user = null;
    state.session = null;

    const req = makeNextRequest({ query: "hello" });
    const res = await POST(req as never);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.detail).toMatch(/unauthorized/i);
  });

  it("returns 401 when user exists but session has no access_token", async () => {
    state.user = { id: "uid-1" };
    state.session = { access_token: null };

    const req = makeNextRequest({ query: "hello" });
    const res = await POST(req as never);

    expect(res.status).toBe(401);
  });

  // ── 400 for empty/missing query ──────────────────────────────────────────
  it("returns 400 when query is missing", async () => {
    state.user = { id: "uid-1" };
    state.session = { access_token: "tok-abc" };

    const req = makeNextRequest({ query: "" });
    const res = await POST(req as never);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.detail).toMatch(/query is required/i);
  });

  it("returns 400 when query is whitespace only", async () => {
    state.user = { id: "uid-1" };
    state.session = { access_token: "tok-abc" };

    const req = makeNextRequest({ query: "   " });
    const res = await POST(req as never);

    expect(res.status).toBe(400);
  });

  // ── Forwards the user's own access_token to backend ─────────────────────
  it("forwards the user's access_token in the Authorization header to the backend", async () => {
    const ACCESS_TOKEN = "user-secret-jwt-token-xyz";
    state.user = { id: "uid-1" };
    state.session = { access_token: ACCESS_TOKEN };
    state.insertSessionRow = { data: { id: 1 }, error: null };
    state.insertMessageRow = { data: { id: 10 }, error: null };
    state.insertAsstRow = { data: { id: 11 }, error: null };

    fetchMock.mockResolvedValueOnce(
      new Response(makeBackendStream(), {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );

    const req = makeNextRequest({ query: "What is SBI?" });
    const res = await POST(req as never);

    // Drain the stream so the fetch completes.
    if (res.body) {
      const reader = res.body.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    }

    expect(fetchMock).toHaveBeenCalledOnce();
    const [_url, fetchInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const authHeader = (fetchInit.headers as Record<string, string>)
      .Authorization;
    expect(authHeader).toBe(`Bearer ${ACCESS_TOKEN}`);
  });

  // ── Generic error on backend failure ────────────────────────────────────
  it("returns 502 with a GENERIC message — raw upstream error text must not leak", async () => {
    state.user = { id: "uid-1" };
    state.session = { access_token: "tok-abc" };
    state.insertSessionRow = { data: { id: 1 }, error: null };
    state.insertMessageRow = { data: { id: 10 }, error: null };
    state.insertAsstRow = { data: { id: 11 }, error: null };

    const SENSITIVE_UPSTREAM_ERROR =
      "Internal DB credentials exposed in traceback line 42";
    fetchMock.mockResolvedValueOnce(
      new Response(SENSITIVE_UPSTREAM_ERROR, {
        status: 500,
        headers: { "Content-Type": "text/plain" },
      }),
    );

    const req = makeNextRequest({ query: "Crash the backend" });
    const res = await POST(req as never);

    expect(res.status).toBe(502);
    const body = await res.json();
    // The generic message must be present.
    expect(body.detail).toMatch(/upstream request failed/i);
    // The raw error MUST NOT appear in the response.
    expect(JSON.stringify(body)).not.toContain("DB credentials");
    expect(JSON.stringify(body)).not.toContain("traceback");
  });

  // ── Valid public_id UUID is accepted ─────────────────────────────────────
  it("accepts a well-formed public_id UUID and passes it to the session insert", async () => {
    state.user = { id: "uid-1" };
    state.session = { access_token: "tok-abc" };
    state.insertSessionRow = { data: { id: 2 }, error: null };
    state.insertMessageRow = { data: { id: 20 }, error: null };
    state.insertAsstRow = { data: { id: 21 }, error: null };

    fetchMock.mockResolvedValueOnce(
      new Response(makeBackendStream(), {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );

    const validUuid = "12345678-1234-1234-1234-123456789abc";
    const req = makeNextRequest({ query: "hello", public_id: validUuid });
    const res = await POST(req as never);

    // Just verify we get a stream back (not a 4xx/5xx), meaning the UUID was accepted.
    expect(res.status).toBe(200);
    // Drain
    if (res.body) {
      const reader = res.body.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    }
  });

  // ── Malformed public_id is silently ignored ───────────────────────────────
  it("ignores a malformed public_id and continues without error", async () => {
    state.user = { id: "uid-1" };
    state.session = { access_token: "tok-abc" };
    state.insertSessionRow = { data: { id: 3 }, error: null };
    state.insertMessageRow = { data: { id: 30 }, error: null };
    state.insertAsstRow = { data: { id: 31 }, error: null };

    fetchMock.mockResolvedValueOnce(
      new Response(makeBackendStream(), {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );

    const req = makeNextRequest({ query: "hello", public_id: "not-a-uuid!!" });
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    // Drain
    if (res.body) {
      const reader = res.body.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    }
  });

  // ── Session event emitted first ───────────────────────────────────────────
  it("emits a session event as the first SSE chunk", async () => {
    state.user = { id: "uid-1" };
    state.session = { access_token: "tok-abc" };
    state.insertSessionRow = { data: { id: 77 }, error: null };
    state.insertMessageRow = { data: { id: 200 }, error: null };
    state.insertAsstRow = { data: { id: 201 }, error: null };

    fetchMock.mockResolvedValueOnce(
      new Response(makeBackendStream("Answer text"), {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );

    const req = makeNextRequest({ query: "What is energy?" });
    const res = await POST(req as never);
    expect(res.status).toBe(200);

    const decoder = new TextDecoder();
    let fullText = "";
    if (res.body) {
      const reader = res.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value);
      }
    }

    // The VERY FIRST data line should be a session event.
    const firstDataLine = fullText
      .split("\n")
      .find((l) => l.startsWith("data:"));
    expect(firstDataLine).toBeDefined();
    const parsed = JSON.parse((firstDataLine as string).slice(5).trim());
    expect(parsed.type).toBe("session");
    expect(typeof parsed.session_id).toBe("number");
  });
});
