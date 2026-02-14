'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';
import { PortalHero } from './ui/PortalHero';
import { PortalInput } from './ui/PortalInput';
import { SuggestionChips } from './ui/SuggestionChips';
import { AmbientGrid } from './ui/AmbientGrid';
import { TimeDisplay } from './ui/TimeDisplay';
import { FloatingNodes } from './ui/FloatingNodes';
import { ChatMessages } from './ui/ChatMessages';
import { useChat } from '@/lib/chat/chat-context';

interface ExploreProps {
  urlSlug?: string;
}

/**
 * Welcome state rendered on the dashboard (/{slug}/dashboard).
 * Shows hero, input, and suggestion chips.
 * When the user sends a message, routes to /dashboard/explore.
 */
export function ExploreWelcome({ urlSlug }: ExploreProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const router = useRouter();
  const { messages } = useChat();

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // When user submits message, route to the explore page
  useEffect(() => {
    if (messages.length > 0) {
      router.push(`/${urlSlug}/dashboard/explore`);
    }
  }, [messages.length, router, urlSlug]);

  // GSAP entrance animations
  useEffect(() => {
    if (!containerRef.current || !isReady) return;

    const ctx = gsap.context(() => {
      const heroElements = containerRef.current?.querySelectorAll('.hero-content');
      const inputElement = containerRef.current?.querySelector('.input-container');
      const ambientElements = containerRef.current?.querySelectorAll('.ambient-element');
      const chips = containerRef.current?.querySelectorAll('.suggestion-chip');
      const timeDisplay = containerRef.current?.querySelector('.time-display');

      if (!heroElements || !inputElement || !ambientElements || !chips || !timeDisplay) return;

      // Set initial states
      gsap.set(heroElements, { opacity: 0, y: 40 });
      gsap.set(inputElement, { opacity: 0, y: 30 });
      gsap.set(ambientElements, { opacity: 0 });
      gsap.set(chips, { opacity: 0, y: 15, scale: 0.95 });
      gsap.set(timeDisplay, { opacity: 0, x: 20 });

      // Master timeline with refined easing
      const tl = gsap.timeline({
        defaults: { ease: 'power3.out' }
      });

      tl.to(heroElements, {
        opacity: 1,
        y: 0,
        duration: 0.8,
        stagger: 0.1,
      }, 0)
      .to(inputElement, {
        opacity: 1,
        y: 0,
        duration: 0.8,
      }, 0.1)
      .to(ambientElements, {
        opacity: 1,
        duration: 2,
        stagger: 0.2,
      }, 0)
      .to(timeDisplay, {
        opacity: 1,
        x: 0,
        duration: 0.8,
      }, 0.4)
      .to(chips, {
        opacity: 1,
        y: 0,
        scale: 1,
        visibility: 'visible',
        duration: 0.6,
        stagger: 0.05,
      }, 0.5);

    }, containerRef);

    return () => ctx.revert();
  }, [isReady]);

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] w-full overflow-hidden"
    >
      {/* Floating nodes background */}
      <FloatingNodes />

      {/* Ambient Background Elements */}
      <AmbientGrid />

      {/* Corner accents */}
      <div className="ambient-element absolute top-8 left-8 w-24 h-24 border-l border-t border-sbi-dark-border/40 opacity-0" />
      <div className="ambient-element absolute bottom-8 right-8 w-24 h-24 border-r border-b border-sbi-dark-border/40 opacity-0" />

      {/* Subtle gradient orbs */}
      <div className="ambient-element absolute top-1/4 -left-32 w-64 h-64 bg-sbi-green/2 rounded-full blur-3xl opacity-0" />
      <div className="ambient-element absolute bottom-1/4 -right-32 w-64 h-64 bg-sbi-green/2 rounded-full blur-3xl opacity-0" />

      {/* Time Display */}
      <div className="fixed top-24 right-12 z-20">
        <TimeDisplay />
      </div>

      {/* Welcome mode */}
      <div className="relative z-10 w-full max-w-3xl mx-auto px-4 space-y-8">
        <PortalHero />
        <div>
          <PortalInput queueOnly />
        </div>
        <SuggestionChips disableAutoAnimation />
      </div>

      {/* Bottom line */}
      <div className="ambient-element absolute bottom-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-sbi-dark-border/30 to-transparent opacity-0" />
    </div>
  );
}

/**
 * Chat state rendered on the explore route (/{slug}/dashboard/explore)
 * Shows the active chat session with messages and input.
 */
export function ExploreChat({ urlSlug }: ExploreProps) {
  const router = useRouter();
  const { messages, clearChat, cancelRequest, processPendingMessage } = useChat();
  const mountedRef = useRef(false);

  // If no messages (direct navigation or page reload), redirect to dashboard
  useEffect(() => {
    if (messages.length === 0) {
      router.replace(`/${urlSlug}/dashboard`);
    }
  }, []);

  // Process the queued message from the welcome page
  useEffect(() => {
    processPendingMessage();
  }, []);

  // Cleanup on page unload/refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      cancelRequest();
      clearChat();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [clearChat, cancelRequest]);

  // Cleanup when navigating away from explore
  useEffect(() => {
    const timer = setTimeout(() => {
      mountedRef.current = true;
    }, 50);

    return () => {
      clearTimeout(timer);
      if (mountedRef.current) {
        cancelRequest();
        clearChat();
      }
    };
  }, [cancelRequest, clearChat]);

  return (
    <div className="relative flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] w-full overflow-hidden">
      {/* Floating nodes background */}
      <FloatingNodes />

      {/* Ambient Background Elements */}
      <AmbientGrid />

      {/* Corner accents */}
      <div className="absolute top-8 left-8 w-24 h-24 border-l border-t border-sbi-dark-border/40" />
      <div className="absolute bottom-8 right-8 w-24 h-24 border-r border-b border-sbi-dark-border/40" />

      {/* Subtle gradient orbs */}
      <div className="absolute top-1/4 -left-32 w-64 h-64 bg-sbi-green/2 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -right-32 w-64 h-64 bg-sbi-green/2 rounded-full blur-3xl" />

      {/* Time Display */}
      <div className="fixed top-24 right-12 z-20">
        <TimeDisplay />
      </div>

      {/* Chat scrollable messages */}
      <div className="absolute inset-0 z-10 overflow-y-auto dashboard-scrollbar">
        <div className="w-full max-w-3xl mx-auto px-4 min-h-full flex flex-col">
          {/* Chat messages */}
          <div className="flex-1 pt-6">
            <ChatMessages />
          </div>

          {/* Input section */}
          <div className="sticky bottom-0 bg-sbi-dark pb-4 pt-2">
            <PortalInput animated={false} />
            <p className="text-center text-xs text-sbi-muted-dark mt-3 font-light">
              AI can make mistakes, so double check responses
            </p>
          </div>
        </div>
      </div>

      {/* Bottom line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-sbi-dark-border/30 to-transparent" />
    </div>
  );
}
