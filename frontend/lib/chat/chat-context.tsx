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
  attachments: AttachmentFile[];
  loadingAttachments: string[];
  modelPreference: ModelPreference;
  setModelPreference: (model: ModelPreference) => void;
  sendMessage: (query: string) => Promise<void>;
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

  const addAttachment = useCallback(async (file: File) => {
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

  // NOTE: editAndResend and regenerateResponse currently only mutate client-side
  // state. The DB rows for the original turn(s) remain. On the next session
  // reload, those stale rows will reappear. Tracked as a Phase 1 follow-up.
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
      setLoadingPhase("idle");

      const supabase = createClient();
      // Resolve the opaque public_id to the bigint id (RLS scopes to the owner).
      const { data: session, error: sessErr } = await supabase
        .from("client_chat_sessions")
        .select("id, public_id, title")
        .eq("public_id", publicId)
        .maybeSingle();

      if (sessErr || !session) {
        return false;
      }

      setSessionTitle((session.title as string | null) ?? null);

      const { data, error: fetchErr } = await supabase
        .from("client_chat_messages")
        .select(
          "id, role, content, sources, attachments, is_cancelled, created_at",
        )
        .eq("session_id", session.id)
        .order("created_at", { ascending: true });

      if (fetchErr) {
        setError(`Failed to load session: ${fetchErr.message}`);
        return false;
      }

      const hydrated: DisplayMessage[] = (data ?? [])
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
      setSessionId(session.id);
      setSessionPublicId(session.public_id as string);
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
      if (updateErr)
        setError(`Failed to rename conversation: ${updateErr.message}`);
    },
    [],
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
      if (updateErr)
        setError(
          `Failed to ${pinned ? "pin" : "unpin"} conversation: ${updateErr.message}`,
        );
    },
    [],
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
        return;
      }
      // If the deleted conversation was the open one, reset to a fresh session.
      if (sessionIdRef.current === id) newSession();
    },
    [newSession],
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
        attachments,
        loadingAttachments,
        modelPreference,
        setModelPreference,
        sendMessage,
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
