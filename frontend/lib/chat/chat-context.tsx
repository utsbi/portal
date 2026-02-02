"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { sendChatMessage, uploadDocument, type ChatMessage, type SourceDocument, type AttachmentFile } from "@/lib/api/chat";
import { createClient } from "@/lib/supabase/client";

export type LoadingPhase = "idle" | "thinking" | "planning" | "searching" | "generating" | "complete" | "error";

export interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceDocument[];
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
  sendMessage: (query: string) => Promise<void>;
  addAttachment: (file: File) => Promise<void>;
  removeAttachment: (filename: string) => void;
  clearChat: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const LOADING_PHASES: LoadingPhase[] = ["thinking", "planning", "searching", "generating"];
const PHASE_DURATION = 800;

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);

  const isLoading = loadingPhase !== "idle" && loadingPhase !== "complete" && loadingPhase !== "error";

  // Animate through loading phases
  const animateLoadingPhases = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      let phaseIndex = 0;
      
      const advancePhase = () => {
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
    
    const userMessage: DisplayMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: query,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    const loadingPromise = animateLoadingPhases();

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
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
          model_preference: "flash",
        },
        session.access_token
      );

      await loadingPromise;

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
      await loadingPromise;
      setLoadingPhase("error");
      setError(err instanceof Error ? err.message : "Failed to send message");
      
      setTimeout(() => setLoadingPhase("idle"), 3000);
    }
  }, [messages, attachments, animateLoadingPhases, streamText]);

  const addAttachment = useCallback(async (file: File) => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      await uploadDocument(file, session.access_token);

      setAttachments((prev) => [
        ...prev,
        {
          filename: file.name,
          content: "",
          file_type: file.type.includes("pdf") ? "pdf" : "txt",
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload file");
    }
  }, []);

  const removeAttachment = useCallback((filename: string) => {
    setAttachments((prev) => prev.filter((a) => a.filename !== filename));
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    setAttachments([]);
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
        sendMessage,
        addAttachment,
        removeAttachment,
        clearChat,
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
