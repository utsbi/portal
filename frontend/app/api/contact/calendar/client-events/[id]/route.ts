import { NextResponse } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface UpdateEventBody {
  title?: string;
  description?: string | null;
  location?: string | null;
  startAt?: string;
  endAt?: string;
  allDay?: boolean;
}

/**
 * PATCH /api/contact/calendar/client-events/[id]
 * Update an event. RLS allows the event creator or a director on the
 * project to update; everyone else gets 0 rows updated (caught and turned
 * into a 404 here so the response is consistent).
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idRaw } = await params;
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }

  let body: UpdateEventBody;
  try {
    body = (await req.json()) as UpdateEventBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Build a typed update payload from the validated body fields. Cast to
  // Database["public"]["Tables"]["project_events"]["Update"] at the call site
  // so we keep the property-level checks here but the supabase-js client sees
  // a strictly-typed value.
  const update: {
    title?: string;
    description?: string | null;
    location?: string | null;
    start_at?: string;
    end_at?: string;
    all_day?: boolean;
  } = {};
  if (body.title !== undefined) {
    if (typeof body.title !== "string" || body.title.trim().length === 0) {
      return NextResponse.json(
        { error: "Title must be a non-empty string" },
        { status: 400 },
      );
    }
    update.title = body.title.trim();
  }
  if (body.description !== undefined) {
    update.description =
      body.description === null ? null : body.description?.trim() || null;
  }
  if (body.location !== undefined) {
    update.location =
      body.location === null ? null : body.location?.trim() || null;
  }
  if (body.startAt !== undefined) {
    const d = new Date(body.startAt);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json(
        { error: "startAt is not a valid date" },
        { status: 400 },
      );
    }
    update.start_at = d.toISOString();
  }
  if (body.endAt !== undefined) {
    const d = new Date(body.endAt);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json(
        { error: "endAt is not a valid date" },
        { status: 400 },
      );
    }
    update.end_at = d.toISOString();
  }
  if (body.allDay !== undefined) {
    update.all_day = !!body.allDay;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  // Cross-field validation: if both times are being updated, end must follow start.
  if (update.start_at && update.end_at) {
    if (
      new Date(update.end_at as string).getTime() <=
      new Date(update.start_at as string).getTime()
    ) {
      return NextResponse.json(
        { error: "endAt must be after startAt" },
        { status: 400 },
      );
    }
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
    .select("id, role")
    .eq("uid", user.id)
    .single();
  if (!callerProfile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const { data: event, error: fetchErr } = await supabaseAdmin
    .from("project_events")
    .select("id, project_id, created_by")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) {
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // RLS allows update if caller is creator or director. We re-check explicitly
  // so the response can distinguish 403 (not allowed) from 404 (not found).
  const isCreator = event.created_by === callerProfile.id;
  const isDirector = callerProfile.role === "director";
  if (!isCreator && !isDirector) {
    return NextResponse.json(
      { error: "You can't edit this event" },
      { status: 403 },
    );
  }

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from("project_events")
    .update(update as Database["public"]["Tables"]["project_events"]["Update"])
    .eq("id", id)
    .select(
      "id, project_id, title, description, location, start_at, end_at, all_day, created_by, updated_at",
    )
    .single();
  if (updateErr || !updated) {
    console.error("project_events update failed:", updateErr);
    return NextResponse.json(
      { error: "Couldn't update the event." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, event: updated });
}

/**
 * DELETE /api/contact/calendar/client-events/[id]
 * RLS gates this: event creator or a director on the project.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idRaw } = await params;
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
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
    .select("id, role")
    .eq("uid", user.id)
    .single();
  if (!callerProfile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const { data: event } = await supabaseAdmin
    .from("project_events")
    .select("id, project_id, created_by")
    .eq("id", id)
    .maybeSingle();
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const isCreator = event.created_by === callerProfile.id;
  const isDirector = callerProfile.role === "director";
  if (!isCreator && !isDirector) {
    return NextResponse.json(
      { error: "You can't delete this event" },
      { status: 403 },
    );
  }

  const { error: delErr } = await supabaseAdmin
    .from("project_events")
    .delete()
    .eq("id", id);
  if (delErr) {
    console.error("project_events delete failed:", delErr);
    return NextResponse.json(
      { error: "Couldn't delete the event." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
