"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EventRow } from "./EventRow";
import type { RsvpChoice } from "./hooks/useCalendarEvents";
import { MonthPicker } from "./MonthPicker";
import type { CalendarEvent } from "./types";
import {
  buildMonthDays,
  dayNames,
  eventDateKeys,
  formatDateKey,
  prettyDateNoYear,
} from "./utils";

interface EventBar {
  event: CalendarEvent;
  row: number;
  startColumn: number;
  endColumn: number;
  lane: number;
}

interface Props {
  events: CalendarEvent[];
  currentMonth: Date;
  onChangeMonth: (next: Date) => void;
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  canRsvp?: boolean;
  currentProfileId: number | null;
  onRsvp?: (eventId: string, response: RsvpChoice) => void;
  onEdit?: (event: CalendarEvent) => void;
  onDelete?: (event: CalendarEvent) => void;
}

export function MonthView({
  events,
  currentMonth,
  onChangeMonth,
  selectedDate,
  onSelectDate,
  canRsvp,
  currentProfileId,
  onRsvp,
  onEdit,
  onDelete,
}: Props) {
  const [openEventId, setOpenEventId] = useState<string | null>(null);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const ev of events) {
      for (const dateKey of eventDateKeys(ev)) {
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push(ev);
      }
    }
    return map;
  }, [events]);

  const monthCells = useMemo(
    () => buildMonthDays(currentMonth),
    [currentMonth],
  );
  const eventBars = useMemo(() => {
    const dateIndex = new Map(
      monthCells.map(({ date }, index) => [formatDateKey(date), index]),
    );
    const bars: EventBar[] = [];
    for (const event of events) {
      const indices = eventDateKeys(event)
        .map((dateKey) => dateIndex.get(dateKey))
        .filter((index): index is number => index !== undefined)
        .sort((left, right) => left - right);
      if (indices.length === 0) continue;
      let start = indices[0];
      let previous = indices[0];
      for (const index of indices.slice(1)) {
        if (
          index === previous + 1 &&
          Math.floor(index / 7) === Math.floor(previous / 7)
        ) {
          previous = index;
          continue;
        }
        bars.push({
          event,
          row: Math.floor(start / 7),
          startColumn: start % 7,
          endColumn: previous % 7,
          lane: 0,
        });
        start = index;
        previous = index;
      }
      bars.push({
        event,
        row: Math.floor(start / 7),
        startColumn: start % 7,
        endColumn: previous % 7,
        lane: 0,
      });
    }

    const lanesByRow = new Map<number, number[]>();
    return bars
      .sort(
        (left, right) =>
          left.row - right.row || left.startColumn - right.startColumn,
      )
      .map((bar) => {
        const laneEnds = lanesByRow.get(bar.row) ?? [];
        const lane = laneEnds.findIndex((end) => end < bar.startColumn);
        const nextLane = lane === -1 ? laneEnds.length : lane;
        laneEnds[nextLane] = bar.endColumn;
        lanesByRow.set(bar.row, laneEnds);
        return { ...bar, lane: nextLane };
      });
  }, [events, monthCells]);
  const todayKey = formatDateKey(new Date());

  const goPrev = () =>
    onChangeMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1),
    );
  const goNext = () =>
    onChangeMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1),
    );

  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] ?? []) : [];

  // Auto-expand the accordion when the user picks a day with a single event —
  // saves an extra click. When they pick a multi-event day, reset to collapsed.
  useEffect(() => {
    if (!selectedDate) {
      setOpenEventId(null);
      return;
    }
    if (selectedEvents.length === 1) {
      setOpenEventId(selectedEvents[0].id);
    } else {
      setOpenEventId(null);
    }
  }, [selectedDate, selectedEvents]);

  const selectedDateLabel = selectedDate
    ? prettyDateNoYear(new Date(`${selectedDate}T00:00:00`))
    : null;
  const selectedWeekday = selectedDate
    ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString([], {
        weekday: "short",
      })
    : null;

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar -mr-4 sm:-mr-6 md:-mr-8 pr-4 sm:pr-6 md:pr-8">
      <div className="flex items-center justify-between px-1 pb-4">
        <MonthPicker currentMonth={currentMonth} onPick={onChangeMonth} />
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous month"
            className="inline-flex size-10 items-center justify-center rounded-md border border-sbi-dark-border/60 text-sbi-muted hover:bg-sbi-green/5 hover:text-sbi-green transition-colors md:size-7"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Next month"
            className="inline-flex size-10 items-center justify-center rounded-md border border-sbi-dark-border/60 text-sbi-muted hover:bg-sbi-green/5 hover:text-sbi-green transition-colors md:size-7"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 px-1">
        {dayNames.map((d) => (
          <div
            key={d}
            className="py-2 text-center text-[10px] font-medium uppercase tracking-[0.15em] text-sbi-muted/60"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="relative mx-1">
        {/* biome-ignore lint/a11y/useSemanticElements: calendar grid uses ARIA grid role intentionally per WCAG 2.1 — switching to <table> would constrain layout */}
        <div
          role="grid"
          className="grid grid-cols-7 border-l border-t border-sbi-dark-border/40"
        >
          {monthCells.map(({ date, inMonth }) => {
            const key = formatDateKey(date);
            const dayEvs = eventsByDate[key] ?? [];
            const isSelected = selectedDate === key;
            const isToday = key === todayKey;
            const dayNum = date.getDate();

            return (
              <button
                key={`${key}-${inMonth ? "in" : "out"}`}
                type="button"
                aria-pressed={isSelected}
                aria-label={`${key}${isToday ? " (today)" : ""}${dayEvs.length > 0 ? `, ${dayEvs.length} ${dayEvs.length === 1 ? "event" : "events"}` : ""}`}
                onClick={() => onSelectDate(isSelected ? null : key)}
                className={[
                  "group relative flex h-[68px] flex-col items-start gap-1.5 border-b border-r border-sbi-dark-border/40 p-1.5 text-left transition-colors sm:h-[112px] sm:gap-2 sm:p-2.5",
                  isSelected
                    ? "bg-sbi-green/[0.06] shadow-[inset_0_0_0_1px_rgba(34,197,94,0.4)]"
                    : "hover:bg-white/[0.02]",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex size-[22px] items-center justify-center rounded-full text-[13px] tabular-nums transition-colors",
                    isToday
                      ? "bg-sbi-green font-medium text-sbi-dark"
                      : !inMonth
                        ? "text-white/30"
                        : isSelected
                          ? "font-medium text-sbi-green"
                          : "text-white/70 group-hover:text-white",
                  ].join(" ")}
                >
                  {dayNum}
                </span>

                {dayEvs.length > 0 ? (
                  <>
                    {/* Compact event-presence dots on phones — tapping the day
                      surfaces the full list in the selected-day panel below. */}
                    <div className="flex items-center gap-1 pl-0.5 sm:hidden">
                      {dayEvs.slice(0, 3).map((ev) => (
                        <span
                          key={ev.id}
                          className={[
                            "size-1.5 rounded-full",
                            ev.past ? "bg-zinc-600/60" : "bg-sbi-green/70",
                          ].join(" ")}
                        />
                      ))}
                    </div>
                  </>
                ) : null}
              </button>
            );
          })}
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden grid-cols-7 sm:grid"
          style={{
            gridTemplateRows: `repeat(${monthCells.length / 7}, minmax(0, 1fr))`,
          }}
        >
          {eventBars.map((bar, index) => (
            <div
              key={`${bar.event.id}-${bar.row}-${index}`}
              className={[
                "mx-1 mt-9 h-5 self-start truncate rounded-sm px-1.5 text-[11px] font-medium leading-5",
                bar.event.past
                  ? "bg-zinc-700/60 text-zinc-300"
                  : "bg-sbi-green/70 text-sbi-dark",
              ].join(" ")}
              style={{
                gridColumn: `${bar.startColumn + 1} / ${bar.endColumn + 2}`,
                gridRow: bar.row + 1,
                transform: `translateY(${bar.lane * 22}px)`,
              }}
            >
              {bar.event.title}
            </div>
          ))}
        </div>
      </div>

      {selectedDate ? (
        <div className="mt-6 px-1">
          <div className="flex items-center gap-3 pb-2">
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-sbi-green">
              Selected · {selectedWeekday} {selectedDateLabel}
            </span>
            <span className="text-[11px] text-sbi-muted-dark tabular-nums">
              {selectedEvents.length}{" "}
              {selectedEvents.length === 1 ? "event" : "events"}
            </span>
            <div className="flex-1 h-px bg-sbi-dark-border/40" />
            <button
              type="button"
              onClick={() => onSelectDate(null)}
              className="inline-flex min-h-10 items-center gap-1 px-2 text-[11px] text-sbi-muted-dark hover:text-white transition-colors md:min-h-0 md:px-0"
              aria-label="Clear selected day"
            >
              <X className="size-3" />
              Clear
            </button>
          </div>
          {selectedEvents.length === 0 ? (
            <p className="py-4 text-sm text-sbi-muted">
              No events on this day.
            </p>
          ) : (
            <div className="rounded-lg border border-sbi-dark-border/30 bg-sbi-dark-card/30">
              {selectedEvents.map((ev) => (
                <EventRow
                  key={ev.id}
                  event={ev}
                  expanded={openEventId === ev.id}
                  onToggle={() =>
                    setOpenEventId((p) => (p === ev.id ? null : ev.id))
                  }
                  canRsvp={canRsvp}
                  currentProfileId={currentProfileId}
                  onRsvp={onRsvp}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
