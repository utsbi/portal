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
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) return null;

  return (
    <div className="flex items-center gap-4">
      <div className="w-px h-8 bg-sbi-dark-border/30" />
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <span className="text-xs tracking-[0.2em] uppercase text-sbi-muted-dark font-light leading-tight">
            {date}
          </span>
          <span className="text-sm font-light text-white/80 tabular-nums leading-tight">
            {time}
          </span>
        </div>
      </div>
    </div>
  );
}
