"use client";

import { ChevronDown, Search } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type DropdownOption = {
  value?: string;
  label: string;
  options?: { value: string; label: string }[];
};

interface SearchableDropdownProps {
  value: string;
  onChange: (val: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  className?: string;
}

export function SearchableDropdown({
  value,
  onChange,
  options,
  placeholder = "Select...",
  className = "w-40",
}: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxId = useId();

  // Close on outside click.
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Focus search field when dropdown opens; clear search when it closes.
  useEffect(() => {
    if (isOpen) {
      searchInputRef.current?.focus();
    } else {
      setSearch("");
    }
  }, [isOpen]);

  const filteredOptions = options
    .map((group) => {
      if (group.options) {
        const filteredSub = group.options.filter((opt) =>
          opt.label.toLowerCase().includes(search.toLowerCase()),
        );
        return filteredSub.length > 0
          ? { ...group, options: filteredSub }
          : null;
      }
      return group.label.toLowerCase().includes(search.toLowerCase())
        ? group
        : null;
    })
    .filter(Boolean) as DropdownOption[];

  // Flat list of all selectable leaf options for keyboard navigation.
  const flatOptions = filteredOptions.flatMap((g) =>
    g.options
      ? g.options
      : g.value !== undefined
        ? [{ value: g.value as string, label: g.label }]
        : [],
  );

  // Map from option value → flat index for O(1) lookup during render.
  const flatIdxMap = new Map(flatOptions.map((opt, i) => [opt.value, i]));

  const getDisplayLabel = (): string | null => {
    for (const group of options) {
      if (group.options) {
        const found = group.options.find((opt) => opt.value === value);
        if (found) return found.label;
      } else if (group.value === value && value !== "") {
        return group.label;
      }
    }
    return null;
  };

  const displayLabel = getDisplayLabel();

  const close = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const selectOption = (optValue: string) => {
    onChange(optValue);
    close();
  };

  const focusOption = (idx: number) => {
    dropdownRef.current
      ?.querySelector<HTMLElement>(`[data-option-idx="${idx}"]`)
      ?.focus();
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsOpen(true);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown" && flatOptions.length > 0) {
      e.preventDefault();
      focusOption(0);
    }
  };

  const handleOptionKeyDown = (
    e: React.KeyboardEvent,
    idx: number,
    optValue: string,
  ) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      focusOption(Math.min(idx + 1, flatOptions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (idx === 0) {
        searchInputRef.current?.focus();
      } else {
        focusOption(idx - 1);
      }
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectOption(optValue);
    }
  };

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="flex h-10 items-center justify-between w-full bg-sbi-input border border-sbi-green/10 text-sbi-muted hover:text-white px-4 rounded-lg text-sm transition-colors focus:outline-none focus:border-sbi-green/30"
      >
        <span
          className={cn("truncate", !displayLabel && "text-sbi-muted-dark")}
        >
          {displayLabel ?? placeholder}
        </span>
        <ChevronDown className="w-3.5 h-3.5 ml-2 shrink-0 opacity-50" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className="absolute top-full left-0 mt-1 w-full min-w-[160px] bg-sbi-dark-card border border-sbi-dark-border rounded-lg shadow-xl overflow-hidden z-50 p-1"
          >
            {/* Search input */}
            <div className="px-2 py-1 mb-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3 h-3 text-sbi-muted-dark" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search..."
                className="w-full bg-sbi-dark border border-sbi-dark-border rounded-lg py-1.5 pl-8 pr-2 text-xs text-white placeholder:text-sbi-muted-dark focus:outline-none focus:border-sbi-green/50"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {/* Options */}
            <div
              role="listbox"
              id={listboxId}
              aria-label={placeholder}
              className="max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-sbi-dark-border scrollbar-track-transparent px-1"
            >
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-xs text-sbi-muted-dark text-center">
                  No results
                </div>
              ) : (
                filteredOptions.map((group) => (
                  <div key={group.value ?? group.label}>
                    {group.options ? (
                      <div className="py-1">
                        <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-sbi-muted-dark">
                          {group.label}
                        </div>
                        {group.options.map((opt) => {
                          const idx = flatIdxMap.get(opt.value) ?? 0;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              role="option"
                              aria-selected={value === opt.value}
                              tabIndex={-1}
                              data-option-idx={idx}
                              onClick={() => selectOption(opt.value)}
                              onKeyDown={(e) =>
                                handleOptionKeyDown(e, idx, opt.value)
                              }
                              className={cn(
                                "w-full text-left px-3 py-2 rounded-lg text-xs transition-colors focus:outline-none focus:bg-white/[0.06]",
                                value === opt.value
                                  ? "bg-sbi-green/10 text-sbi-green"
                                  : "text-sbi-muted hover:bg-white/[0.04] hover:text-white",
                              )}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    ) : group.value !== undefined ? (
                      (() => {
                        const optValue = group.value;
                        const idx = flatIdxMap.get(optValue) ?? 0;
                        return (
                          <button
                            type="button"
                            role="option"
                            aria-selected={value === optValue}
                            tabIndex={-1}
                            data-option-idx={idx}
                            onClick={() => selectOption(optValue)}
                            onKeyDown={(e) =>
                              handleOptionKeyDown(e, idx, optValue)
                            }
                            className={cn(
                              "w-full text-left px-3 py-2 rounded-lg text-xs transition-colors focus:outline-none focus:bg-white/[0.06]",
                              value === optValue
                                ? "bg-sbi-green/10 text-sbi-green"
                                : "text-sbi-muted hover:bg-white/[0.04] hover:text-white",
                            )}
                          >
                            {group.label}
                          </button>
                        );
                      })()
                    ) : null}
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
