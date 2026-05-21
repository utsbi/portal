"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { generateDemoEvents } from "../demo-events";
import type { CalendarEvent, EventsResponse, RawCalendarEvent } from "../types";
import {
  buildInternalUrl,
  CALENDAR_EVENTS_API,
  normalizeEvent,
} from "../utils";

interface UseCalendarEventsState {
  events: CalendarEvent[];
  /** Raw events kept around for "Add to Google" / .ics actions which need the original fields. */
  rawById: Record<string, RawCalendarEvent>;
  loading: boolean;
  refetching: boolean;
  error: string | null;
  connected: boolean | null;
  refetch: () => Promise<void>;
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

  return {
    events,
    rawById,
    loading,
    refetching,
    error,
    connected,
    refetch: load,
  };
}
