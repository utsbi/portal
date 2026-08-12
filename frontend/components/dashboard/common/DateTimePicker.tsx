"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDate(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

function monthDays(month: Date): Array<{ date: Date; inMonth: boolean }> {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const first = new Date(year, monthIndex, 1);
  const last = new Date(year, monthIndex + 1, 0);
  const days: Array<{ date: Date; inMonth: boolean }> = [];
  for (let index = first.getDay() - 1; index >= 0; index--) {
    days.push({ date: new Date(year, monthIndex, -index), inMonth: false });
  }
  for (let day = 1; day <= last.getDate(); day++) {
    days.push({ date: new Date(year, monthIndex, day), inMonth: true });
  }
  while (days.length % 7 !== 0) {
    days.push({
      date: new Date(
        year,
        monthIndex + 1,
        days.length - (first.getDay() + last.getDate()) + 1,
      ),
      inMonth: false,
    });
  }
  return days;
}

export function DatePicker({
  value,
  onChange,
  disabled = false,
  onOpenChange,
  ariaLabel = "Choose date",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  onOpenChange?: (open: boolean) => void;
  ariaLabel?: string;
  className?: string;
}) {
  const selected = parseDate(value);
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(
    () =>
      new Date(
        selected?.getFullYear() ?? new Date().getFullYear(),
        selected?.getMonth() ?? new Date().getMonth(),
        1,
      ),
  );
  const wrapperRef = useRef<HTMLDivElement>(null);
  const days = useMemo(() => monthDays(visibleMonth), [visibleMonth]);

  const close = useCallback(() => {
    setOpen(false);
    onOpenChange?.(false);
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      )
        close();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, close]);

  const label = selected
    ? selected.toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Select date";

  return (
    <div className={cn("relative", className)} ref={wrapperRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          const next = !open;
          const month = selected ?? new Date();
          setVisibleMonth(new Date(month.getFullYear(), month.getMonth(), 1));
          setOpen(next);
          onOpenChange?.(next);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        className="flex h-9 w-full items-center gap-2 rounded-md border border-sbi-dark-border/50 bg-sbi-dark-card px-3 text-left text-sm text-white transition-colors hover:border-sbi-green/40 disabled:cursor-not-allowed disabled:border-sbi-dark-border/40 disabled:bg-sbi-dark/50 disabled:text-sbi-muted-dark"
      >
        <CalendarDays className="size-3.5 shrink-0 text-sbi-muted-dark" />
        <span className="truncate">{label}</span>
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label={ariaLabel}
          className="absolute left-0 top-full z-[60] mt-1.5 w-56 max-w-[calc(100vw-4rem)] rounded-lg border border-sbi-dark-border bg-sbi-dark-card p-2 shadow-lg shadow-black/30"
        >
          <div className="mb-1.5 flex items-center justify-between">
            <button
              type="button"
              onClick={() =>
                setVisibleMonth(
                  (month) =>
                    new Date(month.getFullYear(), month.getMonth() - 1, 1),
                )
              }
              aria-label="Previous month"
              className="inline-flex size-7 items-center justify-center rounded-md text-sbi-muted hover:bg-white/[0.05] hover:text-white"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-xs font-medium text-white">
              {MONTH_NAMES[visibleMonth.getMonth()]}{" "}
              {visibleMonth.getFullYear()}
            </span>
            <button
              type="button"
              onClick={() =>
                setVisibleMonth(
                  (month) =>
                    new Date(month.getFullYear(), month.getMonth() + 1, 1),
                )
              }
              aria-label="Next month"
              className="inline-flex size-7 items-center justify-center rounded-md text-sbi-muted hover:bg-white/[0.05] hover:text-white"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-7">
            {DAY_NAMES.map((day) => (
              <span
                key={day}
                className="py-0.5 text-center text-[9px] uppercase tracking-[0.08em] text-sbi-muted-dark"
              >
                {day[0]}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map(({ date, inMonth }) => {
              const dateKey = formatDateKey(date);
              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => {
                    onChange(dateKey);
                    close();
                  }}
                  className={cn(
                    "mx-auto inline-flex size-7 items-center justify-center rounded-md text-xs tabular-nums transition-colors",
                    dateKey === value
                      ? "bg-sbi-green text-sbi-dark"
                      : inMonth
                        ? "text-white hover:bg-white/[0.08]"
                        : "text-sbi-muted-dark/50 hover:bg-white/[0.05]",
                  )}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function formatTime(value: string): string {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return "";
  const date = new Date(2000, 0, 1, Number(match[1]), Number(match[2]));
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function parseTime(value: string): string | null {
  const match = value
    .trim()
    .toLowerCase()
    .match(/^(\d{1,2})(?::?(\d{2}))?\s*([ap]\.?m\.?)?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? "0");
  const period = match[3]?.[0];
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || minutes > 59)
    return null;
  const normalizedHours = period
    ? hours < 1 || hours > 12
      ? null
      : (hours % 12) + (period === "p" ? 12 : 0)
    : hours <= 23
      ? hours
      : null;
  return normalizedHours === null
    ? null
    : `${String(normalizedHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function TimeInput({
  value,
  onChange,
  disabled = false,
  ariaLabel = "Time",
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const [draft, setDraft] = useState(() => formatTime(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(formatTime(value));
  }, [value, focused]);

  const commit = () => {
    if (!draft.trim()) return onChange("");
    const parsed = parseTime(draft);
    if (parsed) {
      onChange(parsed);
      setDraft(formatTime(parsed));
    } else {
      setDraft(formatTime(value));
    }
  };

  return (
    <div className="relative">
      <Clock className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-sbi-muted-dark" />
      <input
        type="text"
        value={draft}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        inputMode="text"
        aria-label={ariaLabel}
        placeholder="e.g. 9:30 AM"
        className="h-9 w-full rounded-md border border-sbi-dark-border/50 bg-sbi-dark-card py-1 pl-9 pr-3 text-sm text-white outline-none transition-colors placeholder:text-sbi-muted-dark focus:border-sbi-green/50 disabled:cursor-not-allowed disabled:border-sbi-dark-border/40 disabled:bg-sbi-dark/50 disabled:text-sbi-muted-dark"
      />
    </div>
  );
}
