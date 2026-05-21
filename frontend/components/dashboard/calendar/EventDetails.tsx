"use client";

import { Download, ExternalLink, MapPin, User2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { CalendarEvent, RawCalendarEvent } from "./types";
import {
  buildGoogleCalendarUrl,
  buildIcsUrl,
  type CalendarEventSource,
} from "./utils";

interface Props {
  open: boolean;
  event: CalendarEvent;
  raw: RawCalendarEvent | undefined;
}

export function EventDetails({ open, event, raw }: Props) {
  const calendarSource: CalendarEventSource = {
    summary: raw?.summary ?? event.title,
    start: raw?.start ?? event.start ?? "",
    end: raw?.end ?? event.end ?? "",
    location: raw?.location ?? event.location ?? "",
    description: raw?.description ?? event.description ?? "",
  };

  const googleUrl = buildGoogleCalendarUrl(calendarSource);
  const icsUrl = buildIcsUrl(calendarSource);

  const description = event.description?.trim();
  const location = event.location?.trim();

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

            <div className="flex flex-wrap items-center gap-2">
              <a
                href={googleUrl}
                target="_blank"
                rel="noreferrer"
                className={
                  event.past
                    ? "inline-flex items-center gap-1.5 rounded-md border border-sbi-dark-border/60 bg-transparent px-3 py-1.5 text-[11px] font-medium text-sbi-muted transition-colors hover:text-white"
                    : "inline-flex items-center gap-1.5 rounded-md border border-sbi-green/30 bg-sbi-green/10 px-3 py-1.5 text-[11px] font-medium text-sbi-green transition-colors hover:bg-sbi-green/15"
                }
              >
                <ExternalLink className="size-3.5" />
                Add to Google Calendar
              </a>
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
