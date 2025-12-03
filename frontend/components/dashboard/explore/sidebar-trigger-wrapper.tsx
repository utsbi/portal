'use client';

import { useSidebar } from '@/components/ui/sidebar';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useEffect, useState } from 'react';

export function SidebarTriggerWrapper() {
  const { open } = useSidebar();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div
      className="fixed top-4 z-50 transition-all duration-300 ease-in-out"
      style={{
        left: open ? 'calc(16rem + 1rem)' : '1rem',
      }}
    >
      <SidebarTrigger className="bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/50 shadow-lg" />
    </div>
  );
}
