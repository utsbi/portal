'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useChat, type LoadingPhase } from '@/lib/chat/chat-context';

const PHASE_LABELS: Record<LoadingPhase, string> = {
  idle: '',
  thinking: 'Thinking',
  planning: 'Planning',
  searching: 'Searching',
  generating: 'Generating answer',
  complete: '',
  error: 'Something went wrong',
};

export function ChatLoading() {
  const { loadingPhase, isLoading, error } = useChat();
  const containerRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dotsRef.current || !isLoading) return;

    const dots = dotsRef.current.querySelectorAll('.loading-dot');
    
    const ctx = gsap.context(() => {
      gsap.to(dots, {
        y: -8,
        duration: 0.4,
        stagger: {
          each: 0.15,
          repeat: -1,
          yoyo: true,
        },
        ease: 'power2.inOut',
      });
    }, dotsRef);

    return () => ctx.revert();
  }, [isLoading]);

  useEffect(() => {
    if (!containerRef.current) return;

    if (isLoading || loadingPhase === 'error') {
      gsap.to(containerRef.current, {
        opacity: 1,
        y: 0,
        duration: 0.4,
        ease: 'power2.out',
      });
    } else {
      gsap.to(containerRef.current, {
        opacity: 0,
        y: 10,
        duration: 0.3,
        ease: 'power2.in',
      });
    }
  }, [isLoading, loadingPhase]);

  if (!isLoading && loadingPhase !== 'error') {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="flex items-start gap-4 opacity-0 translate-y-2"
    >
      {/* AI Green Avatar glowing dot */}
      <div className="relative shrink-0 mt-1">
        <div className="w-8 h-8 rounded-full bg-sbi-dark-card border border-sbi-dark-border flex items-center justify-center">
          <div className="w-2.5 h-2.5 bg-sbi-green rounded-full animate-pulse" />
        </div>
        <div className="absolute inset-0 w-8 h-8 bg-sbi-green/20 rounded-full blur-md -z-10" />
      </div>

      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-light text-sbi-muted tracking-wide">
            {loadingPhase === 'error' ? error : PHASE_LABELS[loadingPhase]}
          </span>
          
          {/* Animated dots */}
          {isLoading && (
            <div ref={dotsRef} className="flex items-center gap-1">
              <div className="loading-dot w-1.5 h-1.5 bg-sbi-green/60 rounded-full" />
              <div className="loading-dot w-1.5 h-1.5 bg-sbi-green/60 rounded-full" />
              <div className="loading-dot w-1.5 h-1.5 bg-sbi-green/60 rounded-full" />
            </div>
          )}
        </div>

        {/* Progress bar */}
        {isLoading && (
          <div className="h-0.5 bg-sbi-dark-border rounded-full overflow-hidden max-w-xs">
            <div 
              className="h-full bg-sbi-green/50 rounded-full transition-all duration-500"
              style={{
                width: loadingPhase === 'thinking' ? '20%' 
                     : loadingPhase === 'planning' ? '45%'
                     : loadingPhase === 'searching' ? '70%'
                     : loadingPhase === 'generating' ? '90%'
                     : '0%'
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
