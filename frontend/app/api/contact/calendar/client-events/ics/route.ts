import { NextResponse } from "next/server";
import { buildEventIcs } from "@/lib/calendar/ics";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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
      updated_at,
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

  const ics = buildEventIcs({
    id: event.id,
    title: event.title,
    projectName: event.project?.company_name,
    description: event.description,
    location: event.location,
    startAt: event.start_at,
    endAt: event.end_at,
    allDay: event.all_day,
    versionAt: event.updated_at,
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="sbi-event-${event.id}.ics"`,
    },
  });
}
