import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

function must(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

type GoogleEventItem = {
  id?: string | null;
  summary?: string | null;
  start?: { dateTime?: string | null; date?: string | null } | null;
  end?: { dateTime?: string | null; date?: string | null } | null;
  location?: string | null;
  description?: string | null;
  htmlLink?: string | null;
  organizer?: { displayName?: string | null; email?: string | null } | null;
  creator?: { displayName?: string | null; email?: string | null } | null;
  attendees?: Array<{ email?: string | null }> | null;
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("project_id");

    if (!projectId) {
      return NextResponse.json({ error: "Missing project_id" }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      must("NEXT_PUBLIC_SUPABASE_URL"),
      must("SUPABASE_SECRET_KEY")
    );

    // 1) Load the project to get company info
    const { data: project, error: projectErr } = await supabaseAdmin
      .from("projects")
      .select("id, url_slug, company_name")
      .eq("id", projectId)
      .single();

    if (projectErr || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // 2) Find all directors assigned to this project via project_members
    const { data: directorMembers, error: membersErr } = await supabaseAdmin
      .from("project_members")
      .select("profile_id")
      .eq("project_id", projectId)
      .eq("role", "director");

    if (membersErr) {
      return NextResponse.json({ error: membersErr.message }, { status: 500 });
    }

    const directorProfileIds = (directorMembers ?? []).map((m) => m.profile_id);

    if (directorProfileIds.length === 0) {
      return NextResponse.json({
        ok: true,
        events: [],
        message: "No directors linked to this project.",
      });
    }

    // 3) Load director profiles with their Google config
    const { data: directors, error: directorsErr } = await supabaseAdmin
      .from("profiles")
      .select("id, email, name, config")
      .in("id", directorProfileIds);

    if (directorsErr) {
      return NextResponse.json({ error: directorsErr.message }, { status: 500 });
    }

    // 4) Also get the client/owner email for attendee filtering
    const { data: ownerMember } = await supabaseAdmin
      .from("project_members")
      .select("profile_id, profiles(email)")
      .eq("project_id", projectId)
      .eq("role", "owner")
      .single();

    const clientEmail = (ownerMember?.profiles as any)?.email?.trim().toLowerCase() ?? "";

    const oauth2 = new google.auth.OAuth2(
      must("GOOGLE_CLIENT_ID"),
      must("GOOGLE_CLIENT_SECRET"),
      must("GOOGLE_REDIRECT_URI")
    );

    const timeMin = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const timeMax = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString();

    const allMatchedEvents: Array<{
      id: string | null;
      summary: string;
      start: string | null;
      end: string | null;
      location: string | null;
      description: string | null;
      htmlLink: string | null;
      organizerName: string | null;
      organizerEmail: string | null;
      creatorName: string | null;
      creatorEmail: string | null;
      sourceDirectorId: number | null;
      sourceDirectorEmail: string | null;
      sourceCalendarId: string | null;
    }> = [];

    // 5) Fetch events from each director's Google Calendar
    for (const director of directors ?? []) {
      const config = director.config as any;
      const refreshToken = config?.google?.refresh_token as string | undefined;
      const calendarId = config?.google?.calendar_id as string | undefined
        // Fallback: check old directors table for calendar_id
        || await getOldCalendarId(supabaseAdmin, director.email);

      if (!refreshToken || !calendarId) continue;

      oauth2.setCredentials({ refresh_token: refreshToken });
      const cal = google.calendar({ version: "v3", auth: oauth2 });

      const res = await cal.events.list({
        calendarId,
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 2500,
      });

      const items = (res.data.items ?? []) as GoogleEventItem[];

      // Filter events where the client is an attendee (skip if no client email)
      if (!clientEmail) continue;

      const matched = items.filter((ev) => {
        const attendees = (ev.attendees ?? [])
          .map((a) => a.email?.trim().toLowerCase())
          .filter(Boolean) as string[];
        return attendees.includes(clientEmail);
      });

      const normalized = matched.map((ev) => ({
        id: ev.id ?? null,
        summary: ev.summary ?? "(No title)",
        start: ev.start?.dateTime ?? ev.start?.date ?? null,
        end: ev.end?.dateTime ?? ev.end?.date ?? null,
        location: ev.location ?? null,
        description: ev.description ?? null,
        htmlLink: ev.htmlLink ?? null,
        organizerName: ev.organizer?.displayName ?? null,
        organizerEmail: ev.organizer?.email ?? null,
        creatorName: ev.creator?.displayName ?? null,
        creatorEmail: ev.creator?.email ?? null,
        sourceDirectorId: director.id ?? null,
        sourceDirectorEmail: director.email ?? null,
        sourceCalendarId: calendarId,
      }));

      allMatchedEvents.push(...normalized);
    }

    // 6) Deduplicate
    const dedupedMap = new Map<string, (typeof allMatchedEvents)[number]>();
    for (const ev of allMatchedEvents) {
      const key = ev.id ?? `${ev.summary}-${ev.start ?? "no-start"}-${ev.sourceCalendarId ?? "no-calendar"}`;
      if (!dedupedMap.has(key)) dedupedMap.set(key, ev);
    }

    const events = Array.from(dedupedMap.values()).sort((a, b) => {
      const aTime = a.start ? new Date(a.start).getTime() : 0;
      const bTime = b.start ? new Date(b.start).getTime() : 0;
      return aTime - bTime;
    });

    return NextResponse.json({ ok: true, events });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Route crashed", message: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}

// Temporary: fetch calendar_id from old directors table during migration
async function getOldCalendarId(supabase: any, email: string | null): Promise<string | undefined> {
  if (!email) return undefined;
  const { data } = await supabase
    .from("directors")
    .select("calendar_id")
    .eq("email", email)
    .single();
  return data?.calendar_id ?? undefined;
}
