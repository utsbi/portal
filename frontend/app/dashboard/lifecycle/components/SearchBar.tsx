//css lowkey vibe coded
'use client';

import { useState } from 'react';

type SearchBarProps = {
  placeholder: string;
  onSearch: (query: string) => void;
};

export default function SearchBar({ placeholder, onSearch }: SearchBarProps) {
  const [query, setQuery] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    onSearch(value);
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full px-4 py-3 pl-11 bg-sbi-dark-card border border-sbi-dark-border/30 rounded-lg 
                   text-white placeholder:text-sbi-muted-dark font-light tracking-wide
                   focus:outline-none focus:ring-1 focus:ring-sbi-green/50 focus:border-sbi-green/50
                   transition-all duration-200"
      />
      {/* Search Icon */}
      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sbi-muted-dark">
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="h-5 w-5" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
          />
        </svg>
      </div>
    </div>
  );
}