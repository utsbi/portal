"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchableDropdownProps {
    value: string;
    onChange: (val: string) => void;
    options: { value?: string; label: string; options?: { value: string; label: string }[] }[];
    placeholder?: string;
    className?: string;
}

export function SearchableDropdown({
    value,
    onChange,
    options,
    placeholder = "Select...",
    className = "w-40"
}: SearchableDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Filter options based on search
    const filteredOptions = options.map(group => {
        if (group.options) {
            const filteredSub = group.options.filter(opt =>
                opt.label.toLowerCase().includes(search.toLowerCase())
            );
            return filteredSub.length > 0 ? { ...group, options: filteredSub } : null;
        }
        return group.label.toLowerCase().includes(search.toLowerCase()) ? group : null;
    }).filter(Boolean);

    const getDisplayLabel = () => {
        for (const group of options) {
            if (group.options) {
                const found = group.options.find(opt => opt.value === value);
                if (found) return found.label;
            } else if (group.value === value) {
                return group.label;
            }
        }
        return value;
    };

    return (
        <div className={cn("relative group", className)} ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-full bg-[#0d120e] border border-sbi-green/10 text-sbi-muted hover:text-white px-4 py-2 rounded-lg text-xs transition-colors focus:outline-none focus:border-sbi-green/30"
            >
                <span className="truncate">{getDisplayLabel()}</span>
                <ChevronDown className="w-3.5 h-3.5 ml-2 opacity-50" />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 4, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.95 }}
                        transition={{ duration: 0.1 }}
                        className="absolute top-full left-0 mt-1 w-full min-w-[160px] bg-sbi-dark-card border border-sbi-dark-border rounded-xl shadow-xl overflow-hidden z-50 p-1"
                    >
                        {/* Search Input */}
                        <div className="px-2 py-1 mb-1 relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3 h-3 text-sbi-muted-dark" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search..."
                                autoFocus
                                className="w-full bg-sbi-dark border border-sbi-dark-border rounded-lg py-1.5 pl-8 pr-2 text-xs text-white placeholder:text-sbi-muted-dark focus:outline-none focus:border-sbi-green/50"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>

                        {/* Options List */}
                        <div className="max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-sbi-dark-border scrollbar-track-transparent px-1">
                            {filteredOptions.length === 0 ? (
                                <div className="px-3 py-2 text-xs text-sbi-muted-dark text-center">No results</div>
                            ) : (
                                filteredOptions.map((group, idx) => (
                                    <div key={idx}>
                                        {group!.options ? (
                                            <div className="py-1">
                                                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-sbi-muted-dark">{group!.label}</div>
                                                {group!.options.map(opt => (
                                                    <button
                                                        key={opt.value}
                                                        onClick={() => {
                                                            onChange(opt.value);
                                                            setIsOpen(false);
                                                            setSearch("");
                                                        }}
                                                        className={cn(
                                                            "w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors truncate",
                                                            value === opt.value
                                                                ? "bg-sbi-green/10 text-sbi-green"
                                                                : "text-sbi-muted hover:text-white hover:bg-sbi-dark-border/50"
                                                        )}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    onChange(group!.value!);
                                                    setIsOpen(false);
                                                    setSearch("");
                                                }}
                                                className={cn(
                                                    "w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors truncate mb-0.5",
                                                    value === group!.value
                                                        ? "bg-sbi-green/10 text-sbi-green"
                                                        : "text-sbi-muted hover:text-white hover:bg-sbi-dark-border/50"
                                                )}
                                            >
                                                {group!.label}
                                            </button>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
