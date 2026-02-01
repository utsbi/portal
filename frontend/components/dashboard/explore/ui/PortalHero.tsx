'use client';

import { useState } from 'react';

export function PortalHero() {
  const [userName] = useState('John Doe'); // This would come from auth context

  return (
    <div className="flex flex-col items-center text-center space-y-6">
      {/* Main greeting */}
      <div className="hero-content opacity-0 translate-y-10 space-y-4">
        {/* Greeting text */}
        <div className="overflow-hidden">
          <h1 className="text-4xl md:text-4xl lg:text-5xl font-extralight tracking-tight text-white leading-none">
            Hello, <span className="text-sbi-green">{userName}</span>
          </h1>
        </div>
        
        {/* Subtitle with refined styling */}
        <p className="text-lg md:text-xl font-light text-sbi-muted tracking-wide">
          How can I help you?
        </p>
      </div>

      {/* Original decorative line */}
      <div className="hero-content opacity-0 translate-y-10 w-24 h-px bg-linear-to-r from-transparent via-sbi-green/50 to-transparent" />
    </div>
  );
}
