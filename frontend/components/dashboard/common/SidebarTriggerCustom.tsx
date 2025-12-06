'use client';

import { useRef, useEffect } from 'react';
import { useSidebar } from '@/components/ui/sidebar';
import gsap from 'gsap';

export function SidebarTriggerCustom() {
  const { toggleSidebar, open } = useSidebar();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const line1Ref = useRef<HTMLDivElement>(null);
  const line2Ref = useRef<HTMLDivElement>(null);
  const line3Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!line1Ref.current || !line2Ref.current || !line3Ref.current) return;

    const ctx = gsap.context(() => {
      if (open) {
        // Animate to X shape
        gsap.to(line1Ref.current, {
          rotate: 45,
          y: 6,
          duration: 0.3,
          ease: 'power2.out',
        });
        gsap.to(line2Ref.current, {
          opacity: 0,
          scaleX: 0,
          duration: 0.2,
          ease: 'power2.out',
        });
        gsap.to(line3Ref.current, {
          rotate: -45,
          y: -6,
          duration: 0.3,
          ease: 'power2.out',
        });
      } else {
        // Animate back to hamburger
        gsap.to(line1Ref.current, {
          rotate: 0,
          y: 0,
          duration: 0.3,
          ease: 'power2.out',
        });
        gsap.to(line2Ref.current, {
          opacity: 1,
          scaleX: 1,
          duration: 0.3,
          delay: 0.1,
          ease: 'power2.out',
        });
        gsap.to(line3Ref.current, {
          rotate: 0,
          y: 0,
          duration: 0.3,
          ease: 'power2.out',
        });
      }
    });

    return () => ctx.revert();
  }, [open]);

  return (
    <button
      ref={buttonRef}
      onClick={toggleSidebar}
      className="group relative w-10 h-10 flex items-center justify-center focus:outline-none"
      aria-label="Toggle sidebar"
    >
      {/* Outer frame */}
      <div className="absolute inset-0 border border-sbi-dark-border/50 group-hover:border-sbi-green/30 transition-colors duration-500" />
      
      {/* Corner accents on hover */}
      <div className="absolute top-0 left-0 w-2 h-2 border-l border-t border-transparent group-hover:border-sbi-green/50 transition-colors duration-300" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-r border-b border-transparent group-hover:border-sbi-green/50 transition-colors duration-300" />
      
      {/* Menu lines */}
      <div className="relative w-5 h-4 flex flex-col justify-between">
        <div
          ref={line1Ref}
          className="w-full h-px bg-sbi-muted group-hover:bg-sbi-green transition-colors duration-300 origin-center"
        />
        <div
          ref={line2Ref}
          className="w-3/4 h-px bg-sbi-muted group-hover:bg-sbi-green transition-colors duration-300 origin-left"
        />
        <div
          ref={line3Ref}
          className="w-full h-px bg-sbi-muted group-hover:bg-sbi-green transition-colors duration-300 origin-center"
        />
      </div>
    </button>
  );
}
