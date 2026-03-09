"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Search, CalendarDays } from "lucide-react";
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
    const next = new Date(year, month + 1, cells.length - (startOffset + daysInMonth) + 1);
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
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isPastEvent(end?: string | null) {
  if (!end) return false;
  return new Date(end) < new Date();
}

export default function CalendarPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const goToPreviousMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

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

        if (!client?.id) {
          setLoading(false);
          return;
        }

        const res = await fetch(`/api/contact/calendar/client-events?client_id=${client.id}`);
        const json = await res.json();

        if (res.ok) {
          setEvents(json.events || []);
        }
      } catch (error) {
        console.error("Failed to load calendar events:", error);
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, []);

  const calendarEvents = useMemo(() => {
    return events.map((e) => ({
      id: e.id,
      title: e.summary ?? "Untitled Event",
      date: e.start?.split("T")[0] ?? "",
      prettyDate: prettyDate(e.start),
      time: safeTime(e.start),
      endTime: safeTime(e.end),
      director: e.organizer?.displayName ?? e.creator?.displayName ?? "SBI Director",
      department: "Meeting Name",
      start: e.start,
      end: e.end,
    }));
  }, [events]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};

    calendarEvents.forEach((ev) => {
      if (!ev.date) return;
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    });

    return map;
  }, [calendarEvents]);

  const filteredEvents = useMemo(() => {
    return calendarEvents.filter((ev) => {
      const searchMatch = ev.title.toLowerCase().includes(search.toLowerCase());
      const dateMatch = !selectedDate || ev.date === selectedDate;
      return searchMatch && dateMatch;
    });
  }, [calendarEvents, search, selectedDate]);

  const selectedEvents = useMemo(() => {
    return selectedDate
      ? filteredEvents.filter((e) => e.date === selectedDate)
      : filteredEvents;
  }, [filteredEvents, selectedDate]);

  const rightPanelEvents = useMemo(() => {
    const now = new Date();

    if (selectedDate) {
      return [...selectedEvents].sort(
        (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
      );
    }

    return calendarEvents
      .filter((ev) => {
        if (!ev.end) return false;
        return new Date(ev.end) >= now;
      })
      .filter((ev) => ev.title.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [calendarEvents, selectedEvents, selectedDate, search]);

  const monthCells = useMemo(() => buildMonthDays(currentMonth), [currentMonth]);

  if (loading) {
    return <div className="p-6 text-white">Loading calendar...</div>;
  }

  return (
    <div className="min-h-screen bg-[#020806] p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-3xl border border-emerald-900 bg-[#04110c]">
          <div className="flex gap-3 border-b border-emerald-900 p-4">
            <Search className="text-emerald-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events..."
              className="flex-1 bg-transparent outline-none"
            />
          </div>

          <div className="grid xl:grid-cols-[1.4fr_0.9fr]">
            <section className="border-r border-emerald-900 p-6">
              <div className="mb-4 flex items-center justify-between">
                <h1 className="text-2xl font-semibold">
                  {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </h1>
                <div className="flex items-center gap-3 text-xl font-semibold">
                  <button
                    type="button"
                    onClick={goToPreviousMonth}
                    className="px-2 text-emerald-200 transition hover:text-emerald-400"
                  >
                    {"<"}
                  </button>

                  <button
                    type="button"
                    onClick={goToNextMonth}
                    className="px-2 text-emerald-200 transition hover:text-emerald-400"
                  >
                    {">"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-emerald-900">
                {dayNames.map((d) => (
                  <div key={d} className="border-b border-emerald-900 py-2 text-center text-sm">
                    {d}
                  </div>
                ))}

                {monthCells.map(({ date, inMonth }, i) => {
                  const key = formatDateKey(date);
                  const dayEvents = eventsByDate[key] ?? [];

                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedDate((prev) => (prev === key ? null : key))}
                      className="flex min-h-[110px] flex-col border-b border-r border-emerald-900 p-2 text-left hover:bg-emerald-900/20"
                    >
                      <div className="flex items-start justify-between">
                        <span className={`text-sm font-medium ${inMonth ? "text-white" : "text-white/30"}`}>
                          {date.getDate()}
                        </span>
                      </div>

                      <div className="mt-1">
                        {dayEvents.slice(0, 2).map((ev) => {
                          const past = isPastEvent(ev.end);

                          return (
                            <div
                              key={ev.id}
                              className={`mt-1 truncate text-xs ${
                                past ? "text-zinc-500" : "text-emerald-300"
                              }`}
                            >
                              {ev.title}
                            </div>
                          );
                        })}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <aside className="p-6">
              <div className="mb-4 flex items-center gap-2">
                <CalendarDays />
                <h2 className="text-lg font-semibold">Appointments</h2>
              </div>

              <div className="space-y-3">
                {rightPanelEvents.map((ev) => {
                  const originalEvent = events.find((item) => item.id === ev.id);
                  const past = isPastEvent(ev.end);

                  const icsUrl =
                    `/api/contact/calendar/client-events/ics?` +
                    new URLSearchParams({
                      summary: originalEvent?.summary ?? ev.title ?? "SBI Event",
                      start: originalEvent?.start ?? "",
                      end: originalEvent?.end ?? "",
                      location: originalEvent?.location ?? "",
                      description: originalEvent?.description ?? "",
                    }).toString();

                  const googleCalendarUrl =
                    `https://calendar.google.com/calendar/render?action=TEMPLATE` +
                    `&text=${encodeURIComponent(originalEvent?.summary ?? ev.title ?? "SBI Event")}` +
                    `&dates=${formatGoogleDate(originalEvent?.start)}/${formatGoogleDate(
                      originalEvent?.end
                    )}` +
                    `&location=${encodeURIComponent(originalEvent?.location ?? "")}` +
                    `&details=${encodeURIComponent(originalEvent?.description ?? "")}`;

                  return (
                    <div
                      key={ev.id}
                      className={`rounded-2xl border p-4 transition ${
                        past
                          ? "border-zinc-800 bg-zinc-900/30 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-900/40"
                          : "border-emerald-900/40 bg-black/20 text-white hover:border-emerald-700/50 hover:bg-black/30"
                      }`}
                    >
                      <div className="mb-3">
                        <h3 className={past ? "font-medium text-zinc-300" : "font-medium text-white"}>
                          {ev.title}
                        </h3>
                        <p className={past ? "mt-1 text-sm text-zinc-500" : "mt-1 text-sm text-emerald-100/50"}>
                          {ev.department}
                        </p>
                      </div>

                      <div className="grid gap-3 text-sm sm:grid-cols-2">
                        <div>
                          <div
                            className={`text-[11px] uppercase tracking-[0.18em] ${
                              past ? "text-zinc-600" : "text-emerald-200/35"
                            }`}
                          >
                            Date
                          </div>
                          <div className={`mt-1 ${past ? "text-zinc-400" : "text-emerald-50/80"}`}>
                            {ev.prettyDate}
                          </div>
                        </div>

                        <div>
                          <div
                            className={`text-[11px] uppercase tracking-[0.18em] ${
                              past ? "text-zinc-600" : "text-emerald-200/35"
                            }`}
                          >
                            Time
                          </div>
                          <div className={`mt-1 ${past ? "text-zinc-400" : "text-emerald-50/80"}`}>
                            {ev.time} - {ev.endTime}
                          </div>
                        </div>

                        <div>
                          <div
                            className={`text-[11px] uppercase tracking-[0.18em] ${
                              past ? "text-zinc-600" : "text-emerald-200/35"
                            }`}
                          >
                            Director
                          </div>
                          <div className={`mt-1 ${past ? "text-zinc-400" : "text-emerald-50/80"}`}>
                            {ev.director}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <a
                          href={googleCalendarUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={`rounded-lg border px-3 py-2 text-sm transition ${
                            past
                              ? "border-zinc-700/40 bg-zinc-800/40 text-zinc-400 hover:bg-zinc-800/60"
                              : "border-emerald-700/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                          }`}
                        >
                          Add to Google Calendar
                        </a>

                        <a
                          href={icsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={`rounded-lg border px-3 py-2 text-sm transition ${
                            past
                              ? "border-zinc-700/40 bg-zinc-900/40 text-zinc-400 hover:bg-zinc-800/60"
                              : "border-emerald-700/40 bg-black/30 text-white hover:bg-black/50"
                          }`}
                        >
                          Download .ics
                        </a>
                      </div>
                    </div>
                  );
                })}

                {rightPanelEvents.length === 0 && (
                  <div className="text-sm opacity-50">
                    {selectedDate ? "No events for this date" : "No upcoming events"}
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}