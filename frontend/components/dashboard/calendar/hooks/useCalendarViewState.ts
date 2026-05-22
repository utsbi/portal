"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { CalendarView } from "../types";

const ALLOWED_VIEWS: CalendarView[] = ["agenda", "month"];

function parseView(value: string | null): CalendarView {
  if (value && (ALLOWED_VIEWS as string[]).includes(value)) {
    return value as CalendarView;
  }
  return "agenda";
}

function parseDate(value: string | null): string | null {
  if (!value) return null;
  // Accept only YYYY-MM-DD form to avoid carrying arbitrary strings.
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export interface CalendarViewState {
  view: CalendarView;
  selectedDate: string | null;
  setView: (view: CalendarView) => void;
  setSelectedDate: (date: string | null) => void;
}

export function useCalendarViewState(): CalendarViewState {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const view = parseView(searchParams.get("view"));
  const selectedDate = parseDate(searchParams.get("date"));

  const writeParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const next = params.toString();
      router.replace(next ? `${pathname}?${next}` : pathname, {
        scroll: false,
      });
    },
    [router, pathname, searchParams],
  );

  const setView = useCallback(
    (nextView: CalendarView) => {
      writeParams((params) => {
        if (nextView === "agenda") {
          params.delete("view");
        } else {
          params.set("view", nextView);
        }
      });
    },
    [writeParams],
  );

  const setSelectedDate = useCallback(
    (date: string | null) => {
      writeParams((params) => {
        if (date) {
          params.set("date", date);
        } else {
          params.delete("date");
        }
      });
    },
    [writeParams],
  );

  return useMemo(
    () => ({ view, selectedDate, setView, setSelectedDate }),
    [view, selectedDate, setView, setSelectedDate],
  );
}
