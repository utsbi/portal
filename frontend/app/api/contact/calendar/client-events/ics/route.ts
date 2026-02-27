import { NextResponse } from "next/server";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// Converts ISO string to ICS UTC format: YYYYMMDDTHHMMSSZ
function toIcsUtc(dtIso: string) {
  const d = new Date(dtIso);
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function escapeIcs(text: string) {
  // basic escaping for ICS: \, ;, , and newlines
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const summary = searchParams.get("summary") ?? "SBI Event";
  const start = searchParams.get("start"); // ISO string required
  const end = searchParams.get("end");     // ISO string required
  const location = searchParams.get("location") ?? "";
  const description = searchParams.get("description") ?? "";

  if (!start || !end) {
    return NextResponse.json({ error: "Missing start or end" }, { status: 400 });
  }

  const uid = `${crypto.randomUUID()}@utsbi.org`;
  const dtstamp = toIcsUtc(new Date().toISOString());

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SBI Portal//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${toIcsUtc(start)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${escapeIcs(summary)}`,
    location ? `LOCATION:${escapeIcs(location)}` : null,
    description ? `DESCRIPTION:${escapeIcs(description)}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="sbi-event.ics"`,
    },
  });
}