"use client";

import { useEffect, useRef } from "react";
import { useChat } from "@/lib/chat/chat-context";
import { ChatLoading } from "./ChatLoading";
import { ChatMessage } from "./ChatMessage";

export function ChatMessages() {
  const { messages, isLoading } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Track the streaming (last) message so the effect re-fires as its content
  // grows, not just when a new message is appended — otherwise a long answer
  // scrolls out of view mid-stream.
  const lastMessage = messages[messages.length - 1];
  const lastContentLength = lastMessage?.content.length ?? 0;
  const isStreaming = lastMessage?.isStreaming ?? false;

  // Best-effort: don't fight a user who has scrolled up to read earlier
  // content. Only auto-scroll when they're already near the bottom.
  // lastContentLength / isStreaming are intentional triggers (re-scroll as the
  // streaming answer grows), not values read in the body.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll triggers
  useEffect(() => {
    const anchor = bottomRef.current;
    if (!anchor) return;

    const scroller = anchor.closest<HTMLElement>(".dashboard-scrollbar");
    if (scroller) {
      const distanceFromBottom =
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
      if (distanceFromBottom > 160) return;
    }

    anchor.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isLoading, lastContentLength, isStreaming]);

  if (messages.length === 0 && !isLoading) {
    return null;
  }

  // Find the last assistant message ID for redo button visibility
  let lastAssistantId: string | undefined;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant") {
      lastAssistantId = messages[i].id;
      break;
    }
  }

  return (
    <div className="space-y-6 py-4">
      {messages.map((message) => (
        <ChatMessage
          key={message.id}
          message={message}
          isLatestAssistant={message.id === lastAssistantId}
        />
      ))}

      {isLoading && <ChatLoading />}
      <div ref={bottomRef} />
    </div>
  );
}
