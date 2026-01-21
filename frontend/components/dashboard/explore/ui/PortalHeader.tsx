'use client';

import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';

export function PortalHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-md">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          className="bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/50"
        >
          <Menu className="w-5 h-5" />
        </Button>

        <div className="flex-1" />
      </div>
    </header>
  );
}
