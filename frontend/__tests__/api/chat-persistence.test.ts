/**
 * Persistence and streaming tests for app/api/chat/route.ts POST handler.
 *
 * Covers:
 *  P1. chat_begin_turn RPC called with expected args; assistant_message_id used
 *      for subsequent DB writes.
 *  P2. Upstream fetch failure AFTER pre-create → 502 returned, no streaming
 *      success response; the pre-created assistant row is marked cancelled
 *      (never a phantom "success" content/sources write).
 *  P3. Successful finalization — delta(s) + result event → final assistant-row
 *      update carries accumulated content AND sources.
 *  P4. Cancellation — backend stream closes without a result event → row marked
 *      is_cancelled=true rather than left blank.
 *  P5. Fallback insert when chat_begin_turn returns a null assistant_message_id
 *      (pre-create unavailable) — insert fires on result, active_leaf advanced.
 *  P6. Existing session: the STORED project_id is forwarded to the backend fetch,
 *      NOT the client-supplied value.
 *  P7. Client disconnect mid-stream — the response stream is cancelled but the
 *      backend pump (lifetime pinned by next/server's after()) keeps running,
 *      so the final content + sources are still persisted.
 *  P8. A straggler delta after `result` never schedules a debounced write, so
 *      no incremental write can land after finalization and clobber the final
 *      content/sources.
 *  P9. Early upstream failures AFTER the chat_begin_turn pre-create (fetch
 *      throw / non-OK response) mark the pre-created assistant row cancelled
 *      instead of leaving an orphaned blank row.
 *
 * Mocking approach:
 *  - Mirrors chat.test.ts / adversarial/chat-proxy.test.ts exactly: a mutable
 *    `state` object is captured by the vi.mock factory so each test controls DB
 *    responses by mutating state in beforeEach.
 *  - `state.calls` sub-object accumulates payloads passed to supabase update/insert
 *    and to fetch, enabling precise assertions without singling out individual spies.
 *  - SSE streams are built from plain arrays of event objects via makeSseStream().
 *    The ReadableStream pull model is deterministic (no timers, no network).
 *  - The route's 400ms debounce timer (scheduleAssistantUpdate) is always cleared
 *    before firing: flushAssistantUpdate() cancels it on result, and the finally
 *    block cancels it on cancellation.  No fake timers needed.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── next/headers mock ────────────────────────────────────────────────────────
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ getAll: () => [], set: vi.fn() })),
}));

// ─── next/server mock ─────────────────────────────────────────────────────────
// The route pins its backend-pump lifetime with after(); outside a real Next
// request scope after() throws, so the mock captures each task instead. Tests
// that need the pump's persistence to have finished await `afterTasks` — the
// same completion guarantee after() provides in production.
const afterTasks: Array<Promise<unknown>> = [];
vi.mock("next/server", () => ({
  after: (task: Promise<unknown> | (() => unknown)) => {
    afterTasks.push(
      Promise.resolve(typeof task === "function" ? task() : task),
    );
  },
}));

// ─── Shared state + call-capture ─────────────────────────────────────────────

type UpdateEntry = { payload: Record<string, unknown>; eqId: unknown };

type MockState = {
  user: unknown;
  session: unknown;
  /** Used by the existing-session lookup and by advanceActiveLeaf's metadata read. */
  sessionRow: { data: unknown; error: unknown };
  /** Returned by the new-session insert. */
  insertSessionRow: { data: unknown; error: unknown };
  /** Returned by the fallback-insert single(). */
  insertAsstRow: { data: unknown; error: unknown };
  updateResult: { error: unknown };
  /** Returned by the chat_begin_turn RPC. */
  beginTurnRow: {
    data: {
      user_message_id: number | null;
      // Intentionally typed as `number | null` here so tests can set it to null.
      assistant_message_id: number | null;
      active_leaf_id: number;
    } | null;
    error: { message: string } | null;
  };
  calls: {
    /** Every call to supabase.rpc(). */
    rpc: Array<{ fn: string; args: Record<string, unknown> }>;
    /** Every call to supabase.from("client_chat_messages").update(). */
    messagesUpdate: Array<UpdateEntry>;
    /** Every call to supabase.from("client_chat_messages").insert(). */
    messagesInsert: Array<Record<string, unknown>>;
    /** Payload forwarded to the backend fetch (parsed from JSON body). */
    backendFetchBody: Record<string, unknown> | null;
  };
};

const state: MockState = {
  user: null,
  session: null,
  sessionRow: { data: null, error: null },
  insertSessionRow: { data: { id: 42 }, error: null },
  insertAsstRow: { data: { id: 201 }, error: null },
  updateResult: { error: null },
  beginTurnRow: {
    data: {
      user_message_id: 100,
      assistant_message_id: 101,
      active_leaf_id: 101,
    },
    error: null,
  },
  calls: {
    rpc: [],
    messagesUpdate: [],
    messagesInsert: [],
    backendFetchBody: null,
  },
};

// ─── Supabase chain builder ───────────────────────────────────────────────────

function makeDbChain(tableResult: { data: unknown; error: unknown }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.in = vi.fn(async () => tableResult);
  chain.maybeSingle = vi.fn(async () => tableResult);
  chain.single = vi.fn(async () => tableResult);
  chain.insert = vi.fn(() => chain);
  chain.update = vi.fn(() => ({ eq: vi.fn(async () => state.updateResult) }));
  chain.order = vi.fn(() => chain);
  return chain;
}

// ─── Supabase server client mock ─────────────────────────────────────────────
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

    rpc: vi.fn((fn: string, args: Record<string, unknown>) => {
      state.calls.rpc.push({ fn, args });
      return {
        single: vi.fn(
          // Cast: the route types assistant_message_id as `number` but our
          // fallback test supplies `null`; the cast keeps TS happy in the mock.
          async () =>
            state.beginTurnRow as {
              data: {
                user_message_id: number | null;
                assistant_message_id: number;
                active_leaf_id: number;
              } | null;
              error: { message: string } | null;
            },
        ),
      };
    }),

    from: vi.fn((table: string) => {
      // ── client_chat_sessions ──────────────────────────────────────────────
      if (table === "client_chat_sessions") {
        const c = makeDbChain(state.sessionRow);
        c.insert = vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => state.insertSessionRow),
          })),
        }));
        c.update = vi.fn(() => ({
          eq: vi.fn(async () => state.updateResult),
        }));
        return c;
      }

      // ── client_chat_messages ──────────────────────────────────────────────
      if (table === "client_chat_messages") {
        const c = makeDbChain({ data: [], error: null });

        c.update = vi.fn((payload: Record<string, unknown>) => {
          const entry: UpdateEntry = { payload, eqId: undefined };
          state.calls.messagesUpdate.push(entry);
          return {
            eq: vi.fn(async (_col: string, id: unknown) => {
              entry.eqId = id;
              return state.updateResult;
            }),
          };
        });

        c.insert = vi.fn((payload: Record<string, unknown>) => {
          state.calls.messagesInsert.push(payload);
          return {
            select: vi.fn(() => ({
              single: vi.fn(async () => state.insertAsstRow),
            })),
          };
        });

        return c;
      }

      // ── all other tables (client_chat_attachments, etc.) ──────────────────
      return makeDbChain({ data: null, error: null });
    }),
  })),
}));

// ─── fetch mock ───────────────────────────────────────────────────────────────
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

vi.stubGlobal("crypto", {
  randomUUID: vi.fn(() => "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"),
});

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "anon-key";
process.env.BACKEND_URL = "http://backend:8000";

// Import AFTER all mocks are registered.
const { POST } = await import("@/app/api/chat/route");

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Drain a streaming Response to completion and return the raw text.
 * Because the route's ReadableStream start() is async, calling drain() ensures
 * the entire stream (including the finally block) has completed before assertions.
 */
async function drain(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  return text;
}

/**
 * Build a ReadableStream that emits SSE lines from an array of event descriptors.
 * Each item is either a plain object (serialised as JSON) or the raw string "[DONE]".
 */
function makeSseStream(
  events: Array<Record<string, unknown> | string>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const lines = events.map(
    (e) => `data: ${typeof e === "string" ? e : JSON.stringify(e)}\n\n`,
  );
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i < lines.length) {
        controller.enqueue(encoder.encode(lines[i++]));
      } else {
        controller.close();
      }
    },
  });
}

/**
 * Make a fake backend Response whose body is the given SSE stream.
 */
function backendOk(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function makeRequest(body: Record<string, unknown>): Request {
  const ac = new AbortController();
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: ac.signal,
  });
}

// ─── Test setup ──────────────────────────────────────────────────────────────

function resetState() {
  state.user = { id: "uid-1" };
  state.session = { access_token: "test-token-xyz" };
  state.sessionRow = { data: null, error: null };
  state.insertSessionRow = { data: { id: 42 }, error: null };
  state.insertAsstRow = { data: { id: 201 }, error: null };
  state.updateResult = { error: null };
  state.beginTurnRow = {
    data: {
      user_message_id: 100,
      assistant_message_id: 101,
      active_leaf_id: 101,
    },
    error: null,
  };
  state.calls = {
    rpc: [],
    messagesUpdate: [],
    messagesInsert: [],
    backendFetchBody: null,
  };
  afterTasks.length = 0;
}

// ─── Test suite ──────────────────────────────────────────────────────────────

describe("POST /api/chat — persistence and streaming (P1–P6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── P1: chat_begin_turn RPC called with expected args; assistant id used ───
  it("P1: calls chat_begin_turn with session_id, query, model_preference, history_len, regenerate=false; assistant id used in update", async () => {
    fetchMock.mockImplementationOnce(async (url: string, init: RequestInit) => {
      state.calls.backendFetchBody = JSON.parse(init.body as string) as Record<
        string,
        unknown
      >;
      return backendOk(
        makeSseStream([
          { type: "result", answer: "The answer", sources: [] },
          "[DONE]",
        ]),
      );
    });

    const req = makeRequest({
      query: "test question",
      // history omitted → historyLen = 0
      // model_preference omitted → defaults to "fast"
    });
    const res = await POST(req as never);
    await drain(res);

    // RPC must have been invoked once with the correct function name.
    expect(state.calls.rpc).toHaveLength(1);
    const { fn, args } = state.calls.rpc[0];
    expect(fn).toBe("chat_begin_turn");
    expect(args._query).toBe("test question");
    expect(args._session_id).toBe(42); // freshly created session id
    expect(args._model_preference).toBe("fast");
    expect(args._history_len).toBe(0);
    expect(args._regenerate).toBe(false);

    // The assistant row update must have targeted assistantMessageId = 101.
    const updateWithSources = state.calls.messagesUpdate.find(
      (e) => "sources" in e.payload,
    );
    expect(updateWithSources).toBeDefined();
    expect(updateWithSources!.eqId).toBe(101);
  });

  // ── P2: Upstream fetch failure AFTER pre-create ────────────────────────────
  it("P2: fetch throw after successful pre-create → 502 JSON, pre-created row marked cancelled, no phantom content write", async () => {
    fetchMock.mockRejectedValueOnce(
      new Error("connect ECONNREFUSED 10.0.0.5:8000"),
    );

    const req = makeRequest({ query: "will fail" });
    const res = await POST(req as never);

    // Must return a plain JSON 502, not a streaming response.
    expect(res.status).toBe(502);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.detail).toMatch(/upstream request failed/i);
    // No sensitive internal detail must leak.
    expect(JSON.stringify(body)).not.toMatch(/ECONNREFUSED|10\.0\.0\.5/);

    // RPC succeeded (pre-create happened). The pre-created assistant row must
    // not be left as an orphaned blank row: it is marked cancelled — and that
    // is the ONLY write; no phantom "success" content/sources update.
    expect(state.calls.rpc).toHaveLength(1);
    expect(state.calls.rpc[0].fn).toBe("chat_begin_turn");
    expect(state.calls.messagesUpdate).toHaveLength(1);
    expect(state.calls.messagesUpdate[0].payload).toEqual({
      is_cancelled: true,
    });
    expect(state.calls.messagesUpdate[0].eqId).toBe(101);
  });

  // ── P3: Successful finalization persists content + sources ─────────────────
  it("P3: delta events + result event → final assistant row update carries full content and sources", async () => {
    const sources = [{ title: "Doc A", url: "https://example.com" }];

    fetchMock.mockResolvedValueOnce(
      backendOk(
        makeSseStream([
          { type: "delta", text: "Hello " },
          { type: "delta", text: "world" },
          // The route prefers event.answer over accumulated when both present.
          { type: "result", answer: "Hello world", sources },
          "[DONE]",
        ]),
      ),
    );

    const req = makeRequest({ query: "tell me something" });
    const res = await POST(req as never);
    await drain(res);

    expect(res.status).toBe(200);

    // There will be two updates to client_chat_messages:
    //   [0] flushAssistantUpdate() — content + reasoning + process_steps
    //   [1] result handler        — content + sources (the one that matters)
    // Assert the result-handler update (last call, has `sources` key).
    const finalUpdate = state.calls.messagesUpdate.find(
      (e) => "sources" in e.payload,
    );
    expect(finalUpdate).toBeDefined();
    expect(finalUpdate!.payload.content).toBe("Hello world");
    expect(finalUpdate!.payload.sources).toEqual(sources);
    // Must target the pre-created assistant row id.
    expect(finalUpdate!.eqId).toBe(101);

    // No fallback insert: update path was used throughout.
    expect(state.calls.messagesInsert).toHaveLength(0);
  });

  // ── P4: Cancellation — stream ends without result → is_cancelled marked ────
  it("P4: backend stream closes without result event → assistant row updated with is_cancelled=true", async () => {
    // A stream that emits a delta chunk then just closes (no result, no [DONE]).
    // This simulates a client abort or backend hang-up mid-stream.
    fetchMock.mockResolvedValueOnce(
      backendOk(
        makeSseStream([
          { type: "delta", text: "partial answer" },
          // intentionally no result event
        ]),
      ),
    );

    const req = makeRequest({ query: "give me something partial" });
    const res = await POST(req as never);
    // Drain so the stream's finally block completes before asserting.
    await drain(res);

    // The cancellation update must have been issued.
    const cancelUpdate = state.calls.messagesUpdate.find(
      (e) => e.payload.is_cancelled === true,
    );
    expect(cancelUpdate).toBeDefined();
    // Partial content accumulated before the abort must be persisted.
    expect(cancelUpdate!.payload.content).toBe("partial answer");
    // Must target the pre-created assistant row.
    expect(cancelUpdate!.eqId).toBe(101);

    // No successful finalization insert.
    expect(state.calls.messagesInsert).toHaveLength(0);
  });

  // ── P5: Fallback insert when assistant_message_id is null from rpc ─────────
  it("P5: rpc returns null assistant_message_id → fallback insert fires on result, active_leaf advanced", async () => {
    // Simulate a scenario where chat_begin_turn succeeded but didn't return an
    // assistant_message_id (edge case: partial RPC data).
    state.beginTurnRow = {
      data: {
        user_message_id: 100,
        assistant_message_id: null as unknown as number, // triggers fallback path
        active_leaf_id: 1,
      },
      error: null,
    };
    // advanceActiveLeaf reads session metadata; provide a valid row.
    state.sessionRow = { data: { id: 42, metadata: {} }, error: null };

    const sources = [{ title: "Fallback source" }];
    fetchMock.mockResolvedValueOnce(
      backendOk(
        makeSseStream([
          { type: "result", answer: "Fallback answer", sources },
          "[DONE]",
        ]),
      ),
    );

    const req = makeRequest({ query: "trigger fallback" });
    const res = await POST(req as never);
    await drain(res);

    // Route must have returned a stream (not a 5xx).
    expect(res.status).toBe(200);

    // The fallback INSERT (not update) must have been called with correct payload.
    expect(state.calls.messagesInsert).toHaveLength(1);
    const inserted = state.calls.messagesInsert[0];
    expect(inserted.role).toBe("assistant");
    expect(inserted.content).toBe("Fallback answer");
    expect(inserted.sources).toEqual(sources);
    expect(inserted.session_id).toBe(42);

    // No update to client_chat_messages (no pre-created row to update).
    // The flush from flushAssistantUpdate is skipped when assistantMessageId===null.
    expect(
      state.calls.messagesUpdate.filter((e) => "sources" in e.payload),
    ).toHaveLength(0);
  });

  // ── P6: Existing session forwards STORED project_id, not client-supplied ───
  it("P6: existing session — stored project_id forwarded to backend, client-supplied project_id ignored", async () => {
    // Existing session owned by the user, with project_id = 7 in DB.
    state.sessionRow = {
      data: { id: 50, project_id: 7 },
      error: null,
    };

    fetchMock.mockImplementationOnce(
      async (_url: string, init: RequestInit) => {
        state.calls.backendFetchBody = JSON.parse(
          init.body as string,
        ) as Record<string, unknown>;
        return backendOk(
          makeSseStream([
            { type: "result", answer: "ok", sources: [] },
            "[DONE]",
          ]),
        );
      },
    );

    // Client claims the session belongs to project 999 — must be ignored.
    const req = makeRequest({
      query: "existing session query",
      session_id: 50,
      project_id: 999,
    });
    const res = await POST(req as never);
    await drain(res);

    expect(res.status).toBe(200);
    // The backend must receive the STORED project_id = 7, not the client's 999.
    expect(state.calls.backendFetchBody).not.toBeNull();
    expect(state.calls.backendFetchBody!.project_id).toBe(7);
    expect(state.calls.backendFetchBody!.project_id).not.toBe(999);
  });

  // ── P7: Client disconnect mid-stream — final persistence still happens ─────
  it("P7: client cancels the response stream mid-turn → backend pump continues; final content + sources persisted, no cancel marking", async () => {
    const sources = [{ title: "Doc B", url: "https://example.com/b" }];
    const enc = new TextEncoder();
    const sse = (e: Record<string, unknown> | string) =>
      enc.encode(`data: ${typeof e === "string" ? e : JSON.stringify(e)}\n\n`);

    // Manually-controlled backend stream so the client can disconnect while
    // the backend is still mid-generation.
    let backendCtl!: ReadableStreamDefaultController<Uint8Array>;
    const backendStream = new ReadableStream<Uint8Array>({
      start(c) {
        backendCtl = c;
      },
    });
    fetchMock.mockResolvedValueOnce(backendOk(backendStream));

    const req = makeRequest({ query: "long generation" });
    const res = await POST(req as never);
    expect(res.status).toBe(200);

    // Read the session event + the first delta, then DISCONNECT the client.
    const reader = res.body!.getReader();
    await reader.read(); // session event
    backendCtl.enqueue(sse({ type: "delta", text: "Hel" }));
    await reader.read(); // forwarded delta
    await reader.cancel(); // client goes away (tab closed / connection dropped)

    // Backend keeps generating after the disconnect and eventually finishes.
    backendCtl.enqueue(sse({ type: "delta", text: "lo" }));
    backendCtl.enqueue(sse({ type: "result", answer: "Hello", sources }));
    backendCtl.enqueue(sse("[DONE]"));
    backendCtl.close();

    // In production after() keeps the function alive until the pump settles;
    // the mock captured that same task — await it.
    await Promise.all(afterTasks);

    // The final write must have landed despite the client disconnect.
    const finalUpdate = state.calls.messagesUpdate.find(
      (e) => "sources" in e.payload,
    );
    expect(finalUpdate).toBeDefined();
    expect(finalUpdate!.payload.content).toBe("Hello");
    expect(finalUpdate!.payload.sources).toEqual(sources);
    expect(finalUpdate!.eqId).toBe(101);

    // The turn completed normally — it must NOT be marked cancelled.
    expect(
      state.calls.messagesUpdate.some((e) => e.payload.is_cancelled === true),
    ).toBe(false);
  });

  // ── P8: No incremental write can land after finalization ───────────────────
  it("P8: a straggler delta after result never produces a debounced write that clobbers the final content/sources", async () => {
    const sources = [{ title: "S" }];
    fetchMock.mockResolvedValueOnce(
      backendOk(
        makeSseStream([
          { type: "delta", text: "partial " },
          { type: "result", answer: "final answer", sources },
          // Straggler delta AFTER the result — without the finalized guard this
          // would arm a 400ms debounce timer whose write lands after the final
          // one, clobbering it with stale content (and no sources).
          { type: "delta", text: "stray" },
          "[DONE]",
        ]),
      ),
    );

    const req = makeRequest({ query: "late delta" });
    const res = await POST(req as never);
    await drain(res);
    await Promise.all(afterTasks);

    // The last write must be the final result write.
    const updateCount = state.calls.messagesUpdate.length;
    const last = state.calls.messagesUpdate[updateCount - 1];
    expect(last.payload.content).toBe("final answer");
    expect(last.payload.sources).toEqual(sources);

    // Wait out the 400ms debounce window: no further write may land.
    await new Promise((r) => setTimeout(r, 500));
    expect(state.calls.messagesUpdate).toHaveLength(updateCount);
  });

  // ── P9: Non-OK backend response after pre-create marks the row cancelled ───
  it("P9: backend responds non-OK after pre-create → 502 and the pre-created assistant row is marked cancelled", async () => {
    fetchMock.mockResolvedValueOnce(new Response("boom", { status: 500 }));

    const res = await POST(makeRequest({ query: "backend 500" }) as never);
    expect(res.status).toBe(502);

    const cancelUpdate = state.calls.messagesUpdate.find(
      (e) => e.payload.is_cancelled === true,
    );
    expect(cancelUpdate).toBeDefined();
    expect(cancelUpdate!.eqId).toBe(101);
    // No content/sources write — the turn never streamed anything.
    expect(
      state.calls.messagesUpdate.filter((e) => "sources" in e.payload),
    ).toHaveLength(0);
  });
});
