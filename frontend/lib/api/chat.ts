/**
 * Chat API client. Talks to Next.js server routes under /api/chat/*,
 * which proxy to the FastAPI backend and own auth + persistence.
 */

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

export interface AttachmentFile {
  filename: string;
  content: string;
  file_type: string;
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

/**
 * Send a chat message via SSE streaming.
 * - onPhase fires on backend phase changes (thinking/planning/searching/generating).
 * - onDelta fires for each token chunk as the model generates.
 * - onReasoning fires for each reasoning/thinking chunk (thinking-model turns
 *   only); interleaved before the answer deltas. Ephemeral — shown live, never
 *   persisted.
 * - onSession fires once when the server route confirms (or creates) the session.
 */
export async function sendChatMessage(
  request: ChatRequest,
  signal?: AbortSignal,
  onPhase?: (phase: string) => void,
  onDelta?: (text: string) => void,
  onSession?: (sessionId: number) => void,
  onReasoning?: (text: string) => void,
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
        } else if (event.type === "delta" && onDelta) {
          onDelta(event.text || "");
        } else if (event.type === "reasoning" && onReasoning) {
          onReasoning(event.text || "");
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

  if (!result) throw new Error("No result received from server");
  return result;
}

/**
 * Extract text from a file for session-only attachment.
 * PDF/DOCX go through the backend (via the /api/chat/extract proxy); plain text
 * is read entirely in the browser.
 */
export async function extractFileText(file: File): Promise<AttachmentFile> {
  const filename = file.name.toLowerCase();

  if (
    filename.endsWith(".pdf") ||
    filename.endsWith(".doc") ||
    filename.endsWith(".docx")
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

    return response.json();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        filename: file.name,
        content: reader.result as string,
        file_type: "txt",
      });
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}
