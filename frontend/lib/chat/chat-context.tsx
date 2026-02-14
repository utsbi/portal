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
  displayedContent?: string;
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

  const isLoading = loadingPhase !== "idle" && loadingPhase !== "complete" && loadingPhase !== "error";

  // Collect all attachments from previous user messages in the session
  const collectSessionAttachments = useCallback((msgs: DisplayMessage[], extraAttachments?: AttachmentFile[]): AttachmentFile[] => {
    const seen = new Set<string>();
    const all: AttachmentFile[] = [];

    // Gather from all previous user messages
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

    // Add any new attachments not yet on a message
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

  // SSE phase callback - updates loading phase from backend events
  const handlePhase = useCallback((phase: string) => {
    if (!cancelledRef.current) {
      setLoadingPhase(phase as LoadingPhase);
    }
  }, []);

  // Stream text animation for response
  const streamText = useCallback((messageId: string, fullText: string): Promise<void> => {
    return new Promise((resolve) => {
      let charIndex = 0;
      const charsPerTick = 3;
      const tickDuration = 20;
      
      const tick = () => {
        if (cancelledRef.current) {
          resolve();
          return;
        }
        if (charIndex < fullText.length) {
          charIndex = Math.min(charIndex + charsPerTick, fullText.length);
          const displayedContent = fullText.slice(0, charIndex);
          
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === messageId
                ? { ...msg, displayedContent, isStreaming: charIndex < fullText.length }
                : msg
            )
          );
          
          setTimeout(tick, tickDuration);
        } else {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === messageId
                ? { ...msg, displayedContent: fullText, isStreaming: false }
                : msg
            )
          );
          resolve();
        }
      };
      
      tick();
    });
  }, []);

  const sendMessage = useCallback(async (query: string) => {
    if (!query.trim()) return;

    setError(null);
    cancelledRef.current = false;

    // Create new AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Capture attachments for this message
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
    setMessages((prev) => [...prev, userMessage]);

    setLoadingPhase("thinking");

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (cancelledRef.current) return;

      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      const history: ChatMessage[] = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // Collect all session attachments (previous messages + new ones)
      const allAttachments = collectSessionAttachments(messages, attachments);

      const response = await sendChatMessage(
        {
          query,
          history,
          attachments: allAttachments,
          include_sources: true,
          model_preference: modelPreference,
        },
        session.access_token,
        abortController.signal,
        handlePhase
      );

      if (cancelledRef.current) return;

      const assistantMessage: DisplayMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.answer,
        sources: response.sources,
        timestamp: new Date(response.timestamp),
        isStreaming: true,
        displayedContent: "",
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setLoadingPhase("complete");

      await streamText(assistantMessage.id, response.answer);

      setAttachments([]);

    } catch (err) {
      // Handle abort
      if (err instanceof Error && err.name === "AbortError") {
        setLoadingPhase("idle");
        return;
      }

      setLoadingPhase("error");
      setError(err instanceof Error ? err.message : "Failed to send message");

      setTimeout(() => setLoadingPhase("idle"), 3000);
    } finally {
      abortControllerRef.current = null;
    }
  }, [messages, attachments, modelPreference, handlePhase, streamText, collectSessionAttachments]);

  const addAttachment = useCallback(async (file: File) => {
    const filename = file.name;
    setLoadingAttachments((prev) => [...prev, filename]);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      // Extract text from file without adding to database
      const attachmentData = await extractFileText(file, session.access_token);

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

  const cancelRequest = useCallback(() => {
    cancelledRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoadingPhase("idle");
    // Replace streaming message with cancelled, or add cancelled if none exists yet
    setMessages(prev => {
      const hasStreaming = prev.some(m => m.isStreaming);
      if (hasStreaming) {
        return prev.map(m => m.isStreaming ? {
          ...m,
          content: m.displayedContent || m.content,
          isStreaming: false,
          isCancelled: true,
        } : m);
      }
      // Still in loading/API phase - add a cancelled placeholder
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
    // Find the message index
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    // Collect all session attachments from messages up to and including the edited message
    const messagesUpToEdited = messages.slice(0, messageIndex + 1);
    const allSessionAttachments = collectSessionAttachments(messagesUpToEdited);

    // Update the message content in place and remove all messages after it
    setMessages(prev => {
      const updated = [...prev];
      updated[messageIndex] = { ...updated[messageIndex], content: newContent };
      // Remove all messages after this one
      return updated.slice(0, messageIndex + 1);
    });

    // Resend with the new content
    // Wait for state update, use small delay
    setTimeout(async () => {
      // Build history from messages up to (not including) the edited message
      const historyMessages = messages.slice(0, messageIndex);

      setError(null);
      cancelledRef.current = false;
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setLoadingPhase("thinking");

      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (cancelledRef.current) return;

        if (!session?.access_token) {
          throw new Error("Not authenticated");
        }

        const history: ChatMessage[] = historyMessages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

        const response = await sendChatMessage(
          {
            query: newContent,
            history,
            attachments: allSessionAttachments,
            include_sources: true,
            model_preference: modelPreference,
          },
          session.access_token,
          abortController.signal,
          handlePhase
        );

        if (cancelledRef.current) return;

        const assistantMessage: DisplayMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: response.answer,
          sources: response.sources,
          timestamp: new Date(response.timestamp),
          isStreaming: true,
          displayedContent: "",
        };

        setMessages((prev) => [...prev, assistantMessage]);
        setLoadingPhase("complete");

        await streamText(assistantMessage.id, response.answer);

      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          setLoadingPhase("idle");
          return;
        }

        setLoadingPhase("error");
        setError(err instanceof Error ? err.message : "Failed to send message");

        setTimeout(() => setLoadingPhase("idle"), 3000);
      } finally {
        abortControllerRef.current = null;
      }
    }, 0);
  }, [messages, modelPreference, handlePhase, streamText, collectSessionAttachments]);

  const regenerateResponse = useCallback(async () => {
    // Find the last assistant message
    let lastAssistantIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        lastAssistantIdx = i;
        break;
      }
    }
    if (lastAssistantIdx === -1) return;

    // Find the user message before it
    let userIdx = -1;
    for (let i = lastAssistantIdx - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userIdx = i;
        break;
      }
    }
    if (userIdx === -1) return;

    const query = messages[userIdx].content;
    const historyMessages = messages.slice(0, userIdx);
    const lastAssistantId = messages[lastAssistantIdx].id;

    // Collect all session attachments from messages up to and including the user message
    const allSessionAttachments = collectSessionAttachments(messages.slice(0, userIdx + 1));

    // Remove the last assistant message
    setMessages(prev => prev.filter(m => m.id !== lastAssistantId));

    setError(null);
    cancelledRef.current = false;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoadingPhase("thinking");

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (cancelledRef.current) return;

      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      const history: ChatMessage[] = historyMessages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const response = await sendChatMessage(
        {
          query,
          history,
          attachments: allSessionAttachments,
          include_sources: true,
          model_preference: modelPreference,
        },
        session.access_token,
        abortController.signal,
        handlePhase
      );

      if (cancelledRef.current) return;

      const assistantMessage: DisplayMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.answer,
        sources: response.sources,
        timestamp: new Date(response.timestamp),
        isStreaming: true,
        displayedContent: "",
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setLoadingPhase("complete");

      await streamText(assistantMessage.id, response.answer);

    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setLoadingPhase("idle");
        return;
      }

      setLoadingPhase("error");
      setError(err instanceof Error ? err.message : "Failed to send message");
      setTimeout(() => setLoadingPhase("idle"), 3000);
    } finally {
      abortControllerRef.current = null;
    }
  }, [messages, modelPreference, handlePhase, streamText, collectSessionAttachments]);

  const clearChat = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
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
