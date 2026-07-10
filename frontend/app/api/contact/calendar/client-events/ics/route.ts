import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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

/**
 * GET /api/contact/calendar/client-events/ics?eventId=...
 * Per-event .ics download. Caller must be a project member of the event's
 * project (RLS via the underlying SELECT will also enforce this).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const eventIdRaw = searchParams.get("eventId");
  const eventId = Number(eventIdRaw);
  if (!eventIdRaw || !Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "Invalid eventId" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = createAdminClient();
  const { data: callerProfile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("uid", user.id)
    .single();
  if (!callerProfile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const { data: event } = await supabaseAdmin
    .from("project_events")
    .select(
      `
      id, title, description, location, start_at, end_at, all_day, project_id,
      project:projects!project_events_project_id_fkey ( company_name )
    `,
    )
    .eq("id", eventId)
    .maybeSingle();
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Explicit membership check (RLS also enforces on the SELECT above).
  const { data: membership } = await supabaseAdmin
    .from("project_members")
    .select("role")
    .eq("project_id", event.project_id)
    .eq("profile_id", callerProfile.id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const project = event.project;
  // Prefix the title with the project name so events in the phone's calendar
  // are self-explanatory when a user is on multiple projects.
  const summary = project?.company_name
    ? `${project.company_name} — ${event.title}`
    : event.title;

  const dtstamp = toIcsUtc(new Date().toISOString());
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SBI Portal//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:event-${event.id}@utsbi.org`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${toIcsUtc(event.start_at)}`,
    `DTEND:${toIcsUtc(event.end_at)}`,
    `SUMMARY:${escapeIcs(summary)}`,
    event.location ? `LOCATION:${escapeIcs(event.location)}` : null,
    event.description ? `DESCRIPTION:${escapeIcs(event.description)}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="sbi-event-${event.id}.ics"`,
    },
  });
}
