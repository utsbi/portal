'use client';

import { useEffect, useState } from 'react';

export function TimeDisplay() {
  const [time, setTime] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      }));
      setDate(now.toLocaleDateString('en-US', { 
        weekday: 'short',
        month: 'short', 
        day: 'numeric' 
      }));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) return null;

  return (
    <div className="time-display absolute top-8 right-8 flex flex-col items-end opacity-0 translate-x-5">
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-extralight tracking-tight text-white/80 tabular-nums">
          {time}
        </span>
      </div>
      <span className="text-xs tracking-[0.2em] uppercase text-sbi-muted-dark font-light">
        {date}
      </span>
      {/* Decorative line */}
      <div className="mt-3 w-12 h-px bg-linear-to-l from-sbi-green/40 to-transparent" />
    </div>
  );
}
