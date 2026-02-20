'use client';

import { useState, useRef, useEffect, type KeyboardEvent, type ChangeEvent } from 'react';

interface MessageThreadProps {
  conversationId?: string | null;
  name?: string;
  lastMessage?: string;
}

// message thread ui for when the user clicks on a specific conversation
// messages currently don't save, solely for ui purposes for now, backend needs to be implmemented
export function MessageThread({ conversationId, name, lastMessage }: MessageThreadProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [messages, setMessages] = useState<{ id: number; text: string }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = () => {
    if (!input.trim()) return;
    const query = input.trim();
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    // console.log('Send:', query);
    setMessages((prev) => [...prev, { id: Date.now(), text: query }]);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable message list */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0 flex flex-col">
      {messages.length === 0 && !lastMessage ? (
        <div className="flex-1 flex items-center justify-center min-h-full">
          <p className="text-medium text-gray-500">Write a Message to {name ?? "..."}</p>
        </div>
      ) : (
        <div className="flex flex-col justify-end min-h-full">
          {lastMessage && (
            <div className="py-2 flex justify-start">
              <div className="inline-block rounded-lg border px-3 py-2">
                <p className="text-sm text-white">{lastMessage}</p>
              </div>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className="py-2 flex justify-end">
              <div className="inline-block rounded-lg border border-gray bg-gray px-3 py-2">
                <p className="text-sm text-white">{msg.text}</p>
              </div>
            </div>
          ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      {/* input bar and send button */}
      <div className="shrink-0 border-t p-4 flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          rows={1}
          className="text-white flex-1 min-h-[40px] max-h-[200px] resize-none border px-3 py-2 text-sm rounded focus:outline-none focus:ring-1 focus:ring-gray-400"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!input.trim()}
          className="px-4 py-2 text-sm font-medium bg-gray-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600"
        >
          Send
        </button>
      </div>
    </div>
  );
}