'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export function PortalInput() {
  const [input, setInput] = useState('');

  return (
    <div className="input-container opacity-0 translate-y-8">
      <div className="relative group">
        <Button
          size="icon"
          variant="ghost"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-sbi-muted hover:text-sbi-green hover:bg-sbi-dark-card z-10 transition-colors duration-300"
        >
          <Plus className="w-5 h-5" strokeWidth={1.5} />
        </Button>

        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything ..."
          className="w-full bg-sbi-dark-card border border-sbi-dark-border pl-12 pr-4 py-6 text-base text-white font-light tracking-wide focus:ring-1 focus:ring-sbi-green/30 focus:border-sbi-green/30 placeholder:text-sbi-muted-dark transition-all duration-300 hover:border-sbi-green/20"
        />
        <div className="absolute bottom-0 left-0 w-0 h-px bg-sbi-green group-focus-within:w-full transition-all duration-500" />
      </div>
    </div>
  );
}
