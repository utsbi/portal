import type {
  AgendaBucket,
  AgendaBucketId,
  CalendarEvent,
  EventsResponse,
} from "./types";

export const monthNames = [
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
] as const;

export const monthShortNames = monthNames.map((m) => m.slice(0, 3));

export const dayNames = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

export const CALENDAR_EVENTS_API = "/api/contact/calendar/client-events";
export const CALENDAR_ICS_API = "/api/contact/calendar/client-events/ics";
export const GOOGLE_CALENDAR_RENDER_URL =
  "https://calendar.google.com/calendar/render";

// ---------------------------------------------------------------------------
// Date math
// ---------------------------------------------------------------------------

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Days from `from` (start-of-day) to `to` (start-of-day) — can be negative. */
export function diffDays(from: Date, to: Date): number {
  const a = startOfDay(from).getTime();
  const b = startOfDay(to).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

/** Sunday-anchored start of the week containing `date`. */
export function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export function buildMonthDays(
  currentMonth: Date,
): Array<{ date: Date; inMonth: boolean }> {
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
      cells.length - (startOffset + daysInMonth) + 1,
    );
    cells.push({ date: next, inMonth: false });
  }

  return cells;
}

// ---------------------------------------------------------------------------
// Display formatting
// ---------------------------------------------------------------------------

export function safeTime(dateString?: string | null): string {
  if (!dateString) return "";
  return new Date(dateString).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function prettyDate(dateString?: string | null): string {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function prettyDateNoYear(date: Date): string {
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function prettyWeekday(date: Date): string {
  return date.toLocaleDateString([], { weekday: "long" });
}

export function isPastEvent(end?: string | null): boolean {
  if (!end) return false;
  return new Date(end) < new Date();
}

/** "In 2h", "In 35m", "In 3d" — only meant for the next-up Today pill. */
export function relativeUntil(
  start: string | null,
  now: Date = new Date(),
): string | null {
  if (!start) return null;
  const ms = new Date(start).getTime() - now.getTime();
  if (ms <= 0) return "Now";
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `In ${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `In ${hours}h`;
  const days = Math.round(hours / 24);
  return `In ${days}d`;
}

// ---------------------------------------------------------------------------
// URL builders
// ---------------------------------------------------------------------------

function formatGoogleDate(dateString?: string | null): string {
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

export function buildInternalUrl(
  pathname: string,
  params?: Record<string, string>,
): string {
  const searchParams = new URLSearchParams(params);
  return searchParams.toString()
    ? `${pathname}?${searchParams.toString()}`
    : pathname;
}

export interface CalendarEventSource {
  id: string;
  title: string;
  start: string;
  end: string;
  location: string | null;
  description: string | null;
}

export function buildGoogleCalendarUrl(event: CalendarEventSource): string {
  const url = new URL(GOOGLE_CALENDAR_RENDER_URL);
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", event.title);
  url.searchParams.set(
    "dates",
    `${formatGoogleDate(event.start)}/${formatGoogleDate(event.end)}`,
  );
  url.searchParams.set("location", event.location ?? "");
  url.searchParams.set("details", event.description ?? "");
  return url.toString();
}

export function buildIcsUrl(event: CalendarEventSource): string {
  return buildInternalUrl(CALENDAR_ICS_API, {
    eventId: event.id,
  });
}

// ---------------------------------------------------------------------------
// Event normalization + bucketing
// ---------------------------------------------------------------------------

/**
 * Google all-day events used to return start.date in YYYY-MM-DD form (no
 * timezone). Parsing that with `new Date(str)` made it UTC midnight, which
 * in a negative-UTC timezone shifted to the previous calendar day locally —
 * which would bucket "today" all-day events into "yesterday". The native
 * table now stores start_at/end_at as timestamptz, so the all-day case no
 * longer needs this — but we keep the local-midnight construction for any
 * legacy or external data that's still date-only.
 */
function parseEventStart(startStr: string | null): Date | null {
  if (!startStr) return null;
  const dateOnly = startStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  return new Date(startStr);
}

export function normalizeEvent(
  raw: EventsResponse["events"][number],
): CalendarEvent {
  const startStr = raw.start;
  const endStr = raw.end;
  const startDate = parseEventStart(startStr);
  return {
    id: raw.id,
    title: raw.title,
    dateKey: startDate ? formatDateKey(startDate) : "",
    prettyDate: prettyDate(startStr),
    startTime: safeTime(startStr),
    endTime: safeTime(endStr),
    start: startStr,
    end: endStr,
    allDay: raw.allDay,
    organizer: raw.organizer,
    organizerId: raw.organizerId,
    location: raw.location,
    description: raw.description,
    past: isPastEvent(endStr),
    myResponse: raw.myResponse,
  };
}

function rangeLabel(start: Date, end: Date): string {
  const sameMonth = start.getMonth() === end.getMonth();
  const left = prettyDateNoYear(start);
  const right = sameMonth ? String(end.getDate()) : prettyDateNoYear(end);
  return start.getTime() === end.getTime()
    ? prettyDateNoYear(start)
    : `${left} – ${right}`;
}

/**
 * Bucket events relative to `now`. Six buckets — empty buckets are dropped by
 * the caller (component renders only non-empty ones).
 *
 * - today: events whose start date is today
 * - tomorrow: start date is tomorrow
 * - thisWeek: rest of this Sun-Sat week (excluding today/tomorrow)
 * - nextWeek: the following Sun-Sat week
 * - later: anything beyond next week's Saturday
 * - past: end < now
 */
export function bucketEvents(
  events: CalendarEvent[],
  now: Date = new Date(),
): AgendaBucket[] {
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const thisWeekEnd = addDays(startOfWeek(today), 7); // exclusive
  const nextWeekStart = thisWeekEnd;
  const nextWeekEnd = addDays(nextWeekStart, 7); // exclusive

  const groups: Record<AgendaBucketId, CalendarEvent[]> = {
    today: [],
    tomorrow: [],
    thisWeek: [],
    nextWeek: [],
    later: [],
    past: [],
  };

  for (const ev of events) {
    if (ev.past) {
      groups.past.push(ev);
      continue;
    }
    if (!ev.start) {
      groups.later.push(ev);
      continue;
    }
    const startDay = startOfDay(new Date(ev.start));
    if (startDay.getTime() === today.getTime()) groups.today.push(ev);
    else if (startDay.getTime() === tomorrow.getTime())
      groups.tomorrow.push(ev);
    else if (startDay > tomorrow && startDay < thisWeekEnd)
      groups.thisWeek.push(ev);
    else if (startDay >= nextWeekStart && startDay < nextWeekEnd)
      groups.nextWeek.push(ev);
    else groups.later.push(ev);
  }

  // Within each future bucket, ascending by start. Past: descending (most recent first).
  const byAscending = (a: CalendarEvent, b: CalendarEvent) =>
    (a.start ? new Date(a.start).getTime() : 0) -
    (b.start ? new Date(b.start).getTime() : 0);
  const byDescending = (a: CalendarEvent, b: CalendarEvent) =>
    (b.start ? new Date(b.start).getTime() : 0) -
    (a.start ? new Date(a.start).getTime() : 0);

  groups.today.sort(byAscending);
  groups.tomorrow.sort(byAscending);
  groups.thisWeek.sort(byAscending);
  groups.nextWeek.sort(byAscending);
  groups.later.sort(byAscending);
  groups.past.sort(byDescending);

  return [
    {
      id: "today",
      label: "Today",
      rangeLabel: prettyDateNoYear(today),
      events: groups.today,
    },
    {
      id: "tomorrow",
      label: "Tomorrow",
      rangeLabel: prettyDateNoYear(tomorrow),
      events: groups.tomorrow,
    },
    {
      id: "thisWeek",
      label: "This week",
      rangeLabel:
        groups.thisWeek.length > 0
          ? rangeLabel(addDays(tomorrow, 1), addDays(thisWeekEnd, -1))
          : null,
      events: groups.thisWeek,
    },
    {
      id: "nextWeek",
      label: "Next week",
      rangeLabel: rangeLabel(nextWeekStart, addDays(nextWeekEnd, -1)),
      events: groups.nextWeek,
    },
    {
      id: "later",
      label: "Later",
      rangeLabel: null,
      events: groups.later,
    },
    {
      id: "past",
      label: "Past",
      rangeLabel: null,
      events: groups.past,
    },
  ];
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export function eventMatchesSearch(ev: CalendarEvent, search: string): boolean {
  const q = search.toLowerCase().trim();
  if (!q) return true;
  const haystack = [
    ev.title,
    ev.prettyDate,
    ev.startTime,
    ev.endTime,
    ev.organizer,
    ev.location ?? "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return q.split(/\s+/).every((term) => haystack.includes(term));
}
