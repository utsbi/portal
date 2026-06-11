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
  if (sessionId !== null) {
    const { data: existing } = await supabase
      .from("client_chat_sessions")
      .select("id")
      .eq("id", sessionId)
      .maybeSingle();
    if (!existing) return jsonError(404, "Session not found or not owned");
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

  // Edit/regenerate reconciliation: the client resends a (possibly truncated)
  // history when a turn is edited or regenerated. Trim the stored messages to
  // match that history before writing the new turn, so superseded rows don't
  // linger and reappear on reload. For a normal next turn (history == full
  // thread) this deletes nothing. New sessions have nothing to trim.
  if (!isNewSession && Array.isArray(body.history)) {
    const keep = body.history.length;
    const { data: existingMsgs } = await supabase
      .from("client_chat_messages")
      .select("id")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (existingMsgs && existingMsgs.length > keep) {
      const toDelete = existingMsgs.slice(keep).map((m) => m.id);
      const { error: trimErr } = await supabase
        .from("client_chat_messages")
        .delete()
        .eq("session_id", sessionId)
        .in("id", toDelete);
      if (trimErr) {
        console.error(
          "[/api/chat] failed to trim superseded messages:",
          trimErr,
        );
      }
    }
  }

  // Persist the user message immediately so cancelled streams still keep the user turn.
  const userAttachmentsForRow = body.attachments?.length
    ? body.attachments.map((a) => ({ filename: a.filename }))
    : null;
  const { error: userMsgErr } = await supabase
    .from("client_chat_messages")
    .insert({
      session_id: sessionId,
      role: "user",
      content: body.query,
      attachments: userAttachmentsForRow,
      model_preference: modelPreference,
    });
  if (userMsgErr) {
    console.error("[/api/chat] failed to persist user message:", userMsgErr);
  }

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
      project_id: body.project_id ?? null,
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
  const isNewSessionForClosure = isNewSession;
  const accumulated: string[] = [];

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      const reader = backendRes.body!.getReader();
      let buffer = "";

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
                const { error: asstErr } = await supabase
                  .from("client_chat_messages")
                  .insert({
                    session_id: sessionIdForClosure,
                    role: "assistant",
                    content: finalContent,
                    sources: event.sources ?? null,
                    model_preference: modelPreference,
                  });
                if (asstErr)
                  console.error(
                    "[/api/chat] failed to persist assistant message:",
                    asstErr,
                  );

                const { error: bumpErr } = await supabase
                  .from("client_chat_sessions")
                  .update({ updated_at: new Date().toISOString() })
                  .eq("id", sessionIdForClosure);
                if (bumpErr)
                  console.error(
                    "[/api/chat] failed to bump session updated_at:",
                    bumpErr,
                  );
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
