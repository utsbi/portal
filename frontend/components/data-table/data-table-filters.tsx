"use client";

import { Search } from "lucide-react";
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
  // Column visibility slot
  columnToggleSlot?: React.ReactNode;
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
  disabled = false,
}: DataTableFiltersProps) {
  const hasFilters = filters.length > 0 || !!toggleFilter || !!columnToggleSlot;

  if (!searchable && !hasFilters) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 w-full transition-opacity",
        disabled && "opacity-50 pointer-events-none",
      )}
    >
      {/* Search bar (left, flex-grow) */}
      {searchable && (
        <div className="relative grow min-w-[240px] max-w-sm group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-sbi-muted-dark group-focus-within:text-sbi-green transition-colors" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-sbi-input rounded-lg border border-sbi-dark-border/60 text-white placeholder:text-sbi-muted-dark focus:outline-none focus:border-sbi-green/40 transition-colors"
          />
        </div>
      )}

      {/* Toggle filter (left of dropdowns, small element) */}
      {toggleFilter && (
        <div className="flex items-center gap-2">
          <Checkbox
            id="dt-toggle-filter"
            checked={toggleActive}
            onCheckedChange={(checked) => onToggleChange(checked as boolean)}
            className="border-sbi-dark-border data-[state=checked]:bg-sbi-green data-[state=checked]:text-sbi-dark"
          />
          <Label
            htmlFor="dt-toggle-filter"
            className="text-sbi-muted cursor-pointer text-xs whitespace-nowrap"
          >
            {toggleFilter.label}
          </Label>
        </div>
      )}

      {/* Dropdown filters + column visibility (right; wraps on narrow screens
          instead of overflowing the toolbar) */}
      <div className="flex flex-wrap items-center gap-3 text-sm ml-auto">
        {filters.map((filter) => (
          <SearchableDropdown
            key={filter.key}
            value={filterValues[filter.key] ?? filter.defaultValue}
            onChange={(val) => onFilterChange(filter.key, val)}
            options={filter.options}
            className={filter.width ?? "w-36"}
          />
        ))}

        {columnToggleSlot}
      </div>
    </div>
  );
}
