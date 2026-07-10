export type CalendarView = "agenda" | "month";

export type AttendeeResponse =
  | "accepted"
  | "declined"
  | "tentative"
  | "needsAction";

/**
 * Calendar event as the UI consumes it. The shape matches the GET response
 * from /api/contact/calendar/client-events — we don't need the raw Google
 * fields anymore, so there's no separate `RawCalendarEvent` type.
 */
export interface CalendarEvent {
  id: string;
  title: string;
  /** YYYY-MM-DD local date of the start */
  dateKey: string;
  prettyDate: string;
  startTime: string;
  endTime: string;
  start: string | null;
  end: string | null;
  allDay: boolean;
  organizer: string;
  organizerId: number;
  location: string | null;
  description: string | null;
  past: boolean;
  myResponse: AttendeeResponse;
}

export interface EventsResponse {
  ok: true;
  events: Array<{
    id: string;
    title: string;
    start: string;
    end: string;
    allDay: boolean;
    location: string | null;
    description: string | null;
    organizer: string;
    organizerId: number;
    myResponse: AttendeeResponse;
  }>;
}

export type AgendaBucketId =
  | "today"
  | "tomorrow"
  | "thisWeek"
  | "nextWeek"
  | "later"
  | "past";

export interface AgendaBucket {
  id: AgendaBucketId;
  label: string;
  rangeLabel: string | null;
  events: CalendarEvent[];
}
