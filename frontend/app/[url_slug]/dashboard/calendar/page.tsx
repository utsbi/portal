"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Filter,
  Mail,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const CALENDAR_EVENTS_API =
  process.env.NEXT_PUBLIC_CALENDAR_EVENTS_API || "";
const CALENDAR_ICS_API =
  process.env.NEXT_PUBLIC_CALENDAR_ICS_API || "";
const GOOGLE_CALENDAR_RENDER_URL =
  process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_URL || "";

function buildMonthDays(currentMonth: Date) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startOffset = firstDay.getDay();
  const cells: Array<{ date: Date; inMonth: boolean }> = [];

  for (let i = startOffset - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month, -i), inMonth: false });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), inMonth: true });
  }

  while (cells.length % 7 !== 0) {
    const next = new Date(
      year,
      month + 1,
      cells.length - (startOffset + daysInMonth) + 1
    );
    cells.push({ date: next, inMonth: false });
  }

  return cells;
}

function formatDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatGoogleDate(dateString?: string | null) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const h = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  const s = String(date.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${d}T${h}${min}${s}Z`;
}

function safeTime(dateString?: string | null) {
  if (!dateString) return "";
  return new Date(dateString).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function prettyDate(dateString?: string | null) {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isPastEvent(end?: string | null) {
  if (!end) return false;
  return new Date(end) < new Date();
}

function buildInternalUrl(pathname: string, params?: Record<string, string>) {
  const searchParams = new URLSearchParams(params);
  return searchParams.toString()
    ? `${pathname}?${searchParams.toString()}`
    : pathname;
}

function buildGoogleCalendarUrl(event: {
  summary?: string | null;
  start?: string | null;
  end?: string | null;
  location?: string | null;
  description?: string | null;
}) {
  if (!GOOGLE_CALENDAR_RENDER_URL) return "#";

  const url = new URL(GOOGLE_CALENDAR_RENDER_URL);
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", event.summary ?? "Event");
  url.searchParams.set(
    "dates",
    `${formatGoogleDate(event.start)}/${formatGoogleDate(event.end)}`
  );
  url.searchParams.set("location", event.location ?? "");
  url.searchParams.set("details", event.description ?? "");
  return url.toString();
}

function buildIcsUrl(event: {
  summary?: string | null;
  start?: string | null;
  end?: string | null;
  location?: string | null;
  description?: string | null;
}) {
  if (!CALENDAR_ICS_API) return "#";

  return buildInternalUrl(CALENDAR_ICS_API, {
    summary: event.summary ?? "Event",
    start: event.start ?? "",
    end: event.end ?? "",
    location: event.location ?? "",
    description: event.description ?? "",
  });
}

function UrbanistWords({ text }: { text?: string | null }) {
  if (!text) return null;

  return (
    <>
      {text.split(/(\d+)/).map((part, i) => {
        const isNumber = /^\d+$/.test(part);

        return (
          <span key={i} className={isNumber ? undefined : "font-urbanist"}>
            {part}
          </span>
        );
      })}
    </>
  );
}

function StatusBadge({
  past,
  isToday,
}: {
  past: boolean;
  isToday?: boolean;
}) {
  if (isToday) {
    return (
      <span className="font-urbanist inline-flex items-center gap-1.5 rounded-full border border-blue-700 bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-300">
        <span className="inline-block size-1.5 rounded-full bg-blue-300" />
        Today
      </span>
    );
  }

  if (past) {
    return (
      <span className="font-urbanist inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-700/20 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
        <span className="inline-block size-1.5 rounded-full bg-zinc-500" />
        Past
      </span>
    );
  }

  return (
    <span className="font-urbanist inline-flex items-center gap-1.5 rounded-full border border-sbi-dark-border bg-sbi-green/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-sbi-green">
      <span className="inline-block size-1.5 rounded-full bg-sbi-green" />
      Upcoming
    </span>
  );
}

function NavButton({
  onClick,
  disabled,
  ariaLabel,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={[
        "inline-flex h-7 w-7 items-center justify-center rounded-md border transition",
        disabled
          ? "cursor-not-allowed border-sbi-dark-border text-white/10"
          : "border-sbi-dark-border text-sbi-green hover:bg-sbi-green/5",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export default function CalendarPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [appointmentsPage, setAppointmentsPage] = useState(0);
  const appointmentsPerPage = 3;

  const goToPreviousMonth = () =>
    setCurrentMonth((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1));

  const goToNextMonth = () =>
    setCurrentMonth((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1));

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user) {
          setLoading(false);
          return;
        }

        const { data: client } = await supabase
          .from("clients")
          .select("id")
          .eq("uid", auth.user.id)
          .single();

        if (!client?.id || !CALENDAR_EVENTS_API) {
          setLoading(false);
          return;
        }

        const eventsUrl = buildInternalUrl(CALENDAR_EVENTS_API, {
          client_id: client.id,
        });

        const res = await fetch(eventsUrl);
        const json = await res.json();

        if (res.ok) setEvents(json.events || []);
      } catch (e) {
        console.error("Failed to load calendar events:", e);
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, []);

  const calendarEvents = useMemo(
    () =>
      events.map((e) => {
        const startDate = e.start ? new Date(e.start) : null;

        return {
          id: e.id,
          title: e.summary ?? "Untitled Event",
          date: e.start?.split("T")[0] ?? "",
          prettyDate: prettyDate(e.start),
          monthName: startDate
            ? startDate.toLocaleString("default", { month: "long" })
            : "",
          shortMonth: startDate
            ? startDate.toLocaleString("default", { month: "short" })
            : "",
          day: startDate ? String(startDate.getDate()) : "",
          year: startDate ? String(startDate.getFullYear()) : "",
          time: safeTime(e.start),
          endTime: safeTime(e.end),
          director: e.creatorName ?? e.creatorEmail ?? "Unknown Organizer",
          start: e.start,
          end: e.end,
        };
      }),
    [events]
  );

  const eventsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    calendarEvents.forEach((ev) => {
      if (!ev.date) return;
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    });
    return map;
  }, [calendarEvents]);

  const rightPanelEvents = useMemo(() => {
    const searchValue = search.toLowerCase().trim();

    const matchesSearch = (e: any) => {
      if (!searchValue) return true;

      const searchableText = [
        e.title,
        e.prettyDate,
        e.date,
        e.monthName,
        e.shortMonth,
        e.day,
        e.year,
        e.time,
        e.director,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const searchTerms = searchValue.split(/\s+/);
      return searchTerms.every((term: string) => searchableText.includes(term));
    };

    let filteredEvents = calendarEvents;

    if (searchValue) {
      filteredEvents = filteredEvents.filter(matchesSearch);
    } else if (selectedDate) {
      filteredEvents = filteredEvents.filter((e) => e.date === selectedDate);
    }

    return filteredEvents.sort((a, b) => {
      const now = Date.now();

      const aStart = new Date(a.start).getTime();
      const bStart = new Date(b.start).getTime();

      const aPast = aStart < now;
      const bPast = bStart < now;

      if (aPast !== bPast) {
        return aPast ? 1 : -1;
      }

      if (!aPast && !bPast) {
        return aStart - bStart;
      }

      return bStart - aStart;
    });
  }, [calendarEvents, selectedDate, search]);

  const totalPages = Math.ceil(rightPanelEvents.length / appointmentsPerPage);

  const paginatedEvents = useMemo(() => {
    const start = appointmentsPage * appointmentsPerPage;
    return rightPanelEvents.slice(start, start + appointmentsPerPage);
  }, [rightPanelEvents, appointmentsPage]);

  useEffect(() => {
    setAppointmentsPage(0);
  }, [search, selectedDate, currentMonth]);

  const monthCells = useMemo(() => buildMonthDays(currentMonth), [currentMonth]);

  const todayKey = formatDateKey(new Date());

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sbi-dark text-sbi-green">
        <div className="text-sm uppercase tracking-[0.1em]">
          <UrbanistWords text="Loading calendar..." />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sbi-dark px-6 py-6 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex items-center gap-3 rounded-[14px] border border-sbi-dark-border bg-sbi-dark-card px-4 py-2.5">
          <Search className="h-4 w-4 text-sbi-green" />

          <div className="flex-1">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events..."
              className="font-jetbrains-mono w-full bg-transparent text-sm text-white outline-none placeholder:text-white/40"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className={[
                "inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-xs tracking-[0.05em] transition",
                selectedDate
                  ? "border-sbi-dark-border bg-sbi-dark-card text-sbi-green hover:bg-sbi-green/5"
                  : "border-sbi-dark-border bg-sbi-dark-card text-white/60 hover:text-white/80",
              ].join(" ")}
            >
              <Filter className="h-3 w-3" />
              {selectedDate
                ? prettyDate(`${selectedDate}T00:00:00`)
                : "All Dates"}
            </button>
          </div>
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-[55%_45%]">
          <div className="overflow-hidden rounded-2xl border border-sbi-dark-border bg-sbi-dark-card">
            <div className="flex items-center justify-between border-b border-sbi-dark-border px-5 py-4">
              <div className="flex-1">
                <div className="flex items-center gap-2.5">
                  <CalendarDays className="h-4 w-4 text-sbi-green" />
                  <span className="text-lg font-medium uppercase tracking-[0.04em]">
                    <UrbanistWords
                      text={`${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`}
                    />
                  </span>
                </div>
              </div>

              <div className="flex gap-1">
                <NavButton onClick={goToPreviousMonth} ariaLabel="Previous month">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </NavButton>
                <NavButton onClick={goToNextMonth} ariaLabel="Next month">
                  <ChevronRight className="h-3.5 w-3.5" />
                </NavButton>
              </div>
            </div>

            <div className="grid grid-cols-7 border-b border-sbi-dark-border px-4">
              {dayNames.map((d) => (
                <div
                  key={d}
                  className="font-urbanist box-border py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-sbi-green/40"
                >
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {monthCells.map(({ date, inMonth }, i) => {
                const key = formatDateKey(date);
                const dayEvs = eventsByDate[key] ?? [];
                const isSelected = selectedDate === key;
                const isToday = key === todayKey;

                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() =>
                      setSelectedDate((prev) => (prev === key ? null : key))
                    }
                    className={[
                      "relative flex min-h-20 flex-col border-sbi-dark-border px-2 py-1.5 text-left transition",
                      i % 7 !== 6 ? "border-r" : "",
                      i < monthCells.length - 7 ? "border-b" : "",
                      isSelected
                        ? "bg-sbi-green/10"
                        : "bg-transparent hover:bg-white/5",
                    ].join(" ")}
                  >
                    {isToday && (
                      <div className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-sbi-green" />
                    )}

                    <span
                      className={[
                        "text-xs",
                        isToday ? "font-bold" : "font-normal",
                        !inMonth
                          ? "text-white/10"
                          : isSelected || isToday
                            ? "text-sbi-green"
                            : "text-white/60",
                      ].join(" ")}
                    >
                      {date.getDate()}
                    </span>

                    <div className="mt-1 flex flex-col gap-0.5">
                      {dayEvs.slice(0, 2).map((ev) => {
                        const past = isPastEvent(ev.end);

                        return (
                          <div
                            key={ev.id}
                            className={[
                              "max-w-full overflow-hidden text-ellipsis whitespace-nowrap rounded px-1 py-px text-[9px]",
                              past
                                ? "bg-zinc-700/20 text-zinc-600"
                                : "bg-sbi-green/10 text-sbi-green",
                            ].join(" ")}
                          >
                            <UrbanistWords text={ev.title} />
                          </div>
                        );
                      })}

                      {dayEvs.length > 2 && (
                        <div className="text-[9px] text-sbi-green/40">
                          +{dayEvs.length - 2} more
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-sbi-dark-border bg-sbi-dark-card">
            <div className="flex items-center justify-between border-b border-sbi-dark-border px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="text-lg font-medium uppercase tracking-[0.04em]">
                  <UrbanistWords
                    text={
                      selectedDate
                        ? prettyDate(`${selectedDate}T00:00:00`)
                        : "Appointments"
                    }
                  />
                </span>

                <span className="rounded-full border border-sbi-dark-border bg-sbi-green/10 px-2 py-0.5 text-[11px] font-semibold text-sbi-green">
                  {rightPanelEvents.length}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <span className="mr-1 text-[11px] text-white/20">
                  {appointmentsPage + 1} / {Math.max(totalPages, 1)}
                </span>

                <NavButton
                  onClick={() => setAppointmentsPage((p) => Math.max(0, p - 1))}
                  disabled={appointmentsPage === 0}
                  ariaLabel="Previous appointments page"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </NavButton>

                <NavButton
                  onClick={() =>
                    setAppointmentsPage((p) => Math.min(totalPages - 1, p + 1))
                  }
                  disabled={appointmentsPage >= totalPages - 1}
                  ariaLabel="Next appointments page"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </NavButton>
              </div>
            </div>

            <div className="grid w-full grid-cols-[1fr_auto] border-b border-sbi-dark-border">
              <div className="font-urbanist whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-sbi-green/40">
                Event
              </div>
              <div className="font-urbanist whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-sbi-green/40">
                Add To Calendar
              </div>
            </div>

            <div>
              {paginatedEvents.length === 0 ? (
                <div className="px-5 py-8 text-center text-[13px] text-white/20">
                  <div className="font-urbanist">
                    {selectedDate ? "No events for this date" : "No events found"}
                  </div>
                </div>
              ) : (
                paginatedEvents.map((ev) => {
                  const past = isPastEvent(ev.end);
                  const isToday = ev.date === todayKey;
                  const originalEvent = events.find((item) => item.id === ev.id);

                  const calendarSource = {
                    summary: originalEvent?.summary ?? ev.title ?? "Event",
                    start: originalEvent?.start ?? "",
                    end: originalEvent?.end ?? "",
                    location: originalEvent?.location ?? "",
                    description: originalEvent?.description ?? "",
                  };

                  const googleCalendarUrl =
                    buildGoogleCalendarUrl(calendarSource);
                  const icsUrl = buildIcsUrl(calendarSource);

                  return (
                    <div
                      key={ev.id}
                      className="mx-3 my-2.5 grid grid-cols-[1fr_auto] items-center gap-4 rounded-xl border border-sbi-dark-border bg-sbi-dark px-4 py-4 transition hover:border-sbi-green/40 hover:bg-sbi-green/5"
                    >
                      <div className="flex min-w-0 flex-col gap-2">
                        <div className="flex flex-col items-start gap-1.5">
                          <div
                            className={[
                              "min-w-0 text-sm font-semibold",
                              past ? "text-zinc-500" : "text-white",
                            ].join(" ")}
                          >
                            <UrbanistWords text={ev.title} />
                          </div>

                          <StatusBadge past={past} isToday={isToday} />
                        </div>

                        <div
                          className={[
                            "flex flex-col gap-1 text-xs",
                            past ? "text-zinc-600" : "text-white/50",
                          ].join(" ")}
                        >
                          <div>
                            <UrbanistWords
                              text={`${ev.prettyDate} • ${ev.time}${
                                ev.endTime ? ` – ${ev.endTime}` : ""
                              }`}
                            />
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Mail
                              className={[
                                "h-[13px] w-[13px]",
                                past ? "text-zinc-600" : "text-sbi-green",
                              ].join(" ")}
                            />
                            <span
                              className={past ? "text-zinc-600" : "text-white/60"}
                            >
                              <UrbanistWords text={ev.director} />
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-self-end gap-2">
                        <a
                          href={googleCalendarUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={[
                            "font-urbanist whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold tracking-[0.03em] no-underline transition",
                            past
                              ? "border-zinc-700 bg-zinc-700/30 text-zinc-600"
                              : "border-sbi-dark-border bg-sbi-green/10 text-sbi-green hover:bg-sbi-green/15",
                          ].join(" ")}
                        >
                          Google Calendar
                        </a>

                        <a
                          href={icsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={[
                            "font-urbanist whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold tracking-[0.03em] no-underline transition",
                            past
                              ? "border-zinc-800 bg-transparent text-zinc-500"
                              : "border-sbi-dark-border bg-transparent text-white/60 hover:bg-white/5",
                          ].join(" ")}
                        >
                          Add .ics
                        </a>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}