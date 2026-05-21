"use client";

import { Search, X } from "lucide-react";
import type { CalendarView } from "./types";

interface Props {
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  search: string;
  onSearchChange: (search: string) => void;
}

export function CalendarHeader({
  view,
  onViewChange,
  search,
  onSearchChange,
}: Props) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div
        role="tablist"
        aria-label="Calendar view"
        className="inline-flex rounded-md border border-sbi-dark-border/60 bg-sbi-dark-card/40 p-0.5 shrink-0"
      >
        <button
          type="button"
          role="tab"
          aria-selected={view === "agenda"}
          onClick={() => onViewChange("agenda")}
          className={[
            "px-3.5 py-1.5 text-xs font-medium tracking-[0.05em] uppercase rounded transition-colors",
            view === "agenda"
              ? "bg-sbi-green/15 text-sbi-green"
              : "text-sbi-muted hover:text-white",
          ].join(" ")}
        >
          Agenda
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "month"}
          onClick={() => onViewChange("month")}
          className={[
            "px-3.5 py-1.5 text-xs font-medium tracking-[0.05em] uppercase rounded transition-colors",
            view === "month"
              ? "bg-sbi-green/15 text-sbi-green"
              : "text-sbi-muted hover:text-white",
          ].join(" ")}
        >
          Month
        </button>
      </div>

      <div className="relative flex-1 sm:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-sbi-muted" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search events"
          className="w-full rounded-md border border-sbi-dark-border/60 bg-sbi-dark-card/40 py-2 pl-9 pr-9 text-sm text-white outline-none placeholder:text-sbi-muted/60 focus:border-sbi-green/40"
        />
        {search ? (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex size-6 items-center justify-center rounded text-sbi-muted hover:text-white"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
