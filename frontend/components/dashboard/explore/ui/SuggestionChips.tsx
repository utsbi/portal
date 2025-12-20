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
          className="suggestion-chip group relative overflow-hidden"
        >
          {/* Background layers */}
          <div className="absolute inset-0 bg-sbi-dark-card/60 backdrop-blur-sm transition-all duration-500 group-hover:bg-sbi-dark-card" />
          <div className="absolute inset-0 bg-linear-to-r from-sbi-green/0 via-sbi-green/5 to-sbi-green/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
          
          {/* Border */}
          <div className="absolute inset-0 border border-sbi-dark-border group-hover:border-sbi-green/30 transition-colors duration-500" />
          
          {/* Corner accents on hover */}
          <div className="absolute top-0 left-0 w-2 h-2 border-l border-t border-sbi-green/0 group-hover:border-sbi-green/50 transition-all duration-300" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-r border-b border-sbi-green/0 group-hover:border-sbi-green/50 transition-all duration-300" />
          
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
          
          {/* Bottom line indicator */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-px bg-sbi-green group-hover:w-3/4 transition-all duration-500" />
        </button>
      ))}
    </div>
  );
}
