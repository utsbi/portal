'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface StatusIndicatorProps {
  label: string;
  value: string | number;
  status?: 'active' | 'pending' | 'complete';
}

export function StatusIndicator({ label, value, status = 'active' }: StatusIndicatorProps) {
  const indicatorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!indicatorRef.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        indicatorRef.current,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }
      );
    });

    return () => ctx.revert();
  }, []);

  const statusColors = {
    active: 'bg-sbi-green',
    pending: 'bg-amber-500',
    complete: 'bg-blue-400',
  };

  return (
    <div ref={indicatorRef} className="group flex items-center gap-3 px-4 py-2 cursor-default">
      {/* Status dot */}
      <div className="relative">
        <div className={`w-1.5 h-1.5 rounded-full ${statusColors[status]}`} />
        {status === 'active' && (
          <div className={`absolute inset-0 w-1.5 h-1.5 rounded-full ${statusColors[status]} animate-ping opacity-75`} />
        )}
      </div>
      
      {/* Content */}
      <div className="flex flex-col">
        <span className="text-[10px] tracking-[0.2em] uppercase text-sbi-muted-dark font-medium">
          {label}
        </span>
        <span className="text-xs font-light text-white tabular-nums">
          {value}
        </span>
      </div>
      
      {/* Hover line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-sbi-green/0 group-hover:bg-sbi-green/20 transition-colors duration-300" />
    </div>
  );
}

export function ProjectStatusBar() {
  return (
    <div className="hidden md:flex items-center gap-1 border-l border-sbi-dark-border/30 ml-4">
      <StatusIndicator label="Active Tasks" value={3} status="active" />
      <div className="w-px h-6 bg-sbi-dark-border/20" />
      <StatusIndicator label="Under Review" value={2} status="pending" />
      <div className="w-px h-6 bg-sbi-dark-border/20" />
      <StatusIndicator label="Completed" value={12} status="complete" />
    </div>
  );
}
