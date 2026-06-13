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
  if (sessionId !== null) {
    const { data: existing } = await supabase
      .from("client_chat_sessions")
      .select("id, metadata")
      .eq("id", sessionId)
      .maybeSingle();
    if (!existing) return jsonError(404, "Session not found or not owned");
    if (existing.metadata && typeof existing.metadata === "object") {
      sessionMetadata = existing.metadata as Record<string, unknown>;
    }
  } else {
    isNewSession = true;
    // Honor a client-minted uuid so the URL is known before the first response.
    // RLS still scopes the row to this user; a collision just fails the insert.
    const insertRow: { uid: string; title: string; public_id?: string } = {
      uid: user.id,
      title: body.query.slice(0, 60),
    };
    if (body.public_id && UUID_RE.test(body.public_id)) {
      insertRow.public_id = body.public_id;
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

  // Forward to FastAPI, propagating the client's abort signal so cancellation
  // tears down the upstream generation too.
  const backendRes = await fetch(`${BACKEND_URL}/api/v1/chat/`, {
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
    }),
    signal: request.signal,
  });

  if (!backendRes.ok || !backendRes.body) {
    const errText = await backendRes.text().catch(() => "");
    return jsonError(
      backendRes.status || 502,
      errText || `Backend HTTP ${backendRes.status}`,
    );
  }

  const sessionIdForClosure = sessionId;
  const assistantParentForClosure = assistantParentId;
  const isNewSessionForClosure = isNewSession;
  const accumulated: string[] = [];

  // Advance the session's active leaf to a freshly persisted message, bumping
  // recency in the same write. Re-reads metadata immediately before writing so a
  // concurrent branch switch (which also writes active_leaf_id) is never clobbered
  // by a stale snapshot captured at request start.
  const advanceActiveLeaf = async (leafId: number) => {
    const { data: fresh } = await supabase
      .from("client_chat_sessions")
      .select("metadata")
      .eq("id", sessionIdForClosure)
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
      .eq("id", sessionIdForClosure);
    if (leafErr)
      console.error("[/api/chat] failed to advance active leaf:", leafErr);
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
                const { data: asstRow, error: asstErr } = await supabase
                  .from("client_chat_messages")
                  .insert({
                    session_id: sessionIdForClosure,
                    role: "assistant",
                    content: finalContent,
                    sources: event.sources ?? null,
                    model_preference: modelPreference,
                    parent_id: assistantParentForClosure,
                  })
                  .select("id")
                  .single();
                if (asstErr)
                  console.error(
                    "[/api/chat] failed to persist assistant message:",
                    asstErr,
                  );
                persisted = true;

                // Advance the active leaf to this answer (and bump updated_at) so a
                // reload follows the branch just streamed. If the insert failed,
                // still bump recency so the session sorts correctly.
                if (asstRow?.id != null) {
                  await advanceActiveLeaf(asstRow.id);
                } else {
                  await supabase
                    .from("client_chat_sessions")
                    .update({ updated_at: new Date().toISOString() })
                    .eq("id", sessionIdForClosure);
                }
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
        // mid-stream), persist the partial answer as a cancelled turn so a
        // reloaded thread keeps it instead of showing an unanswered user message.
        if (!persisted && accumulated.length > 0) {
          const { data: cancelRow, error: cancelErr } = await supabase
            .from("client_chat_messages")
            .insert({
              session_id: sessionIdForClosure,
              role: "assistant",
              content: accumulated.join(""),
              is_cancelled: true,
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
