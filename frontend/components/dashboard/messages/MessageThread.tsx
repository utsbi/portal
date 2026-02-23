'use client';

import { useState, useRef, useEffect, type KeyboardEvent, type ChangeEvent } from 'react';
import { Send, Plus } from 'lucide-react';

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

  const hasInput = input.trim().length > 0;

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
              <div className="inline-block rounded-lg border px-3 py-2 bg-sbi-green">
                <p className="text-sm text-white">{lastMessage}</p>
              </div>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className="py-2 flex justify-end">
              <div className="inline-block rounded-lg border border-sbi-green/20 px-3 py-2 bg-sbi-dark-card/80">
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
        <button
          type="button"
          className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center border border-sbi-dark-border text-sbi-muted hover:text-sbi-green hover:bg-sbi-dark hover:border-sbi-green/30 transition-colors duration-300 cursor-pointer"
          aria-label="Add file (placeholder)"
          title="Add file (coming soon)"
        >
          <Plus className="w-5 h-5" strokeWidth={1.5} />
        </button>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          rows={1}
          className="text-white flex-1 min-h-[40px] max-h-[200px] resize-none border px-3 py-2 text-sm rounded focus:outline-none focus:ring-1 focus:ring-gray-400"
        />
        {hasInput && (
          <button
            type="button"
            onClick={handleSubmit}
            className="h-9 w-9 shrink-0 rounded-full transition-transform duration-200 ease-out flex items-center justify-center bg-sbi-green text-sbi-dark hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Send className="w-4 h-4" strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  );
}