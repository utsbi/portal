"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { EventRow } from "./EventRow";
import type { RsvpChoice } from "./hooks/useCalendarEvents";
import type { CalendarEvent, RawCalendarEvent } from "./types";
import { bucketEvents, eventMatchesSearch } from "./utils";
import { EmptyState } from "@/components/dashboard/common/ui";

interface Props {
  events: CalendarEvent[];
  rawById: Record<string, RawCalendarEvent>;
  search: string;
  /** YYYY-MM-DD to scroll to (the bucket containing this date). */
  scrollToDate?: string | null;
  canRsvp?: boolean;
  onRsvp?: (eventId: string, response: RsvpChoice) => void;
}

const BUCKET_ID_PREFIX = "calendar-bucket-";

export function AgendaView({
  events,
  rawById,
  search,
  scrollToDate,
  canRsvp,
  onRsvp,
}: Props) {
  const [openEventId, setOpenEventId] = useState<string | null>(null);
  const [pastExpanded, setPastExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return events;
    return events.filter((e) => eventMatchesSearch(e, search));
  }, [events, search]);

  const buckets = useMemo(() => bucketEvents(filtered), [filtered]);
  const nonEmpty = useMemo(
    () => buckets.filter((b) => b.events.length > 0),
    [buckets],
  );

  // The "next up" event: the first future event in the Today bucket if one
  // exists, otherwise the first event in the earliest non-past bucket.
  const nextUpId = useMemo(() => {
    const todayBucket = buckets.find((b) => b.id === "today");
    if (todayBucket && todayBucket.events.length > 0) {
      const now = Date.now();
      const upcoming = todayBucket.events.find(
        (e) => e.start && new Date(e.start).getTime() >= now,
      );
      return (upcoming ?? todayBucket.events[0]).id;
    }
    for (const b of buckets) {
      if (b.id === "past") continue;
      if (b.events.length > 0) return b.events[0].id;
    }
    return null;
  }, [buckets]);

  // Scroll to the bucket containing scrollToDate on mount/changes.
  useEffect(() => {
    if (!scrollToDate || !containerRef.current) return;
    const targetBucket = buckets.find((b) =>
      b.events.some((e) => e.dateKey === scrollToDate),
    );
    if (!targetBucket) return;
    const el = document.getElementById(`${BUCKET_ID_PREFIX}${targetBucket.id}`);
    if (el) {
      el.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }, [scrollToDate, buckets]);

  const toggle = (id: string) =>
    setOpenEventId((prev) => (prev === id ? null : id));

  if (filtered.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <EmptyState
          icon={<CalendarDays className="w-8 h-8" strokeWidth={1.5} />}
          title={search.trim() ? "No matching events" : "No events to show"}
          description={
            search.trim()
              ? "No events match this search."
              : "There are no upcoming events scheduled."
          }
        />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="flex flex-col gap-8 px-1 py-2">
        {nonEmpty.map((bucket) => {
          if (bucket.id === "past") {
            return (
              <section key={bucket.id} id={`${BUCKET_ID_PREFIX}${bucket.id}`}>
                <div className="flex items-center gap-3 pb-2">
                  <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-sbi-muted">
                    Past
                  </span>
                  <span className="text-[11px] text-sbi-muted-dark tabular-nums">
                    {bucket.events.length}{" "}
                    {bucket.events.length === 1 ? "event" : "events"}
                  </span>
                  <div className="flex-1 h-px bg-sbi-dark-border/40" />
                  <button
                    type="button"
                    onClick={() => setPastExpanded((v) => !v)}
                    aria-expanded={pastExpanded}
                    className="text-[11px] text-sbi-muted-dark hover:text-white transition-colors"
                  >
                    {pastExpanded ? "Hide" : "Show"}
                  </button>
                </div>
                {pastExpanded ? (
                  <div className="rounded-lg border border-sbi-dark-border/30 bg-sbi-dark-card/30 opacity-80">
                    {bucket.events.map((ev) => (
                      <EventRow
                        key={ev.id}
                        event={ev}
                        raw={rawById[ev.id]}
                        expanded={openEventId === ev.id}
                        onToggle={() => toggle(ev.id)}
                        dimmed
                      />
                    ))}
                  </div>
                ) : null}
              </section>
            );
          }

          return (
            <section key={bucket.id} id={`${BUCKET_ID_PREFIX}${bucket.id}`}>
              <div className="flex items-center gap-3 pb-2">
                <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-sbi-muted">
                  {bucket.label}
                </span>
                {bucket.rangeLabel ? (
                  <span className="text-[11px] text-sbi-muted-dark tabular-nums">
                    {bucket.rangeLabel}
                  </span>
                ) : null}
                <div className="flex-1 h-px bg-sbi-dark-border/40" />
              </div>
              <div className="rounded-lg border border-sbi-dark-border/30 bg-sbi-dark-card/30">
                {bucket.events.map((ev) => (
                  <EventRow
                    key={ev.id}
                    event={ev}
                    raw={rawById[ev.id]}
                    expanded={openEventId === ev.id}
                    onToggle={() => toggle(ev.id)}
                    canRsvp={canRsvp}
                    onRsvp={onRsvp}
                    isNextUp={ev.id === nextUpId}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
