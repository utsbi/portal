"use client";

import { ChevronDown } from "lucide-react";
import { EventDetails } from "./EventDetails";
import type { CalendarEvent, RawCalendarEvent } from "./types";
import { relativeUntil } from "./utils";

interface Props {
  event: CalendarEvent;
  raw: RawCalendarEvent | undefined;
  expanded: boolean;
  onToggle: () => void;
  /** Highlights the next-up event in Today with an accent rule + relative pill. */
  isNextUp?: boolean;
  /** Past events render dimmed even when not in the Past bucket. */
  dimmed?: boolean;
}

export function EventRow({
  event,
  raw,
  expanded,
  onToggle,
  isNextUp = false,
  dimmed = false,
}: Props) {
  const meta = [event.startTime + (event.endTime ? ` – ${event.endTime}` : "")]
    .concat(event.location ? [event.location] : [])
    .concat([event.organizer])
    .filter(Boolean)
    .join(" · ");

  const relative = isNextUp ? relativeUntil(event.start) : null;

  return (
    <div
      className={[
        "border-b border-sbi-dark-border/30 last:border-b-0",
        isNextUp ? "bg-sbi-green/[0.04]" : "",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={[
          "group flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.02]",
          isNextUp
            ? "border-l-2 border-l-sbi-green"
            : "border-l-2 border-l-transparent",
        ].join(" ")}
      >
        <div className="min-w-0 flex-1">
          <div
            className={[
              "text-sm font-medium leading-snug",
              dimmed || event.past ? "text-zinc-400" : "text-white",
            ].join(" ")}
          >
            {event.title}
          </div>
          <div
            className={[
              "mt-1 text-xs leading-snug tabular-nums",
              dimmed || event.past ? "text-zinc-500" : "text-sbi-muted",
            ].join(" ")}
          >
            {meta}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {relative ? (
            <span className="inline-flex items-center rounded-full bg-sbi-green/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-sbi-green">
              {relative}
            </span>
          ) : null}
          <ChevronDown
            className={[
              "size-3.5 shrink-0 text-sbi-muted-dark transition-transform",
              expanded ? "rotate-180" : "",
            ].join(" ")}
          />
        </div>
      </button>

      <EventDetails open={expanded} event={event} raw={raw} />
    </div>
  );
}
