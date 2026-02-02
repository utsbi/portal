'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { User } from 'lucide-react';
import type { DisplayMessage } from '@/lib/chat/chat-context';

interface ChatMessageProps {
  message: DisplayMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isUser = message.role === 'user';

  useEffect(() => {
    if (!containerRef.current) return;

    const ctx = gsap.context(() => {
      gsap.from(containerRef.current, {
        opacity: 0,
        y: 20,
        duration: 0.5,
        ease: 'power2.out',
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  const displayContent = message.displayedContent ?? message.content;

  return (
    <div
      ref={containerRef}
      className={`flex items-start gap-4 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {/* Avatar */}
      <div className="relative shrink-0 mt-1">
        {isUser ? (
          <div className="w-8 h-8 rounded-full bg-sbi-dark-card border border-sbi-dark-border flex items-center justify-center">
            <User className="w-4 h-4 text-sbi-muted" strokeWidth={1.5} />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-sbi-dark-card border border-sbi-dark-border flex items-center justify-center">
            <div className="w-2.5 h-2.5 bg-sbi-green rounded-full animate-pulse" />
            <div className="absolute inset-0 w-8 h-8 bg-sbi-green/20 rounded-full blur-md -z-10" />
          </div>
        )}
      </div>

      {/* Message content */}
      <div
        className={`flex-1 max-w-[80%] ${isUser ? 'text-right' : 'text-left'}`}
      >
        <div
          className={`inline-block px-4 py-3 rounded-lg ${
            isUser
              ? 'bg-sbi-green/10 border border-sbi-green/20 text-white'
              : 'bg-sbi-dark-card border border-sbi-dark-border text-white'
          }`}
        >
          <p className="text-sm font-light leading-relaxed whitespace-pre-wrap">
            {displayContent}
            {message.isStreaming && (
              <span className="inline-block w-0.5 h-4 bg-sbi-green ml-0.5 animate-pulse" />
            )}
          </p>
        </div>

        {/* Sources */}
        {!isUser && message.sources && message.sources.length > 0 && !message.isStreaming && (
          <div className="mt-2 space-y-1">
            <p className="text-xs text-sbi-muted-dark tracking-wide uppercase">Sources</p>
            <div className="flex flex-wrap gap-2">
              {message.sources.map((source, index) => (
                <div
                  key={index}
                  className="text-xs text-sbi-muted bg-sbi-dark-card/50 border border-sbi-dark-border/50 px-2 py-1 rounded"
                >
                  {source.filename}
                  {source.page_number && ` (p. ${source.page_number})`}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timestamp */}
        <p className="text-[10px] text-sbi-muted-dark mt-1.5 font-light">
          {message.timestamp.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}
