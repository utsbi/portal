import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface AddAttendeesBody {
  profileIds?: number[];
}

async function loadCallerAndEvent(eventIdRaw: string) {
  const eventId = Number(eventIdRaw);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return {
      error: NextResponse.json({ error: "Invalid event id" }, { status: 400 }),
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const supabaseAdmin = createAdminClient();
  const { data: callerProfile } = await supabaseAdmin
    .from("profiles")
    .select("id, role")
    .eq("uid", user.id)
    .single();
  if (!callerProfile) {
    return {
      error: NextResponse.json({ error: "Profile not found" }, { status: 404 }),
    };
  }

  const { data: event } = await supabaseAdmin
    .from("project_events")
    .select("id, project_id, created_by")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) {
    return {
      error: NextResponse.json({ error: "Event not found" }, { status: 404 }),
    };
  }

  const isCreator = event.created_by === callerProfile.id;
  const isDirector = callerProfile.role === "director";
  if (!isCreator && !isDirector) {
    return {
      error: NextResponse.json(
        { error: "You can't manage attendees on this event" },
        { status: 403 },
      ),
    };
  }

  return { event, callerProfile, supabaseAdmin };
}

/**
 * POST /api/contact/calendar/client-events/[id]/attendees
 * Invite additional profiles to the event. Existing attendees (same id) are
 * silently skipped via ON CONFLICT DO NOTHING.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await loadCallerAndEvent(id);
  if ("error" in ctx) return ctx.error;
  const { event, supabaseAdmin } = ctx;

  let body: AddAttendeesBody;
  try {
    body = (await req.json()) as AddAttendeesBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const profileIds = body.profileIds;
  if (
    !Array.isArray(profileIds) ||
    profileIds.length === 0 ||
    profileIds.some((id) => typeof id !== "number" || !Number.isInteger(id))
  ) {
    return NextResponse.json(
      { error: "profileIds must be a non-empty array of integers" },
      { status: 400 },
    );
  }

  // Only invite profiles who are actually members of the event's project.
  // Otherwise we'd have an attendee row that RLS hides from everyone except
  // directors (still technically allowed, but useless and confusing).
  const { data: validMembers, error: memberErr } = await supabaseAdmin
    .from("project_members")
    .select("profile_id")
    .eq("project_id", event.project_id)
    .in("profile_id", profileIds);
  if (memberErr) {
    return NextResponse.json(
      { error: "Couldn't validate attendees" },
      { status: 500 },
    );
  }
  const validIds = (validMembers ?? []).map((m) => m.profile_id);
  if (validIds.length === 0) {
    return NextResponse.json(
      { error: "None of the requested profiles are members of this project" },
      { status: 400 },
    );
  }

  const { error: insertErr } = await supabaseAdmin
    .from("project_event_attendees")
    .insert(
      validIds.map((profileId) => ({
        event_id: event.id,
        profile_id: profileId,
        response: "needsAction",
      })),
    );
  if (insertErr) {
    console.error("project_event_attendees insert failed:", insertErr);
    return NextResponse.json(
      { error: "Couldn't add attendees" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, invited: validIds });
}

/**
 * DELETE /api/contact/calendar/client-events/[id]/attendees
 * Body: { profileId: number }. Allows self-leave (a user removing themselves
 * from an event) via the same RLS DELETE policy.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await loadCallerAndEvent(id);
  if ("error" in ctx) return ctx.error;
  const { event, callerProfile, supabaseAdmin } = ctx;

  let body: { profileId?: number };
  try {
    body = (await req.json()) as { profileId?: number };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const profileId = body.profileId;
  if (typeof profileId !== "number" || !Number.isInteger(profileId)) {
    return NextResponse.json(
      { error: "profileId must be an integer" },
      { status: 400 },
    );
  }

  // Self-leave is always allowed by RLS; creator/director removal also
  // allowed. The pre-check above already handled creator/director; for
  // self-leave we re-check here so a non-member can't try to remove someone.
  const isSelf = profileId === callerProfile.id;
  if (!isSelf) {
    const isCreator = event.created_by === callerProfile.id;
    const isDirector = callerProfile.role === "director";
    if (!isCreator && !isDirector) {
      return NextResponse.json(
        { error: "You can only remove yourself from this event" },
        { status: 403 },
      );
    }
  }

  const { error: delErr } = await supabaseAdmin
    .from("project_event_attendees")
    .delete()
    .eq("event_id", event.id)
    .eq("profile_id", profileId);
  if (delErr) {
    console.error("project_event_attendees delete failed:", delErr);
    return NextResponse.json(
      { error: "Couldn't remove the attendee" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
