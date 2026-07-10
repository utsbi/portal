import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { feedTokenMatches } from "@/lib/calendar/feed-token";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

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
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function toIcsDateOnly(dtIso: string) {
  const d = new Date(dtIso);
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate())
  );
}

interface FeedEventRow {
  id: number;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  project: { company_name: string } | null;
}

/**
 * GET /api/contact/calendar/feed/[token]
 *
 * Per-user calendar feed for `webcal://` subscription. The token is the
 * only auth — it gates a single profile's view of the events they are a
 * member of. Returns a single VCALENDAR covering now-30d → now+365d so a
 * phone calendar app subscribes once and re-fetches on its own schedule.
 *
 * No session required.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token || token.length < 16) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();

  // Look up the profile by token hash. profiles.config is jsonb; we scan
  // candidates and compare in constant time. With ~thousands of profiles
  // this stays cheap; if the table grows large, add a generated column on
  // the hash and index it.
  const { data: candidates, error: lookupErr } = await supabaseAdmin
    .from("profiles")
    .select("id, name, email, config")
    .not("config", "is", null);
  if (lookupErr) {
    return NextResponse.json(
      { error: "Feed lookup failed" },
      { status: 500 },
    );
  }

  const matched = (candidates ?? []).find((p) => {
    const cfg = (p.config ?? {}) as {
      calendar_feed_token_hash?: string;
    };
    return (
      typeof cfg.calendar_feed_token_hash === "string" &&
      feedTokenMatches(token, cfg.calendar_feed_token_hash)
    );
  });
  if (!matched) {
    return NextResponse.json({ error: "Feed not found" }, { status: 404 });
  }

  // Pull all events on the matched profile's projects within the window.
  // RLS does not help here (we're using the service role); replicate the
  // membership check by joining project_members.
  const timeMin = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const timeMax = new Date(
    Date.now() + 365 * 24 * 3600 * 1000,
  ).toISOString();

  const { data: memberRows } = await supabaseAdmin
    .from("project_members")
    .select("project_id")
    .eq("profile_id", matched.id);
  const projectIds = (memberRows ?? []).map((m) => m.project_id);
  if (projectIds.length === 0) {
    return emptyIcs(matched.name);
  }

  const { data: events, error: eventsErr } = await supabaseAdmin
    .from("project_events")
    .select(
      `
      id, title, description, location, start_at, end_at, all_day,
      project:projects!project_events_project_id_fkey ( company_name )
    `,
    )
    .in("project_id", projectIds)
    .gte("start_at", timeMin)
    .lte("start_at", timeMax)
    .order("start_at", { ascending: true });
  if (eventsErr) {
    return NextResponse.json(
      { error: "Feed query failed" },
      { status: 500 },
    );
  }

  return new NextResponse(buildIcs(matched.name, (events ?? []) as FeedEventRow[]), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // NO Content-Disposition — calendar apps need the body to be a live
      // feed, not an attachment download.
      "Cache-Control": "private, max-age=300",
    },
  });
}

function buildIcs(calendarName: string, events: FeedEventRow[]): string {
  const dtstamp = toIcsUtc(new Date().toISOString());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SBI Portal//Calendar Feed//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
  ];
  for (const e of events) {
    const project = e.project?.company_name;
    const summary = project ? `${project} — ${e.title}` : e.title;
    const dtstart = e.all_day
      ? `DTSTART;VALUE=DATE:${toIcsDateOnly(e.start_at)}`
      : `DTSTART:${toIcsUtc(e.start_at)}`;
    const dtend = e.all_day
      ? `DTEND;VALUE=DATE:${toIcsDateOnly(e.end_at)}`
      : `DTEND:${toIcsUtc(e.end_at)}`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:event-${e.id}@utsbi.org`,
      `DTSTAMP:${dtstamp}`,
      dtstart,
      dtend,
      `SUMMARY:${escapeIcs(summary)}`,
      e.location ? `LOCATION:${escapeIcs(e.location)}` : "",
      e.description ? `DESCRIPTION:${escapeIcs(e.description)}` : "",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.filter(Boolean).join("\r\n");
}

function emptyIcs(calendarName: string): NextResponse {
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SBI Portal//Calendar Feed//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
    "END:VCALENDAR",
  ].join("\r\n");
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "private, max-age=300",
    },
  });
}
