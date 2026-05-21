"use client";

import { Search, X } from "lucide-react";
import { motion } from "motion/react";
import type { CalendarView } from "./types";

interface Props {
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  search: string;
  onSearchChange: (search: string) => void;
}

const VIEW_OPTIONS: ReadonlyArray<{ id: CalendarView; label: string }> = [
  { id: "agenda", label: "Agenda" },
  { id: "month", label: "Month" },
];

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
        className="relative inline-flex rounded-md border border-sbi-dark-border/60 bg-sbi-dark-card/40 p-0.5 shrink-0"
      >
        {VIEW_OPTIONS.map(({ id, label }) => {
          const active = view === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onViewChange(id)}
              className="relative px-3.5 py-1.5 text-xs font-medium tracking-[0.05em] uppercase rounded transition-colors"
            >
              {active ? (
                <motion.span
                  layoutId="calendar-view-toggle"
                  className="absolute inset-0 rounded bg-sbi-green/15"
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  aria-hidden
                />
              ) : null}
              <span
                className={[
                  "relative",
                  active ? "text-sbi-green" : "text-sbi-muted hover:text-white",
                ].join(" ")}
              >
                {label}
              </span>
            </button>
          );
        })}
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
