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
  start?: {
    dateTime?: string | null;
    date?: string | null;
  } | null;
  end?: {
    dateTime?: string | null;
    date?: string | null;
  } | null;
  location?: string | null;
  description?: string | null;
  htmlLink?: string | null;
  organizer?: {
    displayName?: string | null;
    email?: string | null;
  } | null;
  creator?: {
    displayName?: string | null;
    email?: string | null;
  } | null;
  attendees?: Array<{
    email?: string | null;
  }> | null;
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("client_id");

    if (!clientId) {
      return NextResponse.json({ error: "Missing client_id" }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      must("NEXT_PUBLIC_SUPABASE_URL"),
      must("SUPABASE_SERVICE_ROLE_KEY")
    );

    // 1) Load requested client email
    const { data: client, error: clientErr } = await supabaseAdmin
      .from("clients")
      .select("id, email")
      .eq("id", clientId)
      .single();

    if (clientErr) {
      return NextResponse.json({ error: clientErr.message }, { status: 500 });
    }

    if (!client?.email) {
      return NextResponse.json({ error: "Client email is missing" }, { status: 400 });
    }

    const clientEmail = String(client.email).trim().toLowerCase();

    // 2) Find all linked directors for this client
    const { data: clientDirectorLinks, error: linksErr } = await supabaseAdmin
      .from("client_directors")
      .select("director_id")
      .eq("client_id", clientId);

    if (linksErr) {
      return NextResponse.json({ error: linksErr.message }, { status: 500 });
    }

    const directorIds = (clientDirectorLinks ?? [])
      .map((row) => row.director_id)
      .filter(Boolean);

    if (directorIds.length === 0) {
      return NextResponse.json({
        ok: true,
        client_email: client.email,
        events: [],
        message: "No directors linked to this client.",
      });
    }

    // 3) Load all linked directors
    const { data: directors, error: directorsErr } = await supabaseAdmin
      .from("directors")
      .select("id, email, name, config, calendar_id")
      .in("id", directorIds);

    if (directorsErr) {
      return NextResponse.json({ error: directorsErr.message }, { status: 500 });
    }

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

    // 4) Fetch events from each linked director calendar
    for (const director of directors ?? []) {
      const refreshToken = (director.config as any)?.google?.refresh_token as
        | string
        | undefined;

      const calendarId = director.calendar_id as string | null;

      if (!refreshToken || !calendarId) {
        continue;
      }

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

      // 5) Filter events where the client is an attendee
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

    // 6) Deduplicate in case the same event appears more than once
    const dedupedMap = new Map<string, (typeof allMatchedEvents)[number]>();

    for (const ev of allMatchedEvents) {
      const key =
        ev.id ??
        `${ev.summary}-${ev.start ?? "no-start"}-${ev.sourceCalendarId ?? "no-calendar"}`;

      if (!dedupedMap.has(key)) {
        dedupedMap.set(key, ev);
      }
    }

    const events = Array.from(dedupedMap.values()).sort((a, b) => {
      const aTime = a.start ? new Date(a.start).getTime() : 0;
      const bTime = b.start ? new Date(b.start).getTime() : 0;
      return aTime - bTime;
    });

    return NextResponse.json({
      ok: true,
      client_email: client.email,
      director_ids: directorIds,
      events,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Route crashed", message: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}