'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { PortalHero } from './ui/PortalHero';
import { PortalInput } from './ui/PortalInput';
import { SuggestionChips } from './ui/SuggestionChips';

export default function DashboardPortal() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const ctx = gsap.context(() => {
      const heroElements = containerRef.current?.querySelectorAll('.hero-content');
      const inputElement = containerRef.current?.querySelector('.input-container');

      if (!heroElements || !inputElement) return;

      // Set initial states
      gsap.set(heroElements, { opacity: 0, y: 30 });
      gsap.set(inputElement, { opacity: 0, y: 20 });

      // Animate in sequence
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      
      tl.to(heroElements, {
        opacity: 1,
        y: 0,
        duration: 1,
        stagger: 0.2,
      })
      .to(inputElement, {
        opacity: 1,
        y: 0,
        duration: 0.8,
      }, '-=0.3');

    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center justify-center min-h-full w-full py-12"
    >
      <div className="w-full max-w-3xl mx-auto space-y-12 px-4">
        <PortalHero />
        <PortalInput />
        <SuggestionChips />
      </div>
    </div>
  );
}
