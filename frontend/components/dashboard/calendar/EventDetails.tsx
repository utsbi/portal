"use client";

import {
  Check,
  Download,
  HelpCircle,
  MapPin,
  Pencil,
  Trash2,
  User2,
  X,
} from "lucide-react";
import { useState } from "react";
import type { RsvpChoice } from "./hooks/useCalendarEvents";
import type { AttendeeResponse, CalendarEvent } from "./types";
import { buildIcsUrl, type CalendarEventSource } from "./utils";

interface Props {
  open: boolean;
  event: CalendarEvent;
  /** The signed-in profile id, used to gate edit/delete affordances. */
  currentProfileId: number | null;
  /** True when the signed-in user can RSVP (they're an attendee). */
  canRsvp: boolean;
  onRsvp?: (eventId: string, response: RsvpChoice) => void;
  onEdit?: (event: CalendarEvent) => void;
  onDelete?: (event: CalendarEvent) => void;
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

export function EventDetails({
  open,
  event,
  currentProfileId,
  canRsvp,
  onRsvp,
  onEdit,
  onDelete,
}: Props) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const source: CalendarEventSource = {
    id: event.id,
    title: event.title,
    start: event.start ?? "",
    end: event.end ?? "",
    location: event.location,
    description: event.description,
  };

  const icsUrl = buildIcsUrl(source);

  const description = event.description?.trim();
  const location = event.location?.trim();
  const showRsvp = !!(canRsvp && onRsvp && !event.past);
  // Show edit/delete on any non-past event when handlers exist. The server
  // (RLS) is the source of truth for who can mutate — a non-creator
  // non-director gets a 403 toast if they try.
  const canMutate = !event.past && !!onEdit && !!onDelete && !!currentProfileId;

  return (
    <div
      className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-200 ease-out data-[open=true]:grid-rows-[1fr]"
      data-open={open}
    >
      <div className="overflow-hidden">
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
            {canMutate ? (
              <>
                <button
                  type="button"
                  onClick={() => onEdit?.(event)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-sbi-dark-border/60 bg-transparent px-3 py-1.5 text-[11px] font-medium text-sbi-muted transition-colors hover:text-white hover:border-white/30"
                >
                  <Pencil className="size-3.5" />
                  Edit
                </button>
                {confirmingDelete ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        onDelete?.(event);
                        setConfirmingDelete(false);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-[11px] font-medium text-red-300 transition-colors hover:bg-red-500/20"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(false)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-sbi-dark-border/60 bg-transparent px-3 py-1.5 text-[11px] font-medium text-sbi-muted transition-colors hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-sbi-dark-border/60 bg-transparent px-3 py-1.5 text-[11px] font-medium text-sbi-muted transition-colors hover:text-red-400 hover:border-red-500/30"
                  >
                    <Trash2 className="size-3.5" />
                    Delete
                  </button>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
