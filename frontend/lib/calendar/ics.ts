const CRLF = "\r\n";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function toIcsUtc(dateIso: string): string {
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date supplied to calendar export");
  }

  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    "T" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    "Z"
  );
}

export function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export interface IcsEvent {
  id: number;
  title: string;
  projectName?: string | null;
  description?: string | null;
  location?: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  /** Stable creation/update timestamp used for DTSTAMP and email idempotency. */
  versionAt: string;
  status?: "CONFIRMED" | "CANCELLED";
  method?: "PUBLISH" | "REQUEST" | "CANCEL";
}

/** A safe, readable filename for per-event calendar downloads. */
export function eventIcsFilename(
  event: Pick<IcsEvent, "title" | "startAt">,
): string {
  const date = new Date(event.startAt);
  const dateLabel = Number.isNaN(date.getTime())
    ? "event"
    : `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  const title = event.title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 72);
  return `sbi-${title || "event"}-${dateLabel}.ics`;
}

function toIcsDate(dateIso: string, allDay: boolean): string {
  if (!allDay) return toIcsUtc(dateIso);
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid all-day date supplied to calendar export");
  }
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate())
  );
}

export function buildEventIcs(event: IcsEvent): string {
  const summary = event.projectName
    ? `${event.projectName}: ${event.title}`
    : event.title;
  const method = event.method ?? "PUBLISH";
  const datePrefix = event.allDay ? ";VALUE=DATE" : "";

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SBI Portal//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:event-${event.id}@utsbi.org`,
    `DTSTAMP:${toIcsUtc(event.versionAt)}`,
    `DTSTART${datePrefix}:${toIcsDate(event.startAt, event.allDay)}`,
    `DTEND${datePrefix}:${toIcsDate(event.endAt, event.allDay)}`,
    `SUMMARY:${escapeIcs(summary)}`,
    event.location ? `LOCATION:${escapeIcs(event.location)}` : null,
    event.description ? `DESCRIPTION:${escapeIcs(event.description)}` : null,
    event.status ? `STATUS:${event.status}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter((line): line is string => line !== null)
    .join(CRLF);
}
