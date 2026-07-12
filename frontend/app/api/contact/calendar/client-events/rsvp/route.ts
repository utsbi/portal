import { NextResponse } from "next/server";
import { sendRsvpNotification } from "@/lib/email/send";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_RESPONSES = ["accepted", "declined", "tentative"] as const;
type AllowedResponse = (typeof ALLOWED_RESPONSES)[number];

function isAllowedResponse(v: unknown): v is AllowedResponse {
  return (
    typeof v === "string" &&
    (ALLOWED_RESPONSES as readonly string[]).includes(v)
  );
}

/**
 * POST /api/contact/calendar/client-events/rsvp
 * Self-service RSVP. The caller's attendee row is updated in place; if no
 * row exists yet (e.g. a director added themselves by visiting the event
 * URL), the row is created with the chosen response. The responded_at
 * trigger stamps automatically.
 */
export async function POST(req: Request) {
  let body: { eventId?: number; response?: string };
  try {
    body = (await req.json()) as { eventId?: number; response?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { eventId, response } = body;
  if (
    typeof eventId !== "number" ||
    !Number.isInteger(eventId) ||
    eventId <= 0
  ) {
    return NextResponse.json({ error: "Invalid eventId" }, { status: 400 });
  }
  if (!isAllowedResponse(response)) {
    return NextResponse.json(
      { error: "response must be one of accepted, declined, tentative" },
      { status: 400 },
    );
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
  const { data: callerProfile, error: callerErr } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("uid", user.id)
    .single();
  if (callerErr || !callerProfile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Verify the event exists and the caller is a project member. RLS will
  // also enforce this on the UPDATE/INSERT below, but a clean pre-check
  // gives a useful error message.
  const { data: event } = await supabaseAdmin
    .from("project_events")
    .select("id, project_id")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const { data: membership } = await supabaseAdmin
    .from("project_members")
    .select("role")
    .eq("project_id", event.project_id)
    .eq("profile_id", callerProfile.id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json(
      { error: "You do not have access to this event" },
      { status: 403 },
    );
  }

  // Upsert the caller's attendee row. RLS permits INSERT for any project
  // member (scoped to events they can see) and UPDATE for self.
  const { error: upsertErr } = await supabaseAdmin
    .from("project_event_attendees")
    .upsert(
      {
        event_id: eventId,
        profile_id: callerProfile.id,
        response,
      },
      { onConflict: "event_id,profile_id" },
    );
  if (upsertErr) {
    console.error("project_event_attendees upsert failed:", upsertErr);
    return NextResponse.json(
      { error: "Couldn't save your response." },
      { status: 500 },
    );
  }

  // Fire-and-forget RSVP notification to the event organizer (best-effort).
  const [{ data: fullEvent }, { data: attendeeProfile }, { data: project }] =
    await Promise.all([
      supabaseAdmin
        .from("project_events")
        .select("title, start_at, created_by, project_id")
        .eq("id", eventId)
        .maybeSingle(),
      supabaseAdmin
        .from("profiles")
        .select("name")
        .eq("id", callerProfile.id)
        .maybeSingle(),
      supabaseAdmin
        .from("projects")
        .select("company_name")
        .eq("id", event.project_id)
        .maybeSingle(),
    ]);

  if (
    fullEvent &&
    attendeeProfile &&
    callerProfile.id !== fullEvent.created_by
  ) {
    const { data: organizer } = await supabaseAdmin
      .from("profiles")
      .select("name, email")
      .eq("id", fullEvent.created_by)
      .maybeSingle();

    if (organizer?.email) {
      const eventDate = new Date(fullEvent.start_at).toLocaleDateString(
        "en-US",
        {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        },
      );

      sendRsvpNotification({
        organizerEmail: organizer.email,
        organizerName: organizer.name,
        attendeeName: attendeeProfile.name,
        eventTitle: fullEvent.title,
        eventDate,
        response,
        projectName: project?.company_name ?? "SBI",
        eventId,
      });
    }
  }

  return NextResponse.json({ ok: true, response });
}
