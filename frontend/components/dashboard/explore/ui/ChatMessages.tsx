"use client";

import { ArrowDown, RotateCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useChat } from "@/lib/chat/chat-context";
import { ChatLoading } from "./ChatLoading";
import { ChatMessage } from "./ChatMessage";

export function ChatMessages() {
  const { messages, isLoading, retryLastMessage } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);
  // Shows the scroll-to-bottom affordance once the user has scrolled meaningfully
  // away from the latest message (e.g. reading back through a long answer).
  const [showScrollButton, setShowScrollButton] = useState(false);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

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

  // Toggle the scroll-to-bottom button as the user scrolls. Re-evaluates when the
  // thread grows so the button hides itself the moment they're back at the bottom.
  // messages.length / lastContentLength are re-run triggers, not body reads.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll triggers
  useEffect(() => {
    const anchor = bottomRef.current;
    const scroller = anchor?.closest<HTMLElement>(".dashboard-scrollbar");
    if (!scroller) return;

    const update = () => {
      const distanceFromBottom =
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
      setShowScrollButton(distanceFromBottom > 240);
    };
    update();
    scroller.addEventListener("scroll", update, { passive: true });
    return () => scroller.removeEventListener("scroll", update);
  }, [messages.length, lastContentLength]);

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
    <div className="space-y-4 py-2">
      {messages.map((message) => (
        <ChatMessage
          key={message.id}
          message={message}
          isLatestAssistant={message.id === lastAssistantId}
        />
      ))}

      {!isLoading && lastMessage?.role === "user" && (
        <div className="flex items-center gap-2 pl-11 text-sm text-sbi-muted">
          <span>Couldn't get a response.</span>
          <button
            type="button"
            onClick={retryLastMessage}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-white/80 transition-colors hover:bg-sbi-dark-card hover:text-white"
          >
            <RotateCw className="h-3.5 w-3.5" strokeWidth={1.5} />
            Retry
          </button>
        </div>
      )}

      {/* Only show the global loader BEFORE the assistant message appears.
          Once it's streaming, its own "Thinking" block + cursor convey
          progress — the loader below it would be a redundant second avatar
          (the post-reasoning searching/generating phases re-raise isLoading
          while the message already exists). */}
      {isLoading && !(isStreaming && lastMessage?.role === "assistant") && (
        <ChatLoading />
      )}
      <div ref={bottomRef} />

      {showScrollButton && (
        <div className="sticky bottom-2 flex justify-center pointer-events-none">
          <button
            type="button"
            onClick={scrollToBottom}
            aria-label="Scroll to latest message"
            title="Scroll to bottom"
            className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border border-sbi-dark-border/60 bg-sbi-dark/80 text-white/80 backdrop-blur-sm shadow-lg transition-colors hover:text-white hover:bg-sbi-dark-card"
          >
            <ArrowDown className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      )}
    </div>
  );
}
