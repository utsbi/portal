'use client';

import { useEffect, useRef } from 'react';
import { TrendingUp, DollarSign, Clock } from 'lucide-react';
import gsap from 'gsap';

const suggestions = [
  { icon: TrendingUp, text: 'Progress updates', accent: 'emerald' },
  { icon: DollarSign, text: 'Budget summary', accent: 'emerald' },
  { icon: Clock, text: 'Current Project blockers', accent: 'emerald' },
];

interface SuggestionChipsProps {
  disableAutoAnimation?: boolean;
}

export function SuggestionChips({ disableAutoAnimation = false }: SuggestionChipsProps) {
  const chipsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (disableAutoAnimation) return;
    if (!chipsRef.current) return;

    const chips = chipsRef.current.querySelectorAll('.suggestion-chip');
    
    gsap.set(chips, { opacity: 0, y: 15, scale: 0.95 });

    const ctx = gsap.context(() => {
      gsap.to(chips, {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.8,
        delay: 1,
        stagger: 0.1,
        ease: 'power3.out',
      });
    }, chipsRef);

    return () => ctx.revert();
  }, [disableAutoAnimation]);

  return (
    <div ref={chipsRef} className="flex flex-wrap items-center justify-center gap-3">
      {suggestions.map((suggestion, index) => (
        <button
          key={index}
          type="button"
          className="suggestion-chip invisible opacity-0 translate-y-4 scale-95 group relative overflow-hidden rounded-full"
        >
          {/* Background layers */}
          <div className="absolute inset-0 bg-sbi-dark-card/60 backdrop-blur-sm transition-all duration-500 group-hover:bg-sbi-dark-card rounded-full" />
          <div className="absolute inset-0 bg-linear-to-r from-sbi-green/0 via-sbi-green/5 to-sbi-green/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 rounded-full" />
          
          {/* Border */}
          <div className="absolute inset-0 border border-sbi-dark-border group-hover:border-sbi-green/30 transition-colors duration-500 rounded-full" />
          
          {/* Content */}
          <div className="relative flex items-center gap-3 px-6 py-3">
            <suggestion.icon 
              className="w-4 h-4 text-sbi-muted group-hover:text-sbi-green transition-colors duration-300" 
              strokeWidth={1.5} 
            />
            <span className="text-sm font-extralight tracking-wide text-sbi-muted group-hover:text-white transition-colors duration-300">
              {suggestion.text}
            </span>
          </div>
          
          {/* Bottom glow indicator on hover */}
          <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 shadow-[inset_0_-1px_0_0_rgba(34,197,94,0.3)]" />
        </button>
      ))}
    </div>
  );
}
