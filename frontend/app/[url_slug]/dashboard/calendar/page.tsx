"use client";

import React, { useMemo, useState, useEffect } from "react";
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
      <span
        className="font-urbanist"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "3px 10px",
          borderRadius: 999,
          border: "1px solid #1d4ed8",
          background: "rgba(29,78,216,0.12)",
          fontSize: 11,
          fontWeight: 600,
          color: "#60a5fa",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#60a5fa",
            display: "inline-block",
          }}
        />
        Today
      </span>
    );
  }

  if (past) {
    return (
      <span
        className="font-urbanist"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "3px 10px",
          borderRadius: 999,
          border: "1px solid #3f3f46",
          background: "rgba(63,63,70,0.2)",
          fontSize: 11,
          fontWeight: 600,
          color: "#71717a",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#71717a",
            display: "inline-block",
          }}
        />
        Past
      </span>
    );
  }

  return (
    <span
      className="font-urbanist"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 10px",
        borderRadius: 999,
        border: "1px solid #166534",
        background: "rgba(22,101,52,0.15)",
        fontSize: 11,
        fontWeight: 600,
        color: "#4ade80",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "#4ade80",
          display: "inline-block",
        }}
      />
      Upcoming
    </span>
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

        if (!client?.id) {
          setLoading(false);
          return;
        }

        const res = await fetch(
          `/api/contact/calendar/client-events?client_id=${client.id}`
        );
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
          director:
            e.creatorName ??
            e.creatorEmail ??
            "Unknown Organizer",
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
      return searchTerms.every((term) => searchableText.includes(term));
    };

    let filteredEvents = calendarEvents;

    if (searchValue) {
      filteredEvents = filteredEvents.filter(matchesSearch);
    } else if (selectedDate) {
      filteredEvents = filteredEvents.filter((e) => e.date === selectedDate);
    }

    return filteredEvents.sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    );
  }, [calendarEvents, selectedDate, search]);

  const totalPages = Math.ceil(rightPanelEvents.length / appointmentsPerPage);

  const paginatedEvents = useMemo(() => {
    const start = appointmentsPage * appointmentsPerPage;
    return rightPanelEvents.slice(start, start + appointmentsPerPage);
  }, [rightPanelEvents, appointmentsPage]);

  useEffect(() => {
    setAppointmentsPage(0);
  }, [search, selectedDate, currentMonth]);

  const monthCells = useMemo(
    () => buildMonthDays(currentMonth),
    [currentMonth]
  );

  const todayKey = formatDateKey(new Date());

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#020806",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            color: "#4ade80",
            fontSize: 14,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          <UrbanistWords text="Loading calendar..." />
        </div>
      </div>
    );
  }

  const colHeaderStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: "#4ade8066",
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    padding: "10px 16px",
    textAlign: "left",
    whiteSpace: "nowrap",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020806",
        padding: 24,
        color: "#fff",
        fontFamily: "'DM Mono', 'Fira Mono', monospace",
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 20,
            background: "#04110c",
            border: "1px solid #052e16",
            borderRadius: 14,
            padding: "10px 16px",
          }}
        >
          <Search size={16} color="#4ade80" />

          <div className="flex-1">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events..."
              className="w-full bg-transparent outline-none text-white text-sm"
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => setSelectedDate(null)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "#04110c",
                border: "1px solid #052e16",
                borderRadius: 8,
                padding: "6px 14px",
                color: selectedDate ? "#4ade80" : "#ffffff60",
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "inherit",
                letterSpacing: "0.05em",
                transition: "all 0.15s",
              }}
            >
              <Filter size={12} />
              {selectedDate
                ? prettyDate(selectedDate + "T00:00:00")
                : "All Dates"}
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "55% 45%",
            gap: 16,
            alignItems: "start",
          }}
        >
          <div
            style={{
              background: "#04110c",
              border: "1px solid #052e16",
              borderRadius: 16,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid #052e16",
              }}
            >
              <div className="flex-1">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <CalendarDays size={16} color="#4ade80" />
                  <span
                    style={{
                      fontSize: 18,
                      fontWeight: 500,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    <UrbanistWords
                      text={`${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`}
                    />
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 4 }}>
                <button
                  onClick={goToPreviousMonth}
                  aria-label="Previous month"
                  style={{
                    background: "transparent",
                    border: "1px solid #052e16",
                    borderRadius: 6,
                    width: 28,
                    height: 28,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#4ade80",
                    cursor: "pointer",
                  }}
                >
                  <ChevronLeft size={14} />
                </button>

                <button
                  onClick={goToNextMonth}
                  aria-label="Next month"
                  style={{
                    background: "transparent",
                    border: "1px solid #052e16",
                    borderRadius: 6,
                    width: 28,
                    height: 28,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#4ade80",
                    cursor: "pointer",
                  }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7,1fr)",
                borderBottom: "1px solid #052e16",
                padding: "0 16px",
                boxSizing: "border-box",
              }}
            >
              {dayNames.map((d) => (
                <div
                  key={d}
                  className="font-urbanist"
                  style={{
                    padding: "10px 0",
                    textAlign: "center",
                    fontSize: 10,
                    fontWeight: 600,
                    color: "#4ade8066",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    boxSizing: "border-box",
                  }}
                >
                  {d}
                </div>
              ))}
            </div>

            <div
              style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}
            >
              {monthCells.map(({ date, inMonth }, i) => {
                const key = formatDateKey(date);
                const dayEvs = eventsByDate[key] ?? [];
                const isSelected = selectedDate === key;
                const isToday = key === todayKey;

                return (
                  <button
                    key={i}
                    onClick={() =>
                      setSelectedDate((prev) => (prev === key ? null : key))
                    }
                    style={{
                      minHeight: 80,
                      display: "flex",
                      flexDirection: "column",
                      padding: "6px 8px",
                      textAlign: "left",
                      borderRight: "1px solid #052e16",
                      borderBottom: "1px solid #052e16",
                      background: isSelected
                        ? "rgba(74,222,128,0.08)"
                        : "transparent",
                      cursor: "pointer",
                      transition: "background 0.15s",
                      position: "relative",
                    }}
                  >
                    {isToday && (
                      <div
                        style={{
                          position: "absolute",
                          top: 5,
                          right: 5,
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: "#4ade80",
                        }}
                      />
                    )}

                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: isToday ? 700 : 400,
                        color: !inMonth
                          ? "#ffffff18"
                          : isSelected
                          ? "#4ade80"
                          : isToday
                          ? "#4ade80"
                          : "#ffffff99",
                      }}
                    >
                      {date.getDate()}
                    </span>

                    <div
                      style={{
                        marginTop: 4,
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                      }}
                    >
                      {dayEvs.slice(0, 2).map((ev) => (
                        <div
                          key={ev.id}
                          style={{
                            fontSize: 9,
                            color: isPastEvent(ev.end) ? "#3f3f46" : "#4ade80",
                            background: isPastEvent(ev.end)
                              ? "rgba(63,63,70,0.2)"
                              : "rgba(74,222,128,0.1)",
                            borderRadius: 3,
                            padding: "1px 4px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            maxWidth: "100%",
                          }}
                        >
                          <UrbanistWords text={ev.title} />
                        </div>
                      ))}

                      {dayEvs.length > 2 && (
                        <div style={{ fontSize: 9, color: "#4ade8066" }}>
                          +{dayEvs.length - 2} more
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div
            style={{
              background: "#04110c",
              border: "1px solid #052e16",
              borderRadius: 16,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid #052e16",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 500,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  <UrbanistWords
                    text={
                      selectedDate
                        ? prettyDate(selectedDate + "T00:00:00")
                        : "Appointments"
                    }
                  />
                </span>

                <span
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: 99,
                    background: "rgba(74,222,128,0.1)",
                    border: "1px solid #166534",
                    color: "#4ade80",
                    fontWeight: 600,
                  }}
                >
                  {rightPanelEvents.length}
                </span>
              </div>

              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <span
                  style={{
                    fontSize: 11,
                    color: "#ffffff30",
                    marginRight: 4,
                  }}
                >
                  {appointmentsPage + 1} / {Math.max(totalPages, 1)}
                </span>

                <button
                  onClick={() =>
                    setAppointmentsPage((p) => Math.max(0, p - 1))
                  }
                  disabled={appointmentsPage === 0}
                  aria-label="Previous appointments page"
                  style={{
                    background: "transparent",
                    border: "1px solid #052e16",
                    borderRadius: 6,
                    width: 28,
                    height: 28,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: appointmentsPage === 0 ? "#ffffff18" : "#4ade80",
                    cursor:
                      appointmentsPage === 0 ? "not-allowed" : "pointer",
                  }}
                >
                  <ChevronLeft size={14} />
                </button>

                <button
                  onClick={() =>
                    setAppointmentsPage((p) =>
                      Math.min(totalPages - 1, p + 1)
                    )
                  }
                  disabled={appointmentsPage >= totalPages - 1}
                  aria-label="Next appointments page"
                  style={{
                    background: "transparent",
                    border: "1px solid #052e16",
                    borderRadius: 6,
                    width: 28,
                    height: 28,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color:
                      appointmentsPage >= totalPages - 1
                        ? "#ffffff18"
                        : "#4ade80",
                    cursor:
                      appointmentsPage >= totalPages - 1
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                borderBottom: "1px solid #052e16",
                width: "100%",
              }}
            >
              <div className="font-urbanist" style={colHeaderStyle}>
                Event
              </div>
              <div className="font-urbanist" style={colHeaderStyle}>
                Add To Calendar
              </div>
            </div>

            <div>
              {paginatedEvents.length === 0 ? (
                <div
                  style={{
                    padding: "32px 20px",
                    textAlign: "center",
                    color: "#ffffff30",
                    fontSize: 13,
                  }}
                >
                  <div className="font-urbanist">
                    {selectedDate
                      ? "No events for this date"
                      : "No events found"}
                  </div>
                </div>
              ) : (
                paginatedEvents.map((ev) => {
                  const past = isPastEvent(ev.end);
                  const isToday = ev.date === todayKey;
                  const originalEvent = events.find(
                    (item) => item.id === ev.id
                  );

                  const googleCalendarUrl =
                    `https://calendar.google.com/calendar/render?action=TEMPLATE` +
                    `&text=${encodeURIComponent(
                      originalEvent?.summary ?? ev.title ?? "Event"
                    )}` +
                    `&dates=${formatGoogleDate(
                      originalEvent?.start
                    )}/${formatGoogleDate(originalEvent?.end)}` +
                    `&location=${encodeURIComponent(
                      originalEvent?.location ?? ""
                    )}` +
                    `&details=${encodeURIComponent(
                      originalEvent?.description ?? ""
                    )}`;

                  const icsUrl =
                    `/api/contact/calendar/client-events/ics?` +
                    new URLSearchParams({
                      summary: originalEvent?.summary ?? ev.title ?? "Event",
                      start: originalEvent?.start ?? "",
                      end: originalEvent?.end ?? "",
                      location: originalEvent?.location ?? "",
                      description: originalEvent?.description ?? "",
                    }).toString();

                  return (
                    <div
                      key={ev.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        alignItems: "center",
                        gap: 16,
                        padding: "16px",
                        margin: "10px 12px",
                        border: "1px solid #052e16",
                        borderRadius: 12,
                        background: "#03100b",
                        transition: "background 0.15s, border-color 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          "rgba(74,222,128,0.04)";
                        e.currentTarget.style.borderColor = "#166534";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "#03100b";
                        e.currentTarget.style.borderColor = "#052e16";
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-start",
                            gap: 6,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 600,
                              color: past ? "#71717a" : "#ffffff",
                              minWidth: 0,
                            }}
                          >
                            <UrbanistWords text={ev.title} />
                          </div>

                          <StatusBadge past={past} isToday={isToday} />
                        </div>

                        <div
                          style={{
                            fontSize: 12,
                            color: past ? "#52525b" : "#ffffff70",
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                          }}
                        >
                          <div>
                            <UrbanistWords
                              text={`${ev.prettyDate} • ${ev.time}${
                                ev.endTime ? ` – ${ev.endTime}` : ""
                              }`}
                            />
                          </div>

                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <Mail
                              size={13}
                              color={past ? "#52525b" : "#4ade80"}
                            />
                            <span
                              style={{
                                color: past ? "#52525b" : "#ffffff80",
                                wordBreak: "break-word",
                              }}
                            >
                              <UrbanistWords text={ev.director} />
                            </span>
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          justifySelf: "end",
                          flexWrap: "wrap",
                        }}
                      >
                        <a
                          href={googleCalendarUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-urbanist"
                          style={{
                            fontSize: 11,
                            color: past ? "#52525b" : "#4ade80",
                            textDecoration: "none",
                            border: `1px solid ${
                              past ? "#3f3f46" : "#166534"
                            }`,
                            background: past
                              ? "rgba(39,39,42,0.35)"
                              : "rgba(74,222,128,0.08)",
                            padding: "6px 10px",
                            borderRadius: 8,
                            fontWeight: 600,
                            letterSpacing: "0.03em",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Google Calendar
                        </a>

                        <a
                          href={icsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-urbanist"
                          style={{
                            fontSize: 11,
                            color: past ? "#71717a" : "#ffffff80",
                            textDecoration: "none",
                            border: "1px solid #052e16",
                            background: "transparent",
                            padding: "6px 10px",
                            borderRadius: 8,
                            fontWeight: 600,
                            letterSpacing: "0.03em",
                            whiteSpace: "nowrap",
                          }}
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