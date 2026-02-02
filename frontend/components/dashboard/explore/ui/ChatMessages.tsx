'use client';

import { useRef, useEffect } from 'react';
import { useChat } from '@/lib/chat/chat-context';
import { ChatMessage } from './ChatMessage';
import { ChatLoading } from './ChatLoading';

export function ChatMessages() {
  const { messages, isLoading } = useChat();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  if (messages.length === 0 && !isLoading) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto space-y-6 py-6 px-4 max-h-[60vh] scrollbar-thin scrollbar-thumb-sbi-dark-border scrollbar-track-transparent"
    >
      {messages.map((message) => (
        <ChatMessage key={message.id} message={message} />
      ))}
      
      {isLoading && <ChatLoading />}
    </div>
  );
}
