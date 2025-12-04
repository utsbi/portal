'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { TrendingUp, DollarSign, AlertCircle } from 'lucide-react';
import gsap from 'gsap';

const suggestions = [
  { icon: TrendingUp, text: 'Progress updates' },
  { icon: DollarSign, text: 'Budget summary' },
  { icon: AlertCircle, text: 'Current Project blockers' },
];

export function SuggestionChips() {
  const chipsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chipsRef.current) return;

    const chips = chipsRef.current.querySelectorAll('.suggestion-chip');
    
    // Set initial state to visible but transparent
    gsap.set(chips, { opacity: 0, scale: 0.8 });

    // Animate in
    const ctx = gsap.context(() => {
      gsap.to(chips, {
        opacity: 1,
        scale: 1,
        duration: 0.6,
        delay: 0.8,
        stagger: 0.1,
        ease: 'back.out(1.7)',
      });
    }, chipsRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={chipsRef} className="flex flex-wrap items-center justify-center gap-3">
      {suggestions.map((suggestion, index) => (
        <Button
          key={index}
          variant="outline"
          className="suggestion-chip bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white rounded-full px-4 py-2 text-xs transition-all duration-300 hover:scale-105"
        >
          <suggestion.icon className="w-4 h-4 mr-2" />
          {suggestion.text || '...'}
        </Button>
      ))}
    </div>
  );
}
