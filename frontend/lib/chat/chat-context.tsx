"use client";

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";
import { sendChatMessage, extractFileText, type ChatMessage, type SourceDocument, type AttachmentFile } from "@/lib/api/chat";
import { createClient } from "@/lib/supabase/client";

export type ModelPreference = "fast" | "thinking";

export type LoadingPhase = "idle" | "thinking" | "planning" | "searching" | "generating" | "complete" | "error";

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

interface ChatContextType {
  messages: DisplayMessage[];
  loadingPhase: LoadingPhase;
  isLoading: boolean;
  error: string | null;
  attachments: AttachmentFile[];
  loadingAttachments: string[];
  modelPreference: ModelPreference;
  setModelPreference: (model: ModelPreference) => void;
  sendMessage: (query: string) => Promise<void>;
  queueMessage: (query: string) => void;
  processPendingMessage: () => Promise<void>;
  addAttachment: (file: File) => Promise<void>;
  removeAttachment: (filename: string) => void;
  clearChat: () => void;
  cancelRequest: () => void;
  editAndResend: (messageId: string, newContent: string) => Promise<void>;
  regenerateResponse: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [modelPreference, setModelPreference] = useState<ModelPreference>("fast");
  const [loadingAttachments, setLoadingAttachments] = useState<string[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);
  const pendingQueryRef = useRef<{
    query: string;
    savedAttachments: AttachmentFile[];
    history: ChatMessage[];
  } | null>(null);

  const isLoading = loadingPhase !== "idle" && loadingPhase !== "complete" && loadingPhase !== "error";

  // Collect all attachments from previous user messages in the session
  const collectSessionAttachments = useCallback((msgs: DisplayMessage[], extraAttachments?: AttachmentFile[]): AttachmentFile[] => {
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
              file_type: a.filename.split('.').pop()?.toLowerCase() || 'txt',
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
  }, []);

  const handlePhase = useCallback((phase: string) => {
    if (!cancelledRef.current) {
      setLoadingPhase(phase as LoadingPhase);
    }
  }, []);

  // Core streaming routine shared by sendMessage / processPendingMessage / editAndResend / regenerateResponse.
  // The assistant message bubble is lazily created on the first delta, then appended to in place.
  // Returns true on success, false on error/cancel.
  const runAgent = useCallback(async (
    query: string,
    history: ChatMessage[],
    sessionAttachments: AttachmentFile[],
    abortController: AbortController,
  ): Promise<boolean> => {
    setLoadingPhase("thinking");

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelledRef.current) return false;
      if (!session?.access_token) throw new Error("Not authenticated");

      let assistantId: string | null = null;

      const response = await sendChatMessage(
        {
          query,
          history,
          attachments: sessionAttachments,
          include_sources: true,
          model_preference: modelPreference,
        },
        session.access_token,
        abortController.signal,
        handlePhase,
        (delta) => {
          if (cancelledRef.current || !delta) return;
          if (assistantId === null) {
            const id = `assistant-${Date.now()}`;
            assistantId = id;
            setLoadingPhase("complete");
            setMessages(prev => [...prev, {
              id,
              role: "assistant",
              content: delta,
              timestamp: new Date(),
              isStreaming: true,
            }]);
          } else {
            const id = assistantId;
            setMessages(prev => prev.map(m =>
              m.id === id ? { ...m, content: m.content + delta } : m
            ));
          }
        },
      );

      if (cancelledRef.current) return false;

      if (assistantId !== null) {
        const id = assistantId;
        setMessages(prev => prev.map(m =>
          m.id === id ? {
            ...m,
            content: response.answer,
            sources: response.sources,
            isStreaming: false,
            timestamp: new Date(response.timestamp),
          } : m
        ));
      } else {
        // Result arrived without any deltas (shouldn't happen in normal flow,
        // but the backend's empty-response path could emit an empty stream).
        setMessages(prev => [...prev, {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: response.answer,
          sources: response.sources,
          timestamp: new Date(response.timestamp),
          isStreaming: false,
        }]);
        setLoadingPhase("complete");
      }
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
  }, [modelPreference, handlePhase]);

  const sendMessage = useCallback(async (query: string) => {
    if (!query.trim()) return;

    setError(null);
    cancelledRef.current = false;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const messageAttachments: MessageAttachment[] = attachments.map(a => ({
      filename: a.filename,
      content: a.content,
    }));

    const userMessage: DisplayMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: query,
      attachments: messageAttachments.length > 0 ? messageAttachments : undefined,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    const history: ChatMessage[] = messages.map(m => ({ role: m.role, content: m.content }));
    const allAttachments = collectSessionAttachments(messages, attachments);

    const ok = await runAgent(query, history, allAttachments, abortController);
    if (ok) setAttachments([]);
  }, [messages, attachments, runAgent, collectSessionAttachments]);

  // Queue a user message without making the API call (welcome -> explore transition).
  const queueMessage = useCallback((query: string) => {
    if (!query.trim()) return;

    const messageAttachments: MessageAttachment[] = attachments.map(a => ({
      filename: a.filename,
      content: a.content,
    }));

    const userMessage: DisplayMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: query,
      attachments: messageAttachments.length > 0 ? messageAttachments : undefined,
      timestamp: new Date(),
    };

    const history: ChatMessage[] = messages.map(m => ({ role: m.role, content: m.content }));
    const allAttachments = collectSessionAttachments(messages, attachments);

    pendingQueryRef.current = { query, savedAttachments: allAttachments, history };

    setMessages(prev => [...prev, userMessage]);
    setAttachments([]);
  }, [attachments, messages, collectSessionAttachments]);

  const processPendingMessage = useCallback(async () => {
    const pending = pendingQueryRef.current;
    if (!pending) return;
    pendingQueryRef.current = null;

    setError(null);
    cancelledRef.current = false;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    await runAgent(pending.query, pending.history, pending.savedAttachments, abortController);
  }, [runAgent]);

  const addAttachment = useCallback(async (file: File) => {
    const filename = file.name;
    setLoadingAttachments(prev => [...prev, filename]);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const attachmentData = await extractFileText(file, session.access_token);
      setAttachments(prev => [...prev, attachmentData]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read file");
    } finally {
      setLoadingAttachments(prev => prev.filter(f => f !== filename));
    }
  }, []);

  const removeAttachment = useCallback((filename: string) => {
    setAttachments(prev => prev.filter(a => a.filename !== filename));
  }, []);

  const cancelRequest = useCallback(() => {
    cancelledRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoadingPhase("idle");
    setMessages(prev => {
      const hasStreaming = prev.some(m => m.isStreaming);
      if (hasStreaming) {
        return prev.map(m => m.isStreaming ? { ...m, isStreaming: false, isCancelled: true } : m);
      }
      // Still in pre-delta phase — add a cancelled placeholder so the user sees something.
      return [...prev, {
        id: `assistant-cancelled-${Date.now()}`,
        role: "assistant" as const,
        content: "",
        timestamp: new Date(),
        isStreaming: false,
        isCancelled: true,
      }];
    });
  }, []);

  const editAndResend = useCallback(async (messageId: string, newContent: string) => {
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    const messagesUpToEdited = messages.slice(0, messageIndex + 1);
    const allSessionAttachments = collectSessionAttachments(messagesUpToEdited);
    const historyMessages = messages.slice(0, messageIndex);
    const history: ChatMessage[] = historyMessages.map(m => ({ role: m.role, content: m.content }));

    setMessages(prev => {
      const updated = [...prev];
      updated[messageIndex] = { ...updated[messageIndex], content: newContent };
      return updated.slice(0, messageIndex + 1);
    });

    setError(null);
    cancelledRef.current = false;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Defer to next tick so the truncating setMessages flushes first.
    setTimeout(() => {
      runAgent(newContent, history, allSessionAttachments, abortController);
    }, 0);
  }, [messages, runAgent, collectSessionAttachments]);

  const regenerateResponse = useCallback(async () => {
    let lastAssistantIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') { lastAssistantIdx = i; break; }
    }
    if (lastAssistantIdx === -1) return;

    let userIdx = -1;
    for (let i = lastAssistantIdx - 1; i >= 0; i--) {
      if (messages[i].role === 'user') { userIdx = i; break; }
    }
    if (userIdx === -1) return;

    const query = messages[userIdx].content;
    const historyMessages = messages.slice(0, userIdx);
    const history: ChatMessage[] = historyMessages.map(m => ({ role: m.role, content: m.content }));
    const lastAssistantId = messages[lastAssistantIdx].id;
    const allSessionAttachments = collectSessionAttachments(messages.slice(0, userIdx + 1));

    setMessages(prev => prev.filter(m => m.id !== lastAssistantId));

    setError(null);
    cancelledRef.current = false;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    await runAgent(query, history, allSessionAttachments, abortController);
  }, [messages, runAgent, collectSessionAttachments]);

  const clearChat = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    pendingQueryRef.current = null;
    setMessages([]);
    setAttachments([]);
    setLoadingAttachments([]);
    setLoadingPhase("idle");
    setError(null);
  }, []);

  return (
    <ChatContext.Provider
      value={{
        messages,
        loadingPhase,
        isLoading,
        error,
        attachments,
        loadingAttachments,
        modelPreference,
        setModelPreference,
        sendMessage,
        queueMessage,
        processPendingMessage,
        addAttachment,
        removeAttachment,
        clearChat,
        cancelRequest,
        editAndResend,
        regenerateResponse,
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
