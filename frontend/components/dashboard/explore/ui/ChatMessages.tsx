'use client';

import { useRef, useEffect } from 'react';
import { useChat } from '@/lib/chat/chat-context';
import { ChatMessage } from './ChatMessage';
import { ChatLoading } from './ChatLoading';

export function ChatMessages() {
  const { messages, isLoading } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (messages.length === 0 && !isLoading) {
    return null;
  }

  // Find the last assistant message ID for redo button visibility
  let lastAssistantId: string | undefined;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') {
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
