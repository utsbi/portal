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
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const LOADING_PHASES: LoadingPhase[] = ["thinking", "planning", "searching", "generating"];
const PHASE_DURATION = 800;

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

  // Animate through loading phases
  const animateLoadingPhases = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      let phaseIndex = 0;
      
      const advancePhase = () => {
        if (cancelledRef.current) {
          resolve();
          return;
        }
        if (phaseIndex < LOADING_PHASES.length) {
          setLoadingPhase(LOADING_PHASES[phaseIndex]);
          phaseIndex++;
          setTimeout(advancePhase, PHASE_DURATION);
        } else {
          resolve();
        }
      };
      
      advancePhase();
    });
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

    const loadingPromise = animateLoadingPhases();

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

      const response = await sendChatMessage(
        {
          query,
          history,
          attachments,
          include_sources: true,
          model_preference: modelPreference,
        },
        session.access_token,
        abortController.signal
      );

      if (cancelledRef.current) return;

      await loadingPromise;

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

      await loadingPromise;
      setLoadingPhase("error");
      setError(err instanceof Error ? err.message : "Failed to send message");

      setTimeout(() => setLoadingPhase("idle"), 3000);
    } finally {
      abortControllerRef.current = null;
    }
  }, [messages, attachments, modelPreference, animateLoadingPhases, streamText]);

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
    // Remove any partial assistant messages
    setMessages(prev => prev.filter(m => !m.isStreaming));
  }, []);

  const editAndResend = useCallback(async (messageId: string, newContent: string) => {
    // Find the message index
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

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

      const loadingPromise = animateLoadingPhases();

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
            attachments,
            include_sources: true,
            model_preference: modelPreference,
          },
          session.access_token,
          abortController.signal
        );

        if (cancelledRef.current) return;

        await loadingPromise;

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

        await loadingPromise;
        setLoadingPhase("error");
        setError(err instanceof Error ? err.message : "Failed to send message");

        setTimeout(() => setLoadingPhase("idle"), 3000);
      } finally {
        abortControllerRef.current = null;
      }
    }, 0);
  }, [messages, attachments, modelPreference, animateLoadingPhases, streamText]);

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
