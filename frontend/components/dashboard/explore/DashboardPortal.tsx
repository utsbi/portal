'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { PortalHero } from './ui/PortalHero';
import { PortalInput } from './ui/PortalInput';
import { SuggestionChips } from './ui/SuggestionChips';
import { AmbientGrid } from './ui/AmbientGrid';
import { TimeDisplay } from './ui/TimeDisplay';
import { FloatingNodes } from './ui/FloatingNodes';

export default function DashboardPortal() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

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
        defaults: { ease: 'power4.out' }
      });
      
      // Ambient elements fade in first
      tl.to(ambientElements, {
        opacity: 1,
        duration: 1.6,
        stagger: 0.25,
      })

      // Hero content (greeting) first
      .to(heroElements, {
        opacity: 1,
        y: 0,
        duration: 1.1,
        stagger: 0.12,
      })

      // Dashboard clock alongside chips
      .to(timeDisplay, {
        opacity: 1,
        x: 0,
        duration: 0.8,
      }, '<0.2')

      // AI chat text box second
      .to(inputElement, {
        opacity: 1,
        y: 0,
        duration: 1,
      }, '-=0.2')

      // Suggestion chips last (paired with clock)
      .to(chips, {
        opacity: 1,
        y: 0,
        scale: 1,
        visibility: 'visible',
        duration: 0.9,
        stagger: 0.1,
        ease: 'power3.out',
      }, '-=0.3');

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
      <TimeDisplay />

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-3xl mx-auto space-y-8 px-4">
        <PortalHero />
        <PortalInput />
        <SuggestionChips disableAutoAnimation />
      </div>

      {/* Bottom line */}
      <div className="ambient-element absolute bottom-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-sbi-dark-border/30 to-transparent opacity-0" />
    </div>
  );
}
