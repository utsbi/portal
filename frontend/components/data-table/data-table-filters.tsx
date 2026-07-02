"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SearchableDropdown } from "@/components/ui/searchable-dropdown";
import { cn } from "@/lib/utils";

export interface FilterDef {
  key: string;
  label: string;
  options: {
    value?: string;
    label: string;
    options?: { value: string; label: string }[];
  }[];
  defaultValue: string;
  width?: string;
}

interface DataTableFiltersProps {
  // Search
  searchable?: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder?: string;
  // Dropdown filters
  filters?: FilterDef[];
  filterValues: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  // Generic toggle filter
  toggleFilter?: { key: string; value: string; label: string };
  toggleActive: boolean;
  onToggleChange: (checked: boolean) => void;
  // Column visibility slot (inline button + popover, md and up)
  columnToggleSlot?: React.ReactNode;
  // Column visibility as an inline section inside the mobile Filters panel
  columnPanelSlot?: React.ReactNode;
  // Loading state
  disabled?: boolean;
}

export function DataTableFilters({
  searchable = false,
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Search...",
  filters = [],
  filterValues,
  onFilterChange,
  toggleFilter,
  toggleActive,
  onToggleChange,
  columnToggleSlot,
  columnPanelSlot,
  disabled = false,
}: DataTableFiltersProps) {
  const hasFilters = filters.length > 0 || !!toggleFilter || !!columnToggleSlot;
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobilePanelRef = useRef<HTMLDivElement>(null);

  // Close the mobile filters popover on outside click.
  useEffect(() => {
    if (!mobileOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (
        mobilePanelRef.current &&
        !mobilePanelRef.current.contains(event.target as Node)
      ) {
        setMobileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mobileOpen]);

  if (!searchable && !hasFilters) return null;

  const activeCount =
    filters.filter(
      (f) => (filterValues[f.key] ?? f.defaultValue) !== f.defaultValue,
    ).length + (toggleFilter && toggleActive ? 1 : 0);

  const renderToggleRow = (id: string) =>
    toggleFilter ? (
      <div className="flex h-10 items-center gap-2">
        <Checkbox
          id={id}
          checked={toggleActive}
          onCheckedChange={(checked) => onToggleChange(checked as boolean)}
          className="border-sbi-dark-border data-[state=checked]:bg-sbi-green data-[state=checked]:text-sbi-dark"
        />
        <Label
          htmlFor={id}
          className="text-sbi-muted cursor-pointer text-xs whitespace-nowrap"
        >
          {toggleFilter.label}
        </Label>
      </div>
    ) : null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 w-full transition-opacity",
        disabled && "opacity-50 pointer-events-none",
      )}
    >
      {/* Search bar (shares one row with the Filters button on phones; left,
          flex-grow from md up) */}
      {searchable && (
        <div className="relative min-w-0 grow group md:min-w-[240px] md:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-sbi-muted-dark group-focus-within:text-sbi-green transition-colors" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm bg-sbi-input rounded-lg border border-sbi-dark-border/60 text-white placeholder:text-sbi-muted-dark focus:outline-none focus:border-sbi-green/40 transition-colors"
          />
        </div>
      )}

      {/* Below md: everything else collapses into one Filters button that
          opens a compact popover (dropdowns, toggle, column visibility). */}
      {hasFilters && (
        <div className="relative shrink-0 md:hidden" ref={mobilePanelRef}>
          <button
            type="button"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((prev) => !prev)}
            className="flex h-10 items-center gap-1.5 rounded-lg border border-sbi-dark-border/60 bg-sbi-input px-3 text-xs text-sbi-muted transition-colors hover:text-white"
          >
            <SlidersHorizontal size={14} />
            Filters
            {activeCount > 0 && (
              <span className="flex size-4 items-center justify-center rounded-full bg-sbi-green text-[10px] font-medium tabular-nums text-sbi-dark">
                {activeCount}
              </span>
            )}
          </button>
          <AnimatePresence>
            {mobileOpen && (
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.97 }}
                transition={{ duration: 0.12 }}
                className="absolute right-0 top-full z-50 mt-2 w-64 max-w-[calc(100vw-2rem)] space-y-3 rounded-lg border border-sbi-dark-border bg-sbi-dark-card p-3 shadow-xl"
              >
                {filters.map((filter) => (
                  <SearchableDropdown
                    key={filter.key}
                    value={filterValues[filter.key] ?? filter.defaultValue}
                    onChange={(val) => onFilterChange(filter.key, val)}
                    options={filter.options}
                    className="w-full"
                  />
                ))}
                {columnPanelSlot}
                {renderToggleRow("dt-toggle-filter-mobile")}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* md and up: inline dropdowns + column visibility + toggle (unchanged
          desktop treatment) */}
      {toggleFilter && (
        <div className="hidden md:block">
          {renderToggleRow("dt-toggle-filter")}
        </div>
      )}
      <div className="hidden items-center gap-3 text-sm md:ml-auto md:flex">
        {filters.map((filter) => (
          <SearchableDropdown
            key={filter.key}
            value={filterValues[filter.key] ?? filter.defaultValue}
            onChange={(val) => onFilterChange(filter.key, val)}
            options={filter.options}
            className={cn(filter.width ?? "w-36")}
          />
        ))}

        {columnToggleSlot}
      </div>
    </div>
  );
}
