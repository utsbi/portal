import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Read path for the project calendar.
 *
 * - Browser: Supabase session cookie.
 * - Explore backend tool: forwards the caller's JWT as `Authorization: Bearer <token>`.
 *
 * Returns all events for the given project within a rolling window
 * (now-7d → now+60d), the caller's per-event RSVP, and the organizer
 * profile id (so the UI can decide whether to show edit/delete affordances).
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectIdRaw = searchParams.get("project_id");
    const projectId = Number(projectIdRaw);
    if (!projectIdRaw || !Number.isInteger(projectId) || projectId <= 0) {
      return NextResponse.json(
        { error: "Missing or invalid project_id" },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const authHeader = req.headers.get("authorization");
    const bearer = authHeader?.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : null;
    const {
      data: { user },
      error: authError,
    } = bearer
      ? await supabase.auth.getUser(bearer)
      : await supabase.auth.getUser();
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

    // RLS on project_events already enforces project membership for the caller.
    // We do an explicit pre-check so a non-member gets a clean 403 (with a
    // helpful message) instead of a generic 0-row response.
    const { data: membership } = await supabaseAdmin
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("profile_id", callerProfile.id)
      .maybeSingle();
    if (!membership) {
      return NextResponse.json(
        { error: "You do not have access to this project" },
        { status: 403 },
      );
    }

    const timeMin = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const timeMax = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString();
    const callerId = callerProfile.id;

    // Two queries in parallel: events + the caller's attendee rows for the
    // same time window. The attendee query joins through project_events so the
    // time/project filter happens in one round-trip. Merge in memory by
    // (event_id, response) lookup.
    const [{ data: eventRows, error: eventsErr }, { data: myAttendeeRows }] =
      await Promise.all([
        supabaseAdmin
          .from("project_events")
          .select(
            `
            id, project_id, title, description, location,
            start_at, end_at, all_day, created_by, created_at, updated_at,
            organizer:profiles!project_events_created_by_fkey ( id, name )
          `,
          )
          .eq("project_id", projectId)
          .gte("start_at", timeMin)
          .lte("start_at", timeMax)
          .order("start_at", { ascending: true }),
        supabaseAdmin
          .from("project_event_attendees")
          .select(
            `
            event_id, response,
            event:project_events!project_event_attendees_event_id_fkey (
              project_id, start_at
            )
          `,
          )
          .eq("profile_id", callerId)
          .eq("event.project_id", projectId)
          .gte("event.start_at", timeMin)
          .lte("event.start_at", timeMax),
      ]);

    if (eventsErr) {
      console.error("project_events select failed:", eventsErr);
      return NextResponse.json(
        { error: "Couldn't load events." },
        { status: 500 },
      );
    }

    const myResponseByEvent = new Map<number, string>();
    for (const a of myAttendeeRows ?? []) {
      if (a.event) myResponseByEvent.set(a.event_id, a.response);
    }

    const events = (eventRows ?? []).map((r) => {
      const organizer = r.organizer as { id: number; name: string } | null;
      return {
        id: String(r.id),
        title: r.title,
        start: r.start_at,
        end: r.end_at,
        allDay: r.all_day,
        location: r.location,
        description: r.description,
        organizer: organizer?.name ?? "Unknown organizer",
        organizerId: organizer?.id ?? r.created_by,
        myResponse: (myResponseByEvent.get(r.id) ?? "needsAction") as
          | "accepted"
          | "declined"
          | "tentative"
          | "needsAction",
      };
    });

    return NextResponse.json({ ok: true, events });
  } catch (e: unknown) {
    console.error("client-events GET error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

interface CreateEventBody {
  projectId?: number;
  title?: string;
  description?: string | null;
  location?: string | null;
  startAt?: string;
  endAt?: string;
  allDay?: boolean;
  attendeeIds?: number[];
}

/**
 * Create a project event. The caller is recorded as `created_by` (RLS
 * enforces this — a member of project A cannot insert an event claiming
 * someone else created it). `attendeeIds` is the list of additional profile
 * ids to invite; the creator is auto-added as an attendee with
 * `response='accepted'`.
 */
export async function POST(req: Request) {
  let body: CreateEventBody;
  try {
    body = (await req.json()) as CreateEventBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    projectId,
    title,
    description = null,
    location = null,
    startAt,
    endAt,
    allDay = false,
    attendeeIds = [],
  } = body;

  if (
    typeof projectId !== "number" ||
    !Number.isInteger(projectId) ||
    projectId <= 0
  ) {
    return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
  }
  if (typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (typeof startAt !== "string" || typeof endAt !== "string") {
    return NextResponse.json(
      { error: "startAt and endAt are required ISO strings" },
      { status: 400 },
    );
  }
  const startDate = new Date(startAt);
  const endDate = new Date(endAt);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return NextResponse.json(
      { error: "startAt/endAt are not valid dates" },
      { status: 400 },
    );
  }
  if (endDate.getTime() <= startDate.getTime()) {
    return NextResponse.json(
      { error: "endAt must be after startAt" },
      { status: 400 },
    );
  }
  if (
    !Array.isArray(attendeeIds) ||
    attendeeIds.some((id) => typeof id !== "number" || !Number.isInteger(id))
  ) {
    return NextResponse.json(
      { error: "attendeeIds must be an array of integers" },
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

  // Explicit membership check so a non-member gets a clean 403.
  const { data: membership } = await supabaseAdmin
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("profile_id", callerProfile.id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json(
      { error: "You do not have access to this project" },
      { status: 403 },
    );
  }

  // Insert the event. RLS (WITH CHECK) forces created_by = caller.
  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from("project_events")
    .insert({
      project_id: projectId,
      title: title.trim(),
      description: description?.trim() || null,
      location: location?.trim() || null,
      start_at: startDate.toISOString(),
      end_at: endDate.toISOString(),
      all_day: !!allDay,
      created_by: callerProfile.id,
    })
    .select("id, created_at")
    .single();
  if (insertErr || !inserted) {
    console.error("project_events insert failed:", insertErr);
    return NextResponse.json(
      { error: "Couldn't create the event." },
      { status: 500 },
    );
  }

  // Build the attendee rows: creator auto-accepted + any explicit invites
  // (de-duplicated, excluding the creator).
  const explicitIds = new Set(
    attendeeIds.filter((id) => id !== callerProfile.id),
  );
  const attendeeRows = [
    {
      event_id: inserted.id,
      profile_id: callerProfile.id,
      response: "accepted",
    },
    ...Array.from(explicitIds).map((profileId) => ({
      event_id: inserted.id,
      profile_id: profileId,
      response: "needsAction",
    })),
  ];

  if (attendeeRows.length > 0) {
    const { error: attErr } = await supabaseAdmin
      .from("project_event_attendees")
      .insert(attendeeRows);
    if (attErr) {
      // The event row was already created. Log and continue — the creator
      // can re-invite from the UI. Don't fail the whole create.
      console.error("project_event_attendees insert failed:", attErr);
    }
  }

  return NextResponse.json({
    ok: true,
    event: { id: String(inserted.id), createdAt: inserted.created_at },
  });
}
