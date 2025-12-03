'use client';

import { useState } from 'react';
import { Input } from '@/components/dashboard/_shared/input';
import { Button } from '@/components/dashboard/_shared/button';
import { Plus } from 'lucide-react';

export function PortalInput() {
  const [input, setInput] = useState('');

  return (
    <div className="input-container">
      {/* Input Field */}
      <div className="relative">
        <Button
          size="icon"
          variant="ghost"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white hover:bg-zinc-800 z-10"
        >
          <Plus className="w-5 h-5" />
        </Button>

        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything ..."
          className="w-full bg-zinc-900/50 border-zinc-800 pl-12 pr-4 py-6 text-base text-white rounded-xl focus:ring-2 focus:ring-zinc-700 focus:border-transparent placeholder:text-zinc-600"
        />
      </div>
    </div>
  );
}
