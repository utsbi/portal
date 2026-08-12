import { after, type NextRequest } from "next/server";
import { getBackendUrl } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const BACKEND_URL = getBackendUrl();

interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
  images?: string[];
}

interface ChatAttachment {
  filename: string;
  /** Full extracted text. Present for legacy inline attachments. */
  content?: string;
  /** SHA-256 reference: route resolves to content from client_chat_attachments. */
  hash?: string;
  file_type: string;
}

interface BeginTurnRow {
  user_message_id: number | null;
  assistant_message_id: number;
  active_leaf_id: number;
}

interface ChatRequestBody {
  query: string;
  history?: ChatHistoryMessage[];
  attachments?: ChatAttachment[];
  include_sources?: boolean;
  model_preference?: "fast" | "thinking";
  session_id?: number | null;
  // Client-minted opaque chat id (uuid) for a brand-new conversation. Used only
  // when creating a session; ownership is still enforced by RLS (uid = the
  // authenticated user), so the id is an identifier, not a capability.
  public_id?: string | null;
  // Regenerate the active branch's latest answer: persist a NEW assistant sibling
  // under the existing user turn rather than inserting a duplicate user row.
  regenerate?: boolean;
  // Active project id: tags a new session and scopes the assistant's live-data
  // tools. The backend re-verifies the caller's membership, so this is a scope
  // hint, not a capability.
  project_id?: number | null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonError(status: number, detail: string) {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError(401, "Unauthorized");

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return jsonError(401, "No active session");

  const body = (await request.json()) as ChatRequestBody;
  if (!body.query?.trim()) return jsonError(400, "query is required");

  const modelPreference = body.model_preference ?? "fast";

  // Resolve session_id: use provided (verifying ownership via RLS) or create new.
  let sessionId = body.session_id ?? null;
  let isNewSession = false;
  // A chat's project is FIXED at creation. For an existing session we forward the
  // STORED project_id (not the client's current header value), so switching the
  // active project mid-chat — or reopening an old chat under a different project —
  // can never silently re-scope the conversation and mix another project's data.
  let sessionProjectId: number | null = null;
  if (sessionId !== null) {
    const { data: existing } = await supabase
      .from("client_chat_sessions")
      .select("id, project_id")
      .eq("id", sessionId)
      .maybeSingle();
    if (!existing) return jsonError(404, "Session not found or not owned");
    sessionProjectId =
      typeof existing.project_id === "number" ? existing.project_id : null;
  } else {
    isNewSession = true;
    // Honor a client-minted uuid so the URL is known before the first response.
    // RLS still scopes the row to this user; a collision just fails the insert.
    const insertRow: {
      uid: string;
      title: string;
      public_id?: string;
      project_id?: number;
    } = {
      uid: user.id,
      title: body.query.slice(0, 60),
    };
    if (body.public_id && UUID_RE.test(body.public_id)) {
      insertRow.public_id = body.public_id;
    }
    // Tag the conversation with the project it was started under (best-effort).
    if (
      typeof body.project_id === "number" &&
      Number.isInteger(body.project_id) &&
      body.project_id > 0
    ) {
      insertRow.project_id = body.project_id;
      sessionProjectId = body.project_id;
    }
    const { data: newSession, error: sessionErr } = await supabase
      .from("client_chat_sessions")
      .insert(insertRow)
      .select("id")
      .single();
    if (sessionErr || !newSession) {
      return jsonError(
        500,
        `Failed to create session: ${sessionErr?.message ?? "unknown"}`,
      );
    }
    sessionId = newSession.id;
  }

  const isRegenerate = body.regenerate === true && !isNewSession;
  const historyLen = Array.isArray(body.history) ? body.history.length : 0;

  // Attachment payload stored with the user turn. New rows carry the reference
  // shape {filename, hash, file_type} so full content is never stored in
  // client_chat_messages; legacy inline rows ({filename, content}) pass through
  // unchanged so old conversations keep working.
  const userAttachmentsForRpc = body.attachments?.length
    ? body.attachments.map((a) =>
        a.hash
          ? { filename: a.filename, hash: a.hash, file_type: a.file_type }
          : { filename: a.filename, content: a.content },
      )
    : null;

  // Advance the session's active leaf to a freshly persisted message, bumping
  // recency in the same write. Re-reads metadata immediately before writing so a
  // concurrent branch switch (which also writes active_leaf_id) is never clobbered
  // by a stale snapshot captured at request start. Called only from error/cancel
  // fallback paths — the happy path's leaf advance is done atomically by the RPC.
  const advanceActiveLeaf = async (leafId: number) => {
    const { data: fresh } = await supabase
      .from("client_chat_sessions")
      .select("metadata")
      .eq("id", sessionId)
      .maybeSingle();
    const meta =
      fresh?.metadata && typeof fresh.metadata === "object"
        ? (fresh.metadata as Record<string, unknown>)
        : {};
    const { error: leafErr } = await supabase
      .from("client_chat_sessions")
      .update({
        updated_at: new Date().toISOString(),
        metadata: { ...meta, active_leaf_id: leafId },
      })
      .eq("id", sessionId);
    if (leafErr)
      console.error("[/api/chat] failed to advance active leaf:", leafErr);
  };

  // --- Parallel: atomic per-turn DB writes + attachment resolution ---
  // chat_begin_turn creates the user + assistant rows atomically. Alongside it,
  // resolveAttachmentRefs fetches the full content for any hash-only reference
  // attachments from client_chat_attachments (RLS-scoped to this user). Neither
  // depends on the other, so both run concurrently. The backend fetch then uses
  // the resolved full-content array — the backend schema/API is unchanged.
  //
  // Inline async resolver (closes over `supabase`). Items that already have
  // `content` (legacy inline shape) pass through unchanged. Items with only a
  // `hash` are batch-selected from client_chat_attachments in one query.
  const resolveAttachmentRefs = async (
    atts: ChatAttachment[],
  ): Promise<ChatAttachment[]> => {
    const refs = atts.filter((a) => !a.content && a.hash);
    if (refs.length === 0) return atts;
    const hashes = refs.map((a) => a.hash as string);
    const { data } = await supabase
      .from("client_chat_attachments")
      .select("content_hash, content, file_type")
      .in("content_hash", hashes);
    const byHash = new Map<string, { content: string; file_type: string }>();
    for (const row of (data ?? []) as Array<{
      content_hash: string;
      content: string;
      file_type: string;
    }>) {
      byHash.set(row.content_hash, {
        content: row.content,
        file_type: row.file_type,
      });
    }
    return atts
      .map((a): ChatAttachment | null => {
        if (!a.content && a.hash) {
          const resolved = byHash.get(a.hash);
          if (!resolved) return null; // not found (deleted?); drop attachment
          return {
            filename: a.filename,
            content: resolved.content,
            file_type: resolved.file_type,
          };
        }
        return a;
      })
      .filter((a): a is ChatAttachment => a !== null && Boolean(a.content));
  };

  let backendRes: Response;
  let assistantMessageId: number | null = null;
  let assistantParentForClosure: number | null = null;

  // Mark the pre-created assistant row cancelled when an early failure (backend
  // fetch throw / non-OK response) means it will never receive content — the
  // orphaned blank row would otherwise render as a forever-loading turn.
  const markPrecreatedRowCancelled = async () => {
    if (assistantMessageId === null) return;
    const { error: cancelErr } = await supabase
      .from("client_chat_messages")
      .update({ is_cancelled: true })
      .eq("id", assistantMessageId);
    if (cancelErr)
      console.error(
        "[/api/chat] failed to mark orphaned assistant row cancelled:",
        cancelErr,
      );
  };

  try {
    const [rpcResult, resolvedAttachments] = await Promise.all([
      supabase
        .rpc("chat_begin_turn", {
          _session_id: sessionId,
          _query: body.query,
          _attachments: userAttachmentsForRpc,
          _model_preference: modelPreference,
          _history_len: historyLen,
          _regenerate: isRegenerate,
        })
        .single() as unknown as Promise<{
        data: BeginTurnRow | null;
        error: { message: string } | null;
      }>,
      resolveAttachmentRefs(body.attachments ?? []),
    ]);

    const { data: rpcData, error: rpcErr } = rpcResult;

    if (rpcErr || !rpcData) {
      return jsonError(
        500,
        `Failed to begin turn: ${rpcErr?.message ?? "unknown"}`,
      );
    }

    assistantMessageId = rpcData.assistant_message_id ?? null;
    // Fallback parent for cancel/error paths that must insert a fresh assistant row.
    assistantParentForClosure = rpcData.user_message_id ?? null;

    // Backend fetch runs after resolve so it receives full content for every
    // attachment (the backend API/schema is unchanged — always expects content).
    backendRes = await fetch(`${BACKEND_URL}/api/v1/chat/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        query: body.query,
        history: body.history ?? [],
        attachments: resolvedAttachments,
        include_sources: body.include_sources ?? true,
        model_preference: modelPreference,
        // Authoritative: the session's own project, not the live header.
        project_id: sessionProjectId,
      }),
      signal: request.signal,
    });
  } catch (err) {
    console.error("[/api/chat] error starting turn:", err);
    await markPrecreatedRowCancelled();
    return jsonError(502, "Upstream request failed");
  }

  if (!backendRes.ok || !backendRes.body) {
    const errText = await backendRes.text().catch(() => "");
    console.error(`Backend error ${backendRes.status}:`, errText);
    await markPrecreatedRowCancelled();
    return jsonError(502, "Upstream request failed");
  }

  // `backendRes.body` is guaranteed non-null by the guard above; capture it
  // here so the stream closure can read it without a non-null assertion.
  const backendBody = backendRes.body;
  const sessionIdForClosure = sessionId;
  const isNewSessionForClosure = isNewSession;
  const accumulated: string[] = [];
  // Reasoning/thinking chunks and tool lifecycle events streamed by the agent,
  // accumulated here so they can be persisted alongside the answer text. The
  // shape of `processSteps` matches the frontend's TimelineStep[] exactly, so a
  // reload can reconstruct the timeline as it streamed.
  let accumulatedReasoning = "";
  const processSteps: Array<Record<string, unknown>> = [];
  // Debounced assistant-row update: a single in-flight timer that always writes
  // the LATEST accumulated state, so a mid-stream reload, tab switch, or
  // browser close sees a recent (sub-second-old) snapshot of the reasoning +
  // tools + partial answer. Cleared + flushed on `result` and on cancel.
  let pendingUpdate: ReturnType<typeof setTimeout> | null = null;
  let updatingPromise: Promise<void> | null = null;
  // Set once the turn's final write (the `result` handler or the cancel
  // fallback) starts. Guards the debounce in BOTH directions — no new timer is
  // scheduled and an already-armed timer becomes a no-op — so a straggling
  // incremental write can never land after finalization and clobber the final
  // content/sources with a stale snapshot.
  let finalized = false;
  let usagePersisted = false;

  const scheduleAssistantUpdate = () => {
    if (finalized || assistantMessageId === null) return;
    if (pendingUpdate) clearTimeout(pendingUpdate);
    pendingUpdate = setTimeout(() => {
      pendingUpdate = null;
      if (finalized || assistantMessageId === null) return;
      const id = assistantMessageId;
      // Snapshot the latest state at the moment the update fires (the closures
      // above are mutated by later events; we want the values at flush time).
      const content = accumulated.join("");
      const reasoning =
        accumulatedReasoning.length > 0 ? accumulatedReasoning : null;
      const steps = processSteps.length > 0 ? processSteps : null;
      updatingPromise = (async () => {
        const { error: updateErr } = await supabase
          .from("client_chat_messages")
          .update({ content, reasoning, process_steps: steps })
          .eq("id", id);
        if (updateErr)
          console.error(
            "[/api/chat] incremental assistant update failed:",
            updateErr,
          );
      })();
    }, 400);
  };

  const flushAssistantUpdate = async () => {
    if (pendingUpdate) {
      clearTimeout(pendingUpdate);
      pendingUpdate = null;
    }
    if (updatingPromise) await updatingPromise;
    if (assistantMessageId === null) return;
    const id = assistantMessageId;
    const content = accumulated.join("");
    const reasoning =
      accumulatedReasoning.length > 0 ? accumulatedReasoning : null;
    const steps = processSteps.length > 0 ? processSteps : null;
    const { error: updateErr } = await supabase
      .from("client_chat_messages")
      .update({ content, reasoning, process_steps: steps })
      .eq("id", id);
    if (updateErr)
      console.error("[/api/chat] flush assistant update failed:", updateErr);
  };

  // ── Client stream, decoupled from the backend pump ──────────────────────────
  // The backend stream is pumped to completion by `pumpBackendStream()` below,
  // whose lifetime is pinned by `after()` — so the final persistence writes
  // (content, sources, timeline, cancel fallback, active-leaf bookkeeping) run
  // even if the client disconnects mid-stream and this response stream is
  // cancelled. The client stream is only a mirror of the pump: cancelling it
  // stops the forwarding, never the pump or its writes. Explicit user
  // cancellation is unchanged — the backend fetch is tied to `request.signal`,
  // so aborting the request still stops backend generation, and the pump then
  // persists the partial answer as a cancelled turn.
  const encoder = new TextEncoder();
  let clientController: ReadableStreamDefaultController<Uint8Array> | null =
    null;
  let clientClosed = false;

  const sendToClient = (chunk: Uint8Array) => {
    if (clientClosed || !clientController) return;
    try {
      clientController.enqueue(chunk);
    } catch {
      // Controller already closed/errored — the client went away mid-enqueue.
      clientClosed = true;
    }
  };

  const closeClient = () => {
    if (clientClosed || !clientController) return;
    clientClosed = true;
    try {
      clientController.close();
    } catch {
      // Already closed by cancellation.
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      clientController = controller;
      // Emit session event first so the client can pin its URL/state.
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: "session", session_id: sessionIdForClosure })}\n\n`,
        ),
      );
    },
    cancel() {
      // Client disconnected (stop button, closed tab, dropped connection).
      // Stop forwarding; the pump keeps running so persistence still completes.
      clientClosed = true;
    },
  });

  const pumpBackendStream = async () => {
    const decoder = new TextDecoder();
    const reader = backendBody.getReader();
    let buffer = "";
    // Whether the assistant turn has already been written to the DB (via the
    // `result` event). If the backend stream ends without one (user abort,
    // network error, or backend crash), the `finally` persists whatever
    // streamed so far as a cancelled turn.
    let persisted = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Forward upstream bytes immediately so the user sees real-time streaming.
        sendToClient(value);

        // Also parse to accumulate text and intercept the final result.
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") continue;

          try {
            const event = JSON.parse(data);
            if (event.type === "delta" && typeof event.text === "string") {
              accumulated.push(event.text);
              scheduleAssistantUpdate();
            } else if (
              event.type === "reasoning" &&
              typeof event.text === "string"
            ) {
              // Coalesce adjacent reasoning chunks into the trailing reasoning
              // step (matches the client's coalescing in runAgent) so the
              // persisted timeline matches what the user saw live.
              accumulatedReasoning += event.text;
              const last = processSteps[processSteps.length - 1];
              if (
                last &&
                last.kind === "reasoning" &&
                typeof last.text === "string"
              ) {
                processSteps[processSteps.length - 1] = {
                  ...last,
                  text: last.text + event.text,
                };
              } else {
                processSteps.push({ kind: "reasoning", text: event.text });
              }
              scheduleAssistantUpdate();
            } else if (
              event.type === "tool_call" &&
              typeof event.id === "string" &&
              typeof event.name === "string"
            ) {
              processSteps.push({
                kind: "tool",
                toolCallId: event.id,
                toolName: event.name,
                state: "running",
              });
              scheduleAssistantUpdate();
            } else if (
              event.type === "tool_result" &&
              typeof event.id === "string"
            ) {
              // Mark the most-recent still-running tool step with this id as
              // done. The running guard means a duplicate/colliding id can
              // never re-mark an already-completed step.
              for (let i = processSteps.length - 1; i >= 0; i--) {
                const s = processSteps[i];
                if (
                  s.kind === "tool" &&
                  s.toolCallId === event.id &&
                  s.state === "running"
                ) {
                  processSteps[i] = {
                    ...s,
                    state: "done",
                    output:
                      (event.output as Record<string, unknown> | undefined) ??
                      undefined,
                  };
                  break;
                }
              }
              scheduleAssistantUpdate();
            } else if (
              event.type === "title" &&
              isNewSessionForClosure &&
              typeof event.title === "string" &&
              event.title.trim()
            ) {
              // Persist the generated title, but only for a freshly created
              // session — never clobber a user rename or a regenerated turn.
              const { error: titleErr } = await supabase
                .from("client_chat_sessions")
                .update({ title: event.title.trim() })
                .eq("id", sessionIdForClosure);
              if (titleErr)
                console.error(
                  "[/api/chat] failed to set generated title:",
                  titleErr,
                );
            } else if (event.type === "result") {
              const usage =
                event.usage && typeof event.usage === "object"
                  ? (event.usage as Record<string, unknown>)
                  : null;
              if (!usagePersisted && usage) {
                const numberOrZero = (value: unknown) =>
                  typeof value === "number" &&
                  Number.isFinite(value) &&
                  value >= 0
                    ? Math.floor(value)
                    : 0;
                const model =
                  typeof usage.model === "string" ? usage.model : "unknown";
                const preference =
                  usage.model_preference === "thinking" ? "thinking" : "fast";
                const reasoningEffort =
                  typeof usage.reasoning_effort === "string"
                    ? usage.reasoning_effort
                    : null;
                const promptTokens = numberOrZero(usage.prompt_tokens);
                const completionTokens = numberOrZero(usage.completion_tokens);
                const reasoningTokens = numberOrZero(usage.reasoning_tokens);
                const totalTokens = numberOrZero(usage.total_tokens);
                const estimatedCost =
                  typeof usage.estimated_cost_usd === "number" &&
                  Number.isFinite(usage.estimated_cost_usd) &&
                  usage.estimated_cost_usd >= 0
                    ? usage.estimated_cost_usd
                    : 0;
                const { error: usageError } = await createAdminClient()
                  .from("ai_usage_events")
                  .insert({
                    uid: user.id,
                    project_id: sessionProjectId,
                    model,
                    model_preference: preference,
                    reasoning_effort: reasoningEffort,
                    prompt_tokens: promptTokens,
                    completion_tokens: completionTokens,
                    reasoning_tokens: reasoningTokens,
                    total_tokens: totalTokens,
                    estimated_cost_usd: estimatedCost,
                    metadata: { session_id: sessionIdForClosure },
                  });
                usagePersisted = true;
                if (usageError)
                  console.error(
                    "[/api/chat] failed to persist usage event:",
                    usageError,
                  );
              }
              // From here on the final state is being written; block any
              // straggling debounced write from landing after it.
              finalized = true;
              const finalContent =
                (event.answer as string | undefined) ?? accumulated.join("");
              // Flush any pending incremental update first so the final write
              // is the one true state (it carries sources; the incremental
              // ones don't because sources only arrive on `result`).
              await flushAssistantUpdate();
              if (assistantMessageId !== null) {
                const { error: updateErr } = await supabase
                  .from("client_chat_messages")
                  .update({
                    content: finalContent,
                    sources: event.sources ?? null,
                  })
                  .eq("id", assistantMessageId);
                if (updateErr)
                  console.error(
                    "[/api/chat] failed to finalize assistant message:",
                    updateErr,
                  );
              } else {
                // The pre-create failed earlier; fall back to a single insert
                // so the branch still ends with an assistant turn.
                const { data: asstRow, error: asstErr } = await supabase
                  .from("client_chat_messages")
                  .insert({
                    session_id: sessionIdForClosure,
                    role: "assistant",
                    content: finalContent,
                    sources: event.sources ?? null,
                    reasoning:
                      accumulatedReasoning.length > 0
                        ? accumulatedReasoning
                        : null,
                    process_steps:
                      processSteps.length > 0 ? processSteps : null,
                    model_preference: modelPreference,
                    parent_id: assistantParentForClosure,
                  })
                  .select("id")
                  .single();
                if (asstErr)
                  console.error(
                    "[/api/chat] failed to persist assistant message (fallback):",
                    asstErr,
                  );
                if (asstRow?.id != null) {
                  await advanceActiveLeaf(asstRow.id);
                }
              }
              persisted = true;
            }
          } catch {
            // Non-JSON or partial lines — already forwarded as bytes.
          }
        }
      }
    } catch (err) {
      // Backend aborted (user cancel), network issue, etc. Cleanup happens in finally.
      console.error("[/api/chat] stream error:", err);
    } finally {
      // Finalization starts now — no incremental write may land past this point.
      finalized = true;
      // If the turn streamed text but never reached `result` (user cancelled
      // mid-stream, network error, or backend crash), persist the partial
      // answer — plus any reasoning + tool steps that streamed so far — as a
      // cancelled turn. This is what makes a reload after a stop-button click
      // show the partial ProcessTimeline rather than a blank assistant bubble.
      if (!persisted) {
        // Cancel any pending debounced update and wait for in-flight writes
        // so we don't double-write the row.
        if (pendingUpdate) {
          clearTimeout(pendingUpdate);
          pendingUpdate = null;
        }
        if (updatingPromise) await updatingPromise;
        const partialContent = accumulated.join("");
        if (assistantMessageId !== null) {
          const { error: updateErr } = await supabase
            .from("client_chat_messages")
            .update({
              content: partialContent,
              is_cancelled: true,
              reasoning:
                accumulatedReasoning.length > 0 ? accumulatedReasoning : null,
              process_steps: processSteps.length > 0 ? processSteps : null,
            })
            .eq("id", assistantMessageId);
          if (updateErr)
            console.error(
              "[/api/chat] failed to mark assistant cancelled:",
              updateErr,
            );
        } else if (partialContent.length > 0) {
          // Pre-create failed; insert a fresh cancelled row so the branch
          // still has an assistant turn (mirrors the prior fallback).
          const { data: cancelRow, error: cancelErr } = await supabase
            .from("client_chat_messages")
            .insert({
              session_id: sessionIdForClosure,
              role: "assistant",
              content: partialContent,
              is_cancelled: true,
              reasoning:
                accumulatedReasoning.length > 0 ? accumulatedReasoning : null,
              process_steps: processSteps.length > 0 ? processSteps : null,
              model_preference: modelPreference,
              parent_id: assistantParentForClosure,
            })
            .select("id")
            .single();
          if (cancelErr) {
            console.error(
              "[/api/chat] failed to persist cancelled partial:",
              cancelErr,
            );
          } else if (cancelRow?.id != null) {
            await advanceActiveLeaf(cancelRow.id);
          }
        }
      }
      closeClient();
    }
  };

  // Start pumping the backend immediately, and pin the (serverless) function's
  // lifetime to the pump with `after()` so the writes above are guaranteed to
  // run even when the client-facing response stream is cancelled mid-turn.
  after(pumpBackendStream());

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
