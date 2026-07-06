/**
 * Chat API client. Talks to Next.js server routes under /api/chat/*,
 * which proxy to the FastAPI backend and own auth + persistence.
 */
import { createClient } from "@/lib/supabase/client";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  /** Base64 data: URLs for images attached to this user turn — re-sent so
   *  multimodal models keep visual context across turns. */
  images?: string[];
}

export interface AttachmentFile {
  filename: string;
  /** Full extracted text. Optional: reference-shape attachments (hash set, no content)
   *  are emitted by collectSessionAttachments for prior turns; the route resolves them. */
  content?: string;
  file_type: string;
  /** Lowercase hex SHA-256 of content, set after a successful store in
   *  client_chat_attachments. Absent for legacy inline attachments. */
  hash?: string;
}

export interface SourceDocument {
  content: string;
  filename: string;
  page_number?: number;
  relevance_score?: number;
}

export interface ChatRequest {
  query: string;
  history?: ChatMessage[];
  attachments?: AttachmentFile[];
  include_sources?: boolean;
  model_preference?: "fast" | "thinking";
  session_id?: number | null;
  // Client-minted opaque chat id (uuid) for a brand-new conversation, so the URL
  // is known before the first response. Ignored when session_id is set.
  public_id?: string | null;
  // Regenerate the active branch's latest answer: the server persists a new
  // assistant sibling under the existing user turn instead of a duplicate user row.
  regenerate?: boolean;
  // Active project id, so the assistant's live-data tools scope to the project
  // currently selected in the header. Membership is re-verified server-side.
  project_id?: number | null;
}

export interface ChatResponse {
  answer: string;
  sources: SourceDocument[];
  timestamp: string;
  session_id: number | null;
}

// A tool lifecycle event streamed mid-turn by the agent: `tool_call` when a tool
// is invoked, `tool_result` when it returns. Used to build the live process
// timeline; ephemeral (never persisted).
export type ToolEvent =
  | { type: "tool_call"; id: string; name: string; input?: unknown }
  | {
      type: "tool_result";
      id: string;
      name: string;
      output?: { sources?: unknown[]; text?: string };
    };

/**
 * Send a chat message via SSE streaming.
 * - onPhase fires on backend phase changes (thinking/planning/searching/generating).
 * - onDelta fires for each token chunk as the model generates.
 * - onReasoning fires for each reasoning/thinking chunk (thinking-model turns
 *   only); interleaved before the answer deltas. Ephemeral — shown live, never
 *   persisted.
 * - onSession fires once when the server route confirms (or creates) the session.
 * - onTool fires on tool lifecycle events (tool_call / tool_result), used to
 *   build the live process timeline. Ephemeral — never persisted.
 */
export async function sendChatMessage(
  request: ChatRequest,
  signal?: AbortSignal,
  onPhase?: (phase: string) => void,
  onDelta?: (text: string) => void,
  onSession?: (sessionId: number) => void,
  onReasoning?: (text: string) => void,
  onTool?: (event: ToolEvent) => void,
): Promise<ChatResponse> {
  const response = await fetch("/api/chat/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: request.query,
      history: request.history ?? [],
      attachments: request.attachments ?? [],
      include_sources: request.include_sources ?? true,
      model_preference: request.model_preference ?? "fast",
      session_id: request.session_id ?? null,
      public_id: request.public_id ?? null,
      regenerate: request.regenerate ?? false,
      project_id: request.project_id ?? null,
    }),
    signal,
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let result: ChatResponse | null = null;
  let sessionId: number | null = null;
  // Accumulate streamed answer text as a fallback: if the backend ends the
  // stream without a final `result` event (e.g. it crashes after emitting some
  // deltas), we still surface what was generated instead of throwing away a
  // perfectly good partial answer.
  let accumulatedAnswer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;

      const data = trimmed.slice(6);
      if (data === "[DONE]") continue;

      try {
        const event = JSON.parse(data);

        if (event.type === "session" && typeof event.session_id === "number") {
          sessionId = event.session_id;
          onSession?.(event.session_id);
        } else if (event.type === "phase" && onPhase) {
          onPhase(event.phase);
        } else if (event.type === "delta") {
          accumulatedAnswer += event.text || "";
          onDelta?.(event.text || "");
        } else if (event.type === "reasoning" && onReasoning) {
          onReasoning(event.text || "");
        } else if (event.type === "tool_call" && onTool) {
          onTool({
            type: "tool_call",
            id: String(event.id ?? ""),
            name: String(event.name ?? ""),
            input: event.input,
          });
        } else if (event.type === "tool_result" && onTool) {
          onTool({
            type: "tool_result",
            id: String(event.id ?? ""),
            name: String(event.name ?? ""),
            output: event.output,
          });
        } else if (event.type === "result") {
          result = {
            answer: event.answer || "",
            sources: event.sources || [],
            timestamp: new Date().toISOString(),
            session_id: sessionId,
          };
        } else if (event.type === "error") {
          throw new Error(event.message || "Server error");
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }

  if (result) return result;
  // No `result` event arrived. If text streamed, surface it as the answer rather
  // than discarding the turn; only error out when nothing at all was received.
  if (accumulatedAnswer.trim()) {
    return {
      answer: accumulatedAnswer,
      sources: [],
      timestamp: new Date().toISOString(),
      session_id: sessionId,
    };
  }
  throw new Error("No result received from server");
}

/**
 * Compute a lowercase hex SHA-256 of `content`, upsert it into
 * client_chat_attachments (content-addressed; UNIQUE on uid+hash means a
 * duplicate is silently ignored), and return the attachment with `hash` set.
 * On any store failure the attachment is returned WITHOUT a hash so the caller
 * falls back to the legacy inline-content path — the turn still works.
 */
async function storeAttachment(att: AttachmentFile): Promise<AttachmentFile> {
  const text = att.content ?? "";
  const buffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  const hash = Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const supabase = createClient();
  const { error } = await supabase.from("client_chat_attachments").upsert(
    {
      content_hash: hash,
      filename: att.filename,
      file_type: att.file_type,
      content: text,
      byte_len: text.length,
    },
    { onConflict: "uid,content_hash", ignoreDuplicates: true },
  );

  if (error) {
    console.warn(
      "[chat] attachment store failed, falling back to inline:",
      error.message,
    );
    return att; // No hash — route receives inline content (legacy path)
  }

  return { ...att, hash };
}

/**
 * Fetch the full extracted text of one of the caller's own chat attachments by
 * content hash (RLS: owner-only). Used by "Save to project knowledge". Returns
 * null when the row is missing or unreadable.
 */
export async function getAttachmentContent(
  hash: string,
): Promise<{ filename: string; content: string } | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("client_chat_attachments")
    .select("filename, content")
    .eq("content_hash", hash)
    .maybeSingle();
  if (error || !data?.content) return null;
  return { filename: data.filename, content: data.content };
}

/**
 * Extract content from a file for session-only attachment.
 * PDF/DOCX go through the backend (via the /api/chat/extract proxy), and so do
 * images — the backend returns them as a base64 data: URL that the multimodal
 * chat models read as pixels. Plain text is read entirely in the browser.
 * After extraction the content is stored in client_chat_attachments (content-
 * addressed) and subsequent turns reference it by hash rather than resending.
 */
export async function extractFileText(file: File): Promise<AttachmentFile> {
  const filename = file.name.toLowerCase();

  if (
    filename.endsWith(".pdf") ||
    filename.endsWith(".doc") ||
    filename.endsWith(".docx") ||
    file.type.startsWith("image/") ||
    /\.(png|jpe?g|webp|gif)$/.test(filename)
  ) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/chat/extract", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ detail: "Failed to extract text" }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    const att: AttachmentFile = await response.json();
    return storeAttachment(att);
  }

  const content = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });

  return storeAttachment({ filename: file.name, content, file_type: "txt" });
}
