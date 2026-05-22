export type CalendarView = "agenda" | "month";

export type AttendeeResponse =
  | "accepted"
  | "declined"
  | "tentative"
  | "needsAction";

export interface RawCalendarEvent {
  id: string | null;
  summary?: string | null;
  start?: string | null;
  end?: string | null;
  location?: string | null;
  description?: string | null;
  htmlLink?: string | null;
  organizerName?: string | null;
  organizerEmail?: string | null;
  creatorName?: string | null;
  creatorEmail?: string | null;
  myResponse?: AttendeeResponse | null;
  sourceCalendarId?: string | null;
}

export interface CalendarEvent {
  id: string;
  title: string;
  /** YYYY-MM-DD local date of the start */
  dateKey: string;
  prettyDate: string;
  startTime: string;
  endTime: string;
  organizer: string;
  organizerEmail: string | null;
  location: string | null;
  description: string | null;
  start: string | null;
  end: string | null;
  past: boolean;
  myResponse: AttendeeResponse;
  /** Needed for write-back endpoints like RSVP */
  calendarId: string | null;
}

export interface EventsResponse {
  ok: true;
  connected: boolean;
  events: RawCalendarEvent[];
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
