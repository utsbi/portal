import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatAttachment {
  filename: string;
  content: string;
  file_type: string;
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
  // Other keys in the session's metadata jsonb are carried forward on every
  // active_leaf_id write so we never clobber them (read once here, not per write).
  let sessionMetadata: Record<string, unknown> = {};
  // A chat's project is FIXED at creation. For an existing session we forward the
  // STORED project_id (not the client's current header value), so switching the
  // active project mid-chat — or reopening an old chat under a different project —
  // can never silently re-scope the conversation and mix another project's data.
  let sessionProjectId: number | null = null;
  if (sessionId !== null) {
    const { data: existing } = await supabase
      .from("client_chat_sessions")
      .select("id, metadata, project_id")
      .eq("id", sessionId)
      .maybeSingle();
    if (!existing) return jsonError(404, "Session not found or not owned");
    if (existing.metadata && typeof existing.metadata === "object") {
      sessionMetadata = existing.metadata as Record<string, unknown>;
    }
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

  // Branching: messages form a parent/child tree. The client resends the history
  // up to the branch point (full thread for a normal turn; truncated for an
  // edit). The new user turn attaches to active_path[history.length-1], so a
  // normal turn appends to the tip while an edited turn forks a NEW sibling
  // branch. The superseded branch is KEPT (not deleted) and simply sits off the
  // active path until the user switches back to it.
  //
  // A regenerate is different: it produces a NEW answer for the SAME user turn,
  // so it skips the user insert and parents its assistant row as a sibling of the
  // current answer (i.e. onto the active leaf's parent).
  const isRegenerate = body.regenerate === true && !isNewSession;
  let userParentId: number | null = null;
  let regenAssistantParentId: number | null = null;
  if (!isNewSession) {
    const historyLen = Array.isArray(body.history) ? body.history.length : 0;
    if (historyLen > 0 || isRegenerate) {
      const { data: allRows } = await supabase
        .from("client_chat_messages")
        .select("id, parent_id, role")
        .eq("session_id", sessionId);
      const rows = (allRows ?? []) as Array<{
        id: number;
        parent_id: number | null;
        role: string;
      }>;
      const byId = new Map<number, (typeof rows)[number]>();
      let maxLeaf: (typeof rows)[number] | null = null;
      for (const r of rows) {
        byId.set(r.id, r);
        if (!maxLeaf || r.id > maxLeaf.id) maxLeaf = r;
      }
      // Start from the session's active leaf (maintained on every turn and when a
      // branch is switched), so a turn sent after switching to an older branch
      // attaches to THAT branch's tip — not the newest row overall. Fall back to
      // the newest row for legacy sessions that never got an active_leaf_id.
      const activeLeafId =
        typeof sessionMetadata.active_leaf_id === "number"
          ? (sessionMetadata.active_leaf_id as number)
          : null;
      const leaf =
        (activeLeafId != null ? byId.get(activeLeafId) : null) ?? maxLeaf;

      if (isRegenerate) {
        // New answer = sibling of the current one: parent it to the active leaf's
        // parent when that leaf is itself an answer; if the active leaf is an
        // unanswered user turn, parent directly to it (its first answer).
        regenAssistantParentId =
          leaf == null
            ? null
            : leaf.role === "assistant"
              ? leaf.parent_id
              : leaf.id;
      } else {
        // Active branch, root -> leaf.
        const path: number[] = [];
        const seen = new Set<number>();
        for (let cur = leaf; cur && !seen.has(cur.id); ) {
          seen.add(cur.id);
          path.push(cur.id);
          cur =
            cur.parent_id != null ? (byId.get(cur.parent_id) ?? null) : null;
        }
        path.reverse();
        const idx = Math.min(historyLen, path.length) - 1;
        userParentId = idx >= 0 ? path[idx] : null;
      }
    }
  }

  // Persist the user message immediately so cancelled streams still keep the user
  // turn. Keep the extracted `content` too: the backend is stateless and requires
  // each attachment's content on every turn, so a reloaded conversation must be
  // able to re-send it. Storing only the filename made follow-up turns 422 after a
  // reload. A regenerate reuses the existing user turn, so it skips this insert.
  let userMessageId: number | null = null;
  if (!isRegenerate) {
    const userAttachmentsForRow = body.attachments?.length
      ? body.attachments.map((a) => ({
          filename: a.filename,
          content: a.content,
        }))
      : null;
    const { data: userRow, error: userMsgErr } = await supabase
      .from("client_chat_messages")
      .insert({
        session_id: sessionId,
        role: "user",
        content: body.query,
        attachments: userAttachmentsForRow,
        model_preference: modelPreference,
        parent_id: userParentId,
      })
      .select("id")
      .single();
    // A failed user insert must abort the turn: forwarding to the backend and
    // persisting the answer with a null parent would orphan the assistant row,
    // corrupting the message tree (an answer with no question above it).
    if (userMsgErr || !userRow) {
      return jsonError(
        500,
        `Failed to persist user message: ${userMsgErr?.message ?? "unknown"}`,
      );
    }
    userMessageId = userRow.id;

    // Make the just-created user turn the session's active leaf immediately. This
    // both forks the branch (an edit points the active branch at the new turn) and
    // guarantees the message survives a reload even if the client aborts before a
    // single token streams. The assistant turn bumps the leaf deeper below.
    await supabase
      .from("client_chat_sessions")
      .update({
        metadata: { ...sessionMetadata, active_leaf_id: userMessageId },
      })
      .eq("id", sessionId);
  }

  // Parent for the assistant turn (and any cancelled partial) of this exchange:
  // the freshly-inserted user row for a normal/edit turn, or the existing user
  // turn for a regenerate.
  const assistantParentId = isRegenerate
    ? regenAssistantParentId
    : userMessageId;

  // Advance the session's active leaf to a freshly persisted message, bumping
  // recency in the same write. Re-reads metadata immediately before writing so a
  // concurrent branch switch (which also writes active_leaf_id) is never clobbered
  // by a stale snapshot captured at request start.
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

  // Pre-create the assistant row with empty content BEFORE the backend stream
  // starts so a mid-stream reload, tab switch, or browser close can still see
  // the partial reasoning/tool timeline. The row is mutated incrementally as
  // events stream (debounced) and finalised on `result` (success) or in the
  // cancel-fallback (abort/network). Without this, only the final `result`
  // event would persist anything, and a reload before then would show a user
  // message with no assistant turn at all.
  const { data: asstRowInit, error: asstInitErr } = await supabase
    .from("client_chat_messages")
    .insert({
      session_id: sessionId,
      role: "assistant",
      content: "",
      sources: null,
      model_preference: modelPreference,
      parent_id: assistantParentId,
    })
    .select("id")
    .single();
  if (asstInitErr || !asstRowInit) {
    console.error(
      "[/api/chat] failed to pre-create assistant row:",
      asstInitErr,
    );
  }
  // The id we update during the stream. Null only when the pre-create failed;
  // the cancel-fallback path then inserts a fresh row, preserving the prior
  // behaviour of "always end up with an assistant turn on the branch".
  const assistantMessageId: number | null = asstRowInit?.id ?? null;
  if (assistantMessageId !== null) {
    await advanceActiveLeaf(assistantMessageId);
  }

  // Forward to FastAPI, propagating the client's abort signal so cancellation
  // tears down the upstream generation too.
  let backendRes: Response;
  try {
    backendRes = await fetch(`${BACKEND_URL}/api/v1/chat/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        query: body.query,
        history: body.history ?? [],
        attachments: body.attachments ?? [],
        include_sources: body.include_sources ?? true,
        model_preference: modelPreference,
        // Authoritative: the session's own project, not the live header.
        project_id: sessionProjectId,
      }),
      signal: request.signal,
    });
  } catch (fetchErr) {
    console.error("[/api/chat] network error contacting backend:", fetchErr);
    return jsonError(502, "Upstream request failed");
  }

  if (!backendRes.ok || !backendRes.body) {
    const errText = await backendRes.text().catch(() => "");
    console.error(`Backend error ${backendRes.status}:`, errText);
    return jsonError(502, "Upstream request failed");
  }

  const sessionIdForClosure = sessionId;
  const assistantParentForClosure = assistantParentId;
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

  const scheduleAssistantUpdate = () => {
    if (assistantMessageId === null) return;
    if (pendingUpdate) clearTimeout(pendingUpdate);
    pendingUpdate = setTimeout(() => {
      pendingUpdate = null;
      if (assistantMessageId === null) return;
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

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      const reader = backendRes.body!.getReader();
      let buffer = "";
      // Whether the assistant turn has already been written to the DB (via the
      // `result` event). If the client aborts mid-stream we never see `result`,
      // so the `finally` persists whatever streamed so far as a cancelled turn.
      let persisted = false;

      // Emit session event first so the client can pin its URL/state.
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: "session", session_id: sessionIdForClosure })}\n\n`,
        ),
      );

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Forward upstream bytes immediately so the user sees real-time streaming.
          controller.enqueue(value);

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
        // Client aborted, network issue, etc. Forwarding stops; cleanup happens in finally.
        console.error("[/api/chat] stream error:", err);
      } finally {
        // If the turn streamed text but never reached `result` (client cancelled
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
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
