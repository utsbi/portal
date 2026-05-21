"use client";

import { Check, Download, HelpCircle, MapPin, User2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { RsvpChoice } from "./hooks/useCalendarEvents";
import type {
  AttendeeResponse,
  CalendarEvent,
  RawCalendarEvent,
} from "./types";
import { buildIcsUrl, type CalendarEventSource } from "./utils";

interface Props {
  open: boolean;
  event: CalendarEvent;
  raw: RawCalendarEvent | undefined;
  canRsvp?: boolean;
  onRsvp?: (eventId: string, response: RsvpChoice) => void;
}

const RSVP_OPTIONS: ReadonlyArray<{
  value: RsvpChoice;
  label: string;
  icon: typeof Check;
  matches: AttendeeResponse;
  activeClasses: string;
}> = [
  {
    value: "accepted",
    label: "Going",
    icon: Check,
    matches: "accepted",
    activeClasses: "border-sbi-green/40 bg-sbi-green/10 text-sbi-green",
  },
  {
    value: "tentative",
    label: "Maybe",
    icon: HelpCircle,
    matches: "tentative",
    activeClasses: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  },
  {
    value: "declined",
    label: "Not going",
    icon: X,
    matches: "declined",
    activeClasses: "border-zinc-500/40 bg-zinc-500/10 text-zinc-300",
  },
];

export function EventDetails({ open, event, raw, canRsvp, onRsvp }: Props) {
  const calendarSource: CalendarEventSource = {
    summary: raw?.summary ?? event.title,
    start: raw?.start ?? event.start ?? "",
    end: raw?.end ?? event.end ?? "",
    location: raw?.location ?? event.location ?? "",
    description: raw?.description ?? event.description ?? "",
  };

  const icsUrl = buildIcsUrl(calendarSource);

  const description = event.description?.trim();
  const location = event.location?.trim();
  const showRsvp = !!(canRsvp && onRsvp && !event.past);

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          key="details"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden"
        >
          <div className="px-4 pb-4 pt-1">
            {location ? (
              <div className="flex items-start gap-2 text-xs text-sbi-muted mb-2">
                <MapPin className="size-3.5 mt-px shrink-0 text-sbi-muted-dark" />
                <span className="leading-snug">{location}</span>
              </div>
            ) : null}

            <div className="flex items-start gap-2 text-xs text-sbi-muted mb-3">
              <User2 className="size-3.5 mt-px shrink-0 text-sbi-muted-dark" />
              <span className="leading-snug">{event.organizer}</span>
            </div>

            {description ? (
              <p className="text-xs leading-relaxed text-sbi-muted mb-4 whitespace-pre-wrap">
                {description}
              </p>
            ) : null}

            {showRsvp ? (
              <div className="mb-3">
                <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-sbi-muted-dark mb-2">
                  Your response
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {RSVP_OPTIONS.map(
                    ({ value, label, icon: Icon, matches, activeClasses }) => {
                      const active = event.myResponse === matches;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => onRsvp?.(event.id, value)}
                          aria-pressed={active}
                          className={[
                            "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[11px] font-medium transition-colors",
                            active
                              ? activeClasses
                              : "border-sbi-dark-border/60 bg-transparent text-sbi-muted hover:text-white hover:border-white/30",
                          ].join(" ")}
                        >
                          <Icon className="size-3.5" />
                          {label}
                        </button>
                      );
                    },
                  )}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <a
                href={icsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-sbi-dark-border/60 bg-transparent px-3 py-1.5 text-[11px] font-medium text-sbi-muted transition-colors hover:text-white hover:border-white/30"
              >
                <Download className="size-3.5" />
                Download .ics
              </a>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
