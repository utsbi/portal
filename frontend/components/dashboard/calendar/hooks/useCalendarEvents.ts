"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { generateDemoEvents } from "../demo-events";
import type { AttendeeResponse, CalendarEvent, EventsResponse } from "../types";
import {
  buildInternalUrl,
  CALENDAR_EVENTS_API,
  normalizeEvent,
} from "../utils";

export type RsvpChoice = "accepted" | "declined" | "tentative";

interface UseCalendarEventsState {
  events: CalendarEvent[];
  loading: boolean;
  refetching: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  rsvp: (eventId: string, response: RsvpChoice) => Promise<void>;
}

interface Options {
  projectId: number | null | undefined;
  demoMode: boolean;
}

export function useCalendarEvents({
  projectId,
  demoMode,
}: Options): UseCalendarEventsState {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnceRef = useRef(false);

  const load = useCallback(async () => {
    if (demoMode) {
      const raw = generateDemoEvents();
      const normalized = raw.map(normalizeEvent);
      setEvents(normalized);
      setError(null);
      setLoading(false);
      setRefetching(false);
      hasLoadedOnceRef.current = true;
      return;
    }

    if (!projectId) {
      setEvents([]);
      setError(null);
      setLoading(false);
      return;
    }

    if (hasLoadedOnceRef.current) {
      setRefetching(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const url = buildInternalUrl(CALENDAR_EVENTS_API, {
        project_id: String(projectId),
      });
      const res = await fetch(url);

      if (!res.ok) {
        if (!hasLoadedOnceRef.current) setEvents([]);
        setError("Couldn't load events. The calendar service didn't respond.");
        return;
      }

      const json: EventsResponse = await res.json();
      const raw = json.events ?? [];
      setEvents(raw.map(normalizeEvent));
      hasLoadedOnceRef.current = true;
    } catch (e) {
      console.error("Failed to load calendar events:", e);
      if (!hasLoadedOnceRef.current) setEvents([]);
      setError("Couldn't load events. The calendar service didn't respond.");
    } finally {
      setLoading(false);
      setRefetching(false);
    }
  }, [projectId, demoMode]);

  useEffect(() => {
    load();
  }, [load]);

  const rsvp = useCallback(
    async (eventId: string, response: RsvpChoice) => {
      if (demoMode) {
        // Optimistic update only in demo mode.
        setEvents((curr) =>
          curr.map((e) =>
            e.id === eventId ? { ...e, myResponse: response } : e,
          ),
        );
        return;
      }

      // Optimistic update — revert on failure.
      let previousResponse: AttendeeResponse | undefined;
      setEvents((curr) =>
        curr.map((e) => {
          if (e.id !== eventId) return e;
          previousResponse = e.myResponse;
          return { ...e, myResponse: response };
        }),
      );

      try {
        const res = await fetch("/api/contact/calendar/client-events/rsvp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId: Number(eventId), response }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(
            body.error ?? `RSVP request failed with ${res.status}`,
          );
        }
      } catch (e) {
        console.error("Failed to RSVP:", e);
        // Only revert if the local state STILL holds the value this call set.
        setEvents((curr) =>
          curr.map((evt) =>
            evt.id === eventId &&
            evt.myResponse === response &&
            previousResponse !== undefined
              ? { ...evt, myResponse: previousResponse }
              : evt,
          ),
        );
      }
    },
    [demoMode],
  );

  return {
    events,
    loading,
    refetching,
    error,
    refetch: load,
    rsvp,
  };
}
