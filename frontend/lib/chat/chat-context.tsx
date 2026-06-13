"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  type AttachmentFile,
  type ChatMessage,
  extractFileText,
  type SourceDocument,
  sendChatMessage,
} from "@/lib/api/chat";
import { createClient } from "@/lib/supabase/client";

export type ModelPreference = "fast" | "thinking";

export type LoadingPhase =
  | "idle"
  | "thinking"
  | "planning"
  | "searching"
  | "generating"
  | "complete"
  | "error";

export interface MessageAttachment {
  filename: string;
  content: string;
}

export interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceDocument[];
  attachments?: MessageAttachment[];
  timestamp: Date;
  isStreaming?: boolean;
  isCancelled?: boolean;
  // Reasoning/thinking tokens streamed before the answer on thinking-model
  // turns. Ephemeral — shown live in a collapsible section, never persisted.
  reasoning?: string;
}

export interface SessionSummary {
  id: number;
  public_id: string;
  title: string | null;
  updated_at: string | null;
  project_id: number | null;
  pinned: boolean;
}

interface ChatContextType {
  messages: DisplayMessage[];
  sessionId: number | null;
  sessionPublicId: string | null;
  sessionTitle: string | null;
  loadingPhase: LoadingPhase;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  // True when the most recent loadSession() failed to hydrate a conversation
  // (unknown id, RLS, or fetch error). Lets the surface show an empty/error
  // state instead of a blank thread. Reset on any successful load / new session.
  loadFailed: boolean;
  // True while loadSession() is fetching a conversation's history. Lets the
  // surface show a loading skeleton instead of a momentarily-empty thread.
  isHydrating: boolean;
  attachments: AttachmentFile[];
  loadingAttachments: string[];
  modelPreference: ModelPreference;
  setModelPreference: (model: ModelPreference) => void;
  sendMessage: (query: string) => Promise<void>;
  retryLastMessage: () => Promise<void>;
  addAttachment: (file: File) => Promise<void>;
  removeAttachment: (filename: string) => void;
  clearChat: () => void;
  cancelRequest: () => void;
  editAndResend: (messageId: string, newContent: string) => Promise<void>;
  regenerateResponse: () => Promise<void>;
  newSession: () => void;
  loadSession: (publicId: string) => Promise<boolean>;
  listSessions: () => Promise<SessionSummary[]>;
  renameSession: (sessionId: number, title: string) => Promise<void>;
  setPinned: (sessionId: number, pinned: boolean) => Promise<void>;
  deleteSession: (sessionId: number) => Promise<void>;
  sessionList: SessionSummary[];
  sessionsLoaded: boolean;
  refreshSessions: () => Promise<SessionSummary[]>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [sessionId, setSessionIdState] = useState<number | null>(null);
  const [sessionPublicId, setSessionPublicIdState] = useState<string | null>(
    null,
  );
  const [sessionTitle, setSessionTitle] = useState<string | null>(null);
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isHydrating, setIsHydrating] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [modelPreference, setModelPreference] =
    useState<ModelPreference>("fast");
  const [loadingAttachments, setLoadingAttachments] = useState<string[]>([]);
  // Shared, cached conversation list. Lives here (provider stays mounted for the
  // whole dashboard session) so the history sidebar and the /chats page read the
  // same data without refetching on every open.
  const [sessionList, setSessionList] = useState<SessionSummary[]>([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const sessionsLoadedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);
  const sessionIdRef = useRef<number | null>(null);

  const isLoading =
    loadingPhase !== "idle" &&
    loadingPhase !== "complete" &&
    loadingPhase !== "error";

  const setSessionId = useCallback((id: number | null) => {
    sessionIdRef.current = id;
    setSessionIdState(id);
  }, []);

  const setSessionPublicId = useCallback((pid: string | null) => {
    setSessionPublicIdState(pid);
  }, []);

  // Resolve a session's opaque public_id from its bigint id (used after the
  // backend creates a new session and only returns the numeric id).
  const syncPublicId = useCallback(
    async (id: number) => {
      const supabase = createClient();
      const { data } = await supabase
        .from("client_chat_sessions")
        .select("public_id, title")
        .eq("id", id)
        .maybeSingle();
      if (data?.public_id) setSessionPublicId(data.public_id as string);
      if (data) setSessionTitle((data.title as string | null) ?? null);
    },
    [setSessionPublicId],
  );

  const collectSessionAttachments = useCallback(
    (
      msgs: DisplayMessage[],
      extraAttachments?: AttachmentFile[],
    ): AttachmentFile[] => {
      const seen = new Set<string>();
      const all: AttachmentFile[] = [];

      for (const msg of msgs) {
        if (msg.role === "user" && msg.attachments) {
          for (const a of msg.attachments) {
            // Skip attachments whose content didn't survive (e.g. conversations
            // persisted before attachment content was stored). The stateless
            // backend rejects a contentless attachment with a 422, so dropping it
            // degrades gracefully — the turn still sends, just without that doc.
            if (!a.content) continue;
            if (!seen.has(a.filename)) {
              seen.add(a.filename);
              all.push({
                filename: a.filename,
                content: a.content,
                file_type: a.filename.split(".").pop()?.toLowerCase() || "txt",
              });
            }
          }
        }
      }

      if (extraAttachments) {
        for (const a of extraAttachments) {
          if (!seen.has(a.filename)) {
            seen.add(a.filename);
            all.push(a);
          }
        }
      }

      return all;
    },
    [],
  );

  const handlePhase = useCallback((phase: string) => {
    if (!cancelledRef.current) setLoadingPhase(phase as LoadingPhase);
  }, []);

  const runAgent = useCallback(
    async (
      query: string,
      history: ChatMessage[],
      sessionAttachments: AttachmentFile[],
      abortController: AbortController,
    ): Promise<boolean> => {
      setLoadingPhase("thinking");

      try {
        let assistantId: string | null = null;

        // Brand-new conversation: mint the chat's uuid client-side so the URL is
        // correct before the first response (the API route creates the session
        // with it). syncPublicId reconciles from the DB afterwards as a safety net.
        let newPublicId: string | null = null;
        if (sessionIdRef.current === null) {
          newPublicId = crypto.randomUUID();
          setSessionPublicId(newPublicId);
        }

        const response = await sendChatMessage(
          {
            query,
            history,
            attachments: sessionAttachments,
            include_sources: true,
            model_preference: modelPreference,
            session_id: sessionIdRef.current,
            public_id: newPublicId,
          },
          abortController.signal,
          handlePhase,
          (delta) => {
            if (cancelledRef.current || !delta) return;
            if (assistantId === null) {
              const id = `assistant-${Date.now()}`;
              assistantId = id;
              setLoadingPhase("complete");
              setMessages((prev) => [
                ...prev,
                {
                  id,
                  role: "assistant",
                  content: delta,
                  timestamp: new Date(),
                  isStreaming: true,
                },
              ]);
            } else {
              const id = assistantId;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === id ? { ...m, content: m.content + delta } : m,
                ),
              );
            }
          },
          (newSessionId) => {
            if (sessionIdRef.current !== newSessionId) {
              setSessionId(newSessionId);
              void syncPublicId(newSessionId);
            }
          },
          (reasoning) => {
            if (cancelledRef.current || !reasoning) return;
            // Reasoning can arrive before the first answer delta — create the
            // streaming assistant message so the "Thinking" section renders
            // live, then extend it (mirrors the content-delta handler).
            if (assistantId === null) {
              const id = `assistant-${Date.now()}`;
              assistantId = id;
              setLoadingPhase("complete");
              setMessages((prev) => [
                ...prev,
                {
                  id,
                  role: "assistant",
                  content: "",
                  reasoning,
                  timestamp: new Date(),
                  isStreaming: true,
                },
              ]);
            } else {
              const id = assistantId;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === id
                    ? { ...m, reasoning: (m.reasoning ?? "") + reasoning }
                    : m,
                ),
              );
            }
          },
        );

        if (cancelledRef.current) return false;

        if (assistantId !== null) {
          const id = assistantId;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === id
                ? {
                    ...m,
                    content: response.answer,
                    sources: response.sources,
                    isStreaming: false,
                    timestamp: new Date(response.timestamp),
                  }
                : m,
            ),
          );
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: `assistant-${Date.now()}`,
              role: "assistant",
              content: response.answer,
              sources: response.sources,
              timestamp: new Date(response.timestamp),
              isStreaming: false,
            },
          ]);
          setLoadingPhase("complete");
        }
        // The backend auto-titles the session after the first turn; refresh the
        // title (and public_id) so the header updates from "Untitled".
        if (sessionIdRef.current !== null)
          void syncPublicId(sessionIdRef.current);
        return true;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          setLoadingPhase("idle");
          return false;
        }
        setLoadingPhase("error");
        setError(err instanceof Error ? err.message : "Failed to send message");
        setTimeout(() => setLoadingPhase("idle"), 3000);
        return false;
      } finally {
        abortControllerRef.current = null;
      }
    },
    [
      modelPreference,
      handlePhase,
      setSessionId,
      setSessionPublicId,
      syncPublicId,
    ],
  );

  const sendMessage = useCallback(
    async (query: string) => {
      if (!query.trim()) return;

      setError(null);
      cancelledRef.current = false;
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const messageAttachments: MessageAttachment[] = attachments.map((a) => ({
        filename: a.filename,
        content: a.content,
      }));

      const userMessage: DisplayMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: query,
        attachments:
          messageAttachments.length > 0 ? messageAttachments : undefined,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);

      const history: ChatMessage[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const allAttachments = collectSessionAttachments(messages, attachments);

      const ok = await runAgent(
        query,
        history,
        allAttachments,
        abortController,
      );
      if (ok) setAttachments([]);
    },
    [messages, attachments, runAgent, collectSessionAttachments],
  );

  // Re-run the latest user turn. Used when a send failed (the user message is
  // kept, no assistant reply) or a reloaded thread ends on an unanswered user
  // message. The API route trims rows beyond history.length before persisting,
  // so the previous unanswered user row is replaced, not duplicated.
  const retryLastMessage = useCallback(async () => {
    let idx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        idx = i;
        break;
      }
    }
    if (idx === -1) return;
    const userMsg = messages[idx];
    const base = messages.slice(0, idx + 1);
    setMessages(base);
    setError(null);
    cancelledRef.current = false;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const history: ChatMessage[] = messages
      .slice(0, idx)
      .map((m) => ({ role: m.role, content: m.content }));
    await runAgent(
      userMsg.content,
      history,
      collectSessionAttachments(base, []),
      abortController,
    );
  }, [messages, runAgent, collectSessionAttachments]);

  const addAttachment = useCallback(async (file: File) => {
    // Single gate for every upload path (picker, drag-drop, paste). Type list
    // mirrors the /api/chat/extract allowlist; size cap mirrors its 10 MB limit
    // so oversized files are rejected before the round-trip, not after.
    const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
    const name = file.name.toLowerCase();
    const accepted =
      file.type === "application/pdf" ||
      file.type.startsWith("text/") ||
      name.endsWith(".pdf") ||
      name.endsWith(".txt") ||
      name.endsWith(".doc") ||
      name.endsWith(".docx");
    if (!accepted) {
      setError(`"${file.name}" isn't a supported type (PDF, DOC, DOCX, TXT).`);
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError(`"${file.name}" is larger than the 10 MB limit.`);
      return;
    }

    const filename = file.name;
    setLoadingAttachments((prev) => [...prev, filename]);

    try {
      const attachmentData = await extractFileText(file);
      setAttachments((prev) => [...prev, attachmentData]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read file");
    } finally {
      setLoadingAttachments((prev) => prev.filter((f) => f !== filename));
    }
  }, []);

  const removeAttachment = useCallback((filename: string) => {
    setAttachments((prev) => prev.filter((a) => a.filename !== filename));
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const cancelRequest = useCallback(() => {
    cancelledRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoadingPhase("idle");
    setMessages((prev) => {
      const hasStreaming = prev.some((m) => m.isStreaming);
      if (hasStreaming) {
        return prev.map((m) =>
          m.isStreaming ? { ...m, isStreaming: false, isCancelled: true } : m,
        );
      }
      return [
        ...prev,
        {
          id: `assistant-cancelled-${Date.now()}`,
          role: "assistant" as const,
          content: "",
          timestamp: new Date(),
          isStreaming: false,
          isCancelled: true,
        },
      ];
    });
  }, []);

  // editAndResend / regenerateResponse fork a new branch. The client shows the
  // new turn (truncating its view to the branch point); the route preserves the
  // superseded turn(s) as an off-path branch by parenting the new turn to
  // active_path[history.length-1]. loadSession walks only the active branch on
  // reload, so the old branch stays in the DB but off-screen (a future branch
  // picker can surface it). No client-side DB ids are needed — the route maps
  // history position to the branch point.
  const editAndResend = useCallback(
    async (messageId: string, newContent: string) => {
      const messageIndex = messages.findIndex((m) => m.id === messageId);
      if (messageIndex === -1) return;

      const messagesUpToEdited = messages.slice(0, messageIndex + 1);
      const allSessionAttachments =
        collectSessionAttachments(messagesUpToEdited);
      const historyMessages = messages.slice(0, messageIndex);
      const history: ChatMessage[] = historyMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      setMessages((prev) => {
        const updated = [...prev];
        updated[messageIndex] = {
          ...updated[messageIndex],
          content: newContent,
        };
        return updated.slice(0, messageIndex + 1);
      });

      setError(null);
      cancelledRef.current = false;
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setTimeout(() => {
        runAgent(newContent, history, allSessionAttachments, abortController);
      }, 0);
    },
    [messages, runAgent, collectSessionAttachments],
  );

  const regenerateResponse = useCallback(async () => {
    let lastAssistantIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") {
        lastAssistantIdx = i;
        break;
      }
    }
    if (lastAssistantIdx === -1) return;

    let userIdx = -1;
    for (let i = lastAssistantIdx - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        userIdx = i;
        break;
      }
    }
    if (userIdx === -1) return;

    const query = messages[userIdx].content;
    const historyMessages = messages.slice(0, userIdx);
    const history: ChatMessage[] = historyMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    const lastAssistantId = messages[lastAssistantIdx].id;
    const allSessionAttachments = collectSessionAttachments(
      messages.slice(0, userIdx + 1),
    );

    setMessages((prev) => prev.filter((m) => m.id !== lastAssistantId));

    setError(null);
    cancelledRef.current = false;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    await runAgent(query, history, allSessionAttachments, abortController);
  }, [messages, runAgent, collectSessionAttachments]);

  const newSession = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setMessages([]);
    setAttachments([]);
    setLoadingAttachments([]);
    setLoadingPhase("idle");
    setError(null);
    setLoadFailed(false);
    setSessionId(null);
    setSessionPublicId(null);
    setSessionTitle(null);
  }, [setSessionId, setSessionPublicId]);

  const clearChat = useCallback(() => {
    // Alias retained for legacy callers (page unmount cleanup). Same behavior as newSession.
    newSession();
  }, [newSession]);

  const loadSession = useCallback(
    async (publicId: string) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setError(null);
      setLoadFailed(false);
      setLoadingPhase("idle");
      setIsHydrating(true);

      const supabase = createClient();
      // Resolve the opaque public_id to the bigint id (RLS scopes to the owner).
      const { data: session, error: sessErr } = await supabase
        .from("client_chat_sessions")
        .select("id, public_id, title")
        .eq("public_id", publicId)
        .maybeSingle();

      if (sessErr || !session) {
        setLoadFailed(true);
        setIsHydrating(false);
        return false;
      }

      setSessionTitle((session.title as string | null) ?? null);

      const { data, error: fetchErr } = await supabase
        .from("client_chat_messages")
        .select(
          "id, parent_id, role, content, sources, attachments, is_cancelled, created_at",
        )
        .eq("session_id", session.id)
        .order("created_at", { ascending: true });

      if (fetchErr) {
        setError(`Failed to load session: ${fetchErr.message}`);
        setLoadFailed(true);
        setIsHydrating(false);
        return false;
      }

      // Messages form a parent/child tree (edit/regenerate create sibling
      // branches). Display only the ACTIVE branch: the path from the newest leaf
      // up to its root. Older branches stay in the DB but off-screen. A linear
      // conversation collapses to the whole thread.
      type MessageRow = {
        id: number;
        parent_id: number | null;
        role: string;
        content: string;
        sources: unknown;
        attachments: unknown;
        is_cancelled: boolean;
        created_at: string;
      };
      const rows = (data ?? []) as MessageRow[];
      const byId = new Map<number, MessageRow>();
      let leaf: MessageRow | null = null;
      for (const r of rows) {
        byId.set(r.id, r);
        if (!leaf || r.id > leaf.id) leaf = r; // newest insert = active-branch tip
      }
      const path: MessageRow[] = [];
      const seen = new Set<number>();
      for (let cur: MessageRow | null = leaf; cur && !seen.has(cur.id); ) {
        seen.add(cur.id);
        path.push(cur);
        cur = cur.parent_id != null ? (byId.get(cur.parent_id) ?? null) : null;
      }
      path.reverse();

      // Safety net: if the active branch came out degenerate — e.g. rows written
      // before parent_id existed (an older deploy) are unparented, so the
      // newest-leaf walk only reaches itself — fall back to chronological order so
      // the whole thread still renders. `rows` is already created_at-ascending.
      const activePath = path.length <= 1 && rows.length > 1 ? rows : path;

      const hydrated: DisplayMessage[] = activePath
        .filter((row) => row.role === "user" || row.role === "assistant")
        .map((row) => ({
          id: `db-${row.id}`,
          role: row.role as "user" | "assistant",
          content: row.content,
          sources: (row.sources as SourceDocument[] | null) ?? undefined,
          attachments:
            (row.attachments as MessageAttachment[] | null) ?? undefined,
          timestamp: new Date(row.created_at),
          isCancelled: row.is_cancelled || undefined,
        }));

      setMessages(hydrated);
      setAttachments([]);
      setLoadingAttachments([]);
      setLoadFailed(false);
      setSessionId(session.id);
      setSessionPublicId(session.public_id as string);
      setIsHydrating(false);
      return true;
    },
    [setSessionId, setSessionPublicId],
  );

  // Fetch the conversation list and populate the shared cache. Only hit the
  // network here — on first load, or when an actual change warrants a refresh —
  // not on every sidebar expand (callers read the cached `sessionList`).
  const refreshSessions = useCallback(async (): Promise<SessionSummary[]> => {
    const supabase = createClient();
    const { data, error: fetchErr } = await supabase
      .from("client_chat_sessions")
      .select("id, public_id, title, updated_at, project_id, pinned")
      .order("updated_at", { ascending: false, nullsFirst: false });

    if (fetchErr) {
      setError(`Failed to list sessions: ${fetchErr.message}`);
      return [];
    }
    const list = (data ?? []) as SessionSummary[];
    setSessionList(list);
    sessionsLoadedRef.current = true;
    setSessionsLoaded(true);
    return list;
  }, []);

  // Backwards-compatible alias; both names fetch + refresh the cache.
  const listSessions = refreshSessions;

  const renameSession = useCallback(
    async (id: number, title: string): Promise<void> => {
      const trimmed = title.trim();
      if (!trimmed) return;
      // Optimistically update the cache so the UI reflects the change instantly.
      setSessionList((prev) =>
        prev.map((s) => (s.id === id ? { ...s, title: trimmed } : s)),
      );
      const supabase = createClient();
      const { error: updateErr } = await supabase
        .from("client_chat_sessions")
        .update({ title: trimmed })
        .eq("id", id);
      if (updateErr) {
        setError(`Failed to rename conversation: ${updateErr.message}`);
        // Roll the optimistic edit back to the DB's truth.
        void refreshSessions();
      }
    },
    [refreshSessions],
  );

  const setPinned = useCallback(
    async (id: number, pinned: boolean): Promise<void> => {
      setSessionList((prev) =>
        prev.map((s) => (s.id === id ? { ...s, pinned } : s)),
      );
      const supabase = createClient();
      const { error: updateErr } = await supabase
        .from("client_chat_sessions")
        .update({ pinned })
        .eq("id", id);
      if (updateErr) {
        setError(
          `Failed to ${pinned ? "pin" : "unpin"} conversation: ${updateErr.message}`,
        );
        void refreshSessions();
      }
    },
    [refreshSessions],
  );

  const deleteSession = useCallback(
    async (id: number): Promise<void> => {
      setSessionList((prev) => prev.filter((s) => s.id !== id));
      const supabase = createClient();
      // ON DELETE CASCADE on client_chat_messages.session_id removes the messages.
      const { error: delErr } = await supabase
        .from("client_chat_sessions")
        .delete()
        .eq("id", id);
      if (delErr) {
        setError(`Failed to delete conversation: ${delErr.message}`);
        // Restore the optimistically-removed row from the DB.
        void refreshSessions();
        return;
      }
      // If the deleted conversation was the open one, reset to a fresh session.
      if (sessionIdRef.current === id) newSession();
    },
    [newSession, refreshSessions],
  );

  // Keep the cache fresh when the active session changes (new chat created or
  // auto-titled) — but only once it's been loaded, so users who never open the
  // chat history never trigger a fetch. sessionId/sessionTitle are intentional
  // triggers, not values read in the effect body.
  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh on session change
  useEffect(() => {
    if (sessionsLoadedRef.current) void refreshSessions();
  }, [sessionId, sessionTitle, refreshSessions]);

  return (
    <ChatContext.Provider
      value={{
        messages,
        sessionId,
        sessionPublicId,
        sessionTitle,
        loadingPhase,
        isLoading,
        error,
        clearError,
        loadFailed,
        isHydrating,
        attachments,
        loadingAttachments,
        modelPreference,
        setModelPreference,
        sendMessage,
        retryLastMessage,
        addAttachment,
        removeAttachment,
        clearChat,
        cancelRequest,
        editAndResend,
        regenerateResponse,
        newSession,
        loadSession,
        listSessions,
        renameSession,
        setPinned,
        deleteSession,
        sessionList,
        sessionsLoaded,
        refreshSessions,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
