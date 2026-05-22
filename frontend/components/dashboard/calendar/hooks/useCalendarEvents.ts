"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { generateDemoEvents } from "../demo-events";
import type {
  AttendeeResponse,
  CalendarEvent,
  EventsResponse,
  RawCalendarEvent,
} from "../types";
import {
  buildInternalUrl,
  CALENDAR_EVENTS_API,
  normalizeEvent,
} from "../utils";

export type RsvpChoice = "accepted" | "declined" | "tentative";

interface UseCalendarEventsState {
  events: CalendarEvent[];
  /** Raw events kept around for "Add to Google" / .ics actions which need the original fields. */
  rawById: Record<string, RawCalendarEvent>;
  loading: boolean;
  refetching: boolean;
  error: string | null;
  connected: boolean | null;
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
  const [rawById, setRawById] = useState<Record<string, RawCalendarEvent>>({});
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const hasLoadedOnceRef = useRef(false);

  const load = useCallback(async () => {
    if (demoMode) {
      const raw = generateDemoEvents();
      const normalized = raw.map(normalizeEvent);
      const map: Record<string, RawCalendarEvent> = {};
      raw.forEach((r, i) => {
        const id = normalized[i].id;
        map[id] = r;
      });
      setEvents(normalized);
      setRawById(map);
      setConnected(true);
      setError(null);
      setLoading(false);
      setRefetching(false);
      hasLoadedOnceRef.current = true;
      return;
    }

    if (!projectId) {
      setEvents([]);
      setRawById({});
      setConnected(null);
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
        if (!hasLoadedOnceRef.current) {
          setEvents([]);
          setRawById({});
        }
        setError("Couldn't load events. The calendar service didn't respond.");
        return;
      }

      const json: EventsResponse = await res.json();
      const raw = json.events ?? [];
      const normalized = raw.map(normalizeEvent);
      const map: Record<string, RawCalendarEvent> = {};
      raw.forEach((r, i) => {
        map[normalized[i].id] = r;
      });
      setEvents(normalized);
      setRawById(map);
      setConnected(json.connected ?? null);
      hasLoadedOnceRef.current = true;
    } catch (e) {
      console.error("Failed to load calendar events:", e);
      if (!hasLoadedOnceRef.current) {
        setEvents([]);
        setRawById({});
      }
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
      if (!projectId && !demoMode) return;

      // Optimistically update local state — revert on failure.
      let previousResponse: AttendeeResponse | undefined;
      setEvents((curr) =>
        curr.map((e) => {
          if (e.id !== eventId) return e;
          previousResponse = e.myResponse;
          return { ...e, myResponse: response };
        }),
      );

      if (demoMode) return;

      const target = events.find((e) => e.id === eventId);
      if (!target?.calendarId) return;

      try {
        const res = await fetch("/api/contact/calendar/client-events/rsvp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId,
            calendarId: target.calendarId,
            projectId,
            response,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          console.error("RSVP failed:", res.status, body);
          throw new Error(
            body?.error ?? `RSVP request failed with ${res.status}`,
          );
        }
      } catch (e) {
        console.error("Failed to RSVP:", e);
        // Only revert if the local state STILL holds the value this call set.
        // Without this check, a second click ("Maybe") that succeeds could be
        // clobbered by the revert of a still-in-flight first call ("Going").
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
    [events, projectId, demoMode],
  );

  return {
    events,
    rawById,
    loading,
    refetching,
    error,
    connected,
    refetch: load,
    rsvp,
  };
}
