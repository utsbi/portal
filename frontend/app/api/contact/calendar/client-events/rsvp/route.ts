import { createClient as createAdminClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function must(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

const ALLOWED_RESPONSES = ["accepted", "declined", "tentative"] as const;
type AllowedResponse = (typeof ALLOWED_RESPONSES)[number];

function isAllowedResponse(v: unknown): v is AllowedResponse {
  return (
    typeof v === "string" &&
    (ALLOWED_RESPONSES as readonly string[]).includes(v)
  );
}

export async function POST(req: Request) {
  let body: {
    eventId?: string;
    calendarId?: string;
    projectId?: number;
    response?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { eventId, calendarId, projectId, response } = body;
  if (!eventId || !calendarId || !projectId || !isAllowedResponse(response)) {
    return NextResponse.json(
      {
        error: "Missing or invalid eventId, calendarId, projectId, or response",
      },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = createAdminClient(
    must("NEXT_PUBLIC_SUPABASE_URL"),
    must("SUPABASE_SECRET_KEY"),
  );

  // Resolve the caller's profile email (this is the attendee whose RSVP we're updating).
  const { data: callerProfile, error: callerErr } = await supabaseAdmin
    .from("profiles")
    .select("id, email")
    .eq("uid", authUser.id)
    .single();
  if (callerErr || !callerProfile?.email) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
  const callerEmail = callerProfile.email.trim().toLowerCase();

  // Confirm the caller is the project owner (only clients RSVP via portal).
  const { data: ownership } = await supabaseAdmin
    .from("project_members")
    .select("profile_id, role")
    .eq("project_id", projectId)
    .eq("profile_id", callerProfile.id)
    .eq("role", "owner")
    .maybeSingle();
  if (!ownership) {
    return NextResponse.json(
      { error: "Only project owners can RSVP via the portal" },
      { status: 403 },
    );
  }

  // Find a director on this project whose stored calendar_id matches.
  const { data: directorMembers } = await supabaseAdmin
    .from("project_members")
    .select("profile_id")
    .eq("project_id", projectId)
    .eq("role", "director");
  const directorIds = (directorMembers ?? []).map((m) => m.profile_id);
  if (directorIds.length === 0) {
    return NextResponse.json(
      { error: "No directors linked to this project" },
      { status: 404 },
    );
  }

  const { data: directors } = await supabaseAdmin
    .from("profiles")
    .select("id, config")
    .in("id", directorIds);

  const owningDirector = (directors ?? []).find((d) => {
    const cfg = (d.config ?? {}) as Record<string, unknown>;
    const g = (cfg.google ?? {}) as { calendar_id?: string };
    return g.calendar_id === calendarId;
  });

  if (!owningDirector) {
    return NextResponse.json(
      { error: "Calendar not connected for this project" },
      { status: 404 },
    );
  }

  const config = (owningDirector.config ?? {}) as Record<string, unknown>;
  const g = (config.google ?? {}) as { refresh_token?: string };
  const refreshToken = g.refresh_token;
  if (!refreshToken) {
    return NextResponse.json(
      { error: "Director's Google account is not connected" },
      { status: 404 },
    );
  }

  const oauth2 = new google.auth.OAuth2(
    must("GOOGLE_CLIENT_ID"),
    must("GOOGLE_CLIENT_SECRET"),
    must("GOOGLE_REDIRECT_URI"),
  );
  oauth2.setCredentials({ refresh_token: refreshToken });
  const cal = google.calendar({ version: "v3", auth: oauth2 });

  // events.patch needs the full attendees list, so GET first.
  const existing = await cal.events
    .get({ calendarId, eventId })
    .catch(() => null);
  if (!existing) {
    return NextResponse.json(
      { error: "Couldn't find the event in Google Calendar" },
      { status: 404 },
    );
  }

  const attendees = (existing.data.attendees ?? []).map((a) =>
    a.email?.trim().toLowerCase() === callerEmail
      ? { ...a, responseStatus: response }
      : a,
  );

  // Confirm the caller is actually on the attendees list.
  const wasOnList = attendees.some(
    (a) => a.email?.trim().toLowerCase() === callerEmail,
  );
  if (!wasOnList) {
    return NextResponse.json(
      { error: "You're not on the attendees list for this event" },
      { status: 403 },
    );
  }

  // Strip `self`/`organizer`/`resource` flags from existing attendees — they're
  // server-computed; sending them back can confuse Google's permission checks.
  const sanitizedAttendees = attendees.map((a) => {
    const { self: _self, organizer: _org, resource: _res, ...rest } = a as Record<string, unknown>;
    void _self;
    void _org;
    void _res;
    return rest;
  });

  try {
    await cal.events.patch({
      calendarId,
      eventId,
      requestBody: { attendees: sanitizedAttendees },
      sendUpdates: "none",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Google rejected RSVP update:", message, {
      calendarId,
      eventId,
      response,
      attendeeCount: sanitizedAttendees.length,
    });
    // Don't leak Google's raw message (can include calendar IDs / scope hints)
    // — keep server-side logs verbose, response body terse.
    return NextResponse.json(
      { error: "Couldn't save your RSVP. Please try again." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, response });
}
