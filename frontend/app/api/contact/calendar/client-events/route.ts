import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

function must(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

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

    const directorId = must("DIRECTOR_CLIENT_ID");

    // 1) Load director token from clients.config.google
    const { data: director, error: directorErr } = await supabaseAdmin
      .from("clients")
      .select("config")
      .eq("id", directorId)
      .single();

    if (directorErr) return NextResponse.json({ error: directorErr.message }, { status: 500 });

    const refreshToken = (director?.config as any)?.google?.refresh_token as string | undefined;
    const calendarId =
      ((director?.config as any)?.google?.calendar_id as string | undefined) ?? "primary";

    if (!refreshToken) {
      return NextResponse.json(
        { error: "Director refresh_token not found at clients.config.google.refresh_token" },
        { status: 400 }
      );
    }

    // 2) Load requested client email (used to filter events)
    const { data: client, error: clientErr } = await supabaseAdmin
        .from("clients")
        .select("email")
        .eq("id", clientId)
        .single();

    if (clientErr) {
        return NextResponse.json({ error: clientErr.message }, { status: 500 });
    }
    if (!client?.email) {
        return NextResponse.json({ error: "Client email is missing" }, { status: 400 });
    }

    const clientEmail = String(client.email).toLowerCase();

    // 3) Call Google Calendar using director refresh token
    const oauth2 = new google.auth.OAuth2(
      must("GOOGLE_CLIENT_ID"),
      must("GOOGLE_CLIENT_SECRET"),
      must("GOOGLE_REDIRECT_URI")
    );

    oauth2.setCredentials({ refresh_token: refreshToken });

    const cal = google.calendar({ version: "v3", auth: oauth2 });

    const timeMin = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const timeMax = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString();

    const res = await cal.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 2500,
    });

    const items = res.data.items ?? [];

    // 4) Filter events where the client is an attendee
    const matched = items.filter((ev) => {
      const attendees = (ev.attendees ?? [])
        .map((a) => a.email?.toLowerCase())
        .filter(Boolean) as string[];
      return attendees.includes(clientEmail);
    });

    // 5) Return minimal payload
    const events = matched.map((ev) => ({
    id: ev.id,
    summary: ev.summary ?? "(No title)",
    start: ev.start?.dateTime ?? ev.start?.date ?? null,
    end: ev.end?.dateTime ?? ev.end?.date ?? null,
    location: ev.location ?? null,
    description: ev.description ?? null,
    htmlLink: ev.htmlLink ?? null,
    organizerName: ev.organizer?.displayName ?? null,
    organizerEmail: ev.organizer?.email ?? null,
    creatorEmail: ev.creator?.email ?? null,
  }));

    return NextResponse.json({ ok: true, client_email: client.email, calendarId, events });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Route crashed", message: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}