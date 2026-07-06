import { google } from "googleapis";
import { NextResponse } from "next/server";
import { decryptToken } from "@/lib/crypto/tokens";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

function must(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

type AttendeeResponse =
  | "accepted"
  | "declined"
  | "tentative"
  | "needsAction"
  | null;

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
  attendees?: Array<{
    email?: string | null;
    responseStatus?: string | null;
  }> | null;
};

type DirectorConfig = {
  refresh_token?: string;
  calendar_id?: string;
  [k: string]: unknown;
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("project_id");

    if (!projectId) {
      return NextResponse.json(
        { error: "Missing project_id" },
        { status: 400 },
      );
    }
    const projectIdNum = Number(projectId);
    if (!Number.isInteger(projectIdNum) || projectIdNum <= 0) {
      return NextResponse.json(
        { error: "Invalid project_id" },
        { status: 400 },
      );
    }

    // --- Auth + authorization gate -----------------------------------------
    // This endpoint builds a service-role client below, which bypasses RLS.
    // Require an authenticated caller and verify they actually belong to the
    // requested project BEFORE reading any calendar PII.
    //
    // Two caller shapes are supported:
    //   • the browser, via the Supabase session cookie, and
    //   • the Explore backend tool, which forwards the caller's JWT as
    //     `Authorization: Bearer <token>` (no cookies server-to-server).
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

    // Resolve the caller's profile.
    const { data: callerProfile, error: callerErr } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("uid", user.id)
      .single();
    if (callerErr || !callerProfile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Verify the caller is a member of the requested project. Any role is
    // allowed: a client sees their own project meetings, a director sees the
    // client's — both filtered to the owner's email below. Never trust the
    // project_id query param on its own.
    const { data: membership } = await supabaseAdmin
      .from("project_members")
      .select("role")
      .eq("project_id", projectIdNum)
      .eq("profile_id", callerProfile.id)
      .maybeSingle();
    if (!membership) {
      return NextResponse.json(
        { error: "You do not have access to this project" },
        { status: 403 },
      );
    }

    const { data: project, error: projectErr } = await supabaseAdmin
      .from("projects")
      .select("id, url_slug, company_name")
      .eq("id", projectIdNum)
      .single();

    if (projectErr || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { data: directorMembers, error: membersErr } = await supabaseAdmin
      .from("project_members")
      .select("profile_id")
      .eq("project_id", projectIdNum)
      .eq("role", "director");

    if (membersErr) {
      return NextResponse.json({ error: membersErr.message }, { status: 500 });
    }

    const directorProfileIds = (directorMembers ?? []).map((m) => m.profile_id);

    if (directorProfileIds.length === 0) {
      return NextResponse.json({ ok: true, connected: false, events: [] });
    }

    const { data: directors, error: directorsErr } = await supabaseAdmin
      .from("profiles")
      .select("id, email, name, config")
      .in("id", directorProfileIds);

    if (directorsErr) {
      return NextResponse.json(
        { error: directorsErr.message },
        { status: 500 },
      );
    }

    // Disambiguate the join: project_members has two FKs to profiles
    // (profile_id and assigned_by); without the explicit constraint name
    // PostgREST refuses the embed.
    const { data: ownerMember } = await supabaseAdmin
      .from("project_members")
      .select("profile_id, profiles!project_members_profile_id_fkey(email)")
      .eq("project_id", projectIdNum)
      .eq("role", "owner")
      .single();

    const clientEmail =
      (ownerMember?.profiles as { email?: string } | null)?.email
        ?.trim()
        .toLowerCase() ?? "";

    const oauth2 = new google.auth.OAuth2(
      must("GOOGLE_CLIENT_ID"),
      must("GOOGLE_CLIENT_SECRET"),
      must("GOOGLE_REDIRECT_URI"),
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
      myResponse: AttendeeResponse;
      sourceDirectorId: number | null;
      sourceDirectorEmail: string | null;
      sourceCalendarId: string | null;
    }> = [];

    let connectedCount = 0;
    const syncedAt = new Date().toISOString();

    for (const director of directors ?? []) {
      const config = (director.config ?? {}) as Record<string, unknown>;
      const google_ = (config.google ?? {}) as DirectorConfig;
      const rawRefreshToken = google_.refresh_token;
      const calendarId = google_.calendar_id;

      if (!rawRefreshToken || !calendarId) continue;
      connectedCount += 1;

      try {
        const refreshToken = decryptToken(rawRefreshToken);
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

        if (clientEmail) {
          const matched = items
            .map((ev) => {
              const clientAttendee = (ev.attendees ?? []).find(
                (a) => a.email?.trim().toLowerCase() === clientEmail,
              );
              return { ev, clientAttendee };
            })
            .filter(
              (
                m,
              ): m is {
                ev: GoogleEventItem;
                clientAttendee: NonNullable<typeof m.clientAttendee>;
              } => m.clientAttendee !== undefined,
            );

          const normalized = matched.map(({ ev, clientAttendee }) => ({
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
            myResponse: (clientAttendee.responseStatus ??
              null) as AttendeeResponse,
            sourceDirectorId: director.id ?? null,
            sourceDirectorEmail: director.email ?? null,
            sourceCalendarId: calendarId,
          }));

          allMatchedEvents.push(...normalized);
        }

        // Best-effort, fire-and-forget. Awaiting here adds N round-trips of
        // latency to every calendar pageview for a multi-director project,
        // and a failed metadata write must not block the user-facing fetch.
        void supabaseAdmin
          .from("profiles")
          .update({
            config: {
              ...config,
              google: { ...google_, last_synced_at: syncedAt },
            } as unknown as Json,
          })
          .eq("id", director.id)
          .then((res) => {
            if (res.error) {
              console.error(
                `Failed to update last_synced_at for director ${director.id}:`,
                res.error.message,
              );
            }
          });
      } catch (err) {
        console.error(
          `Google Calendar fetch failed for director ${director.id}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    const dedupedMap = new Map<string, (typeof allMatchedEvents)[number]>();
    for (const ev of allMatchedEvents) {
      const key =
        ev.id ??
        `${ev.summary}-${ev.start ?? "no-start"}-${ev.sourceCalendarId ?? "no-calendar"}`;
      if (!dedupedMap.has(key)) dedupedMap.set(key, ev);
    }

    let events = Array.from(dedupedMap.values()).sort((a, b) => {
      const aTime = a.start ? new Date(a.start).getTime() : 0;
      const bTime = b.start ? new Date(b.start).getTime() : 0;
      return aTime - bTime;
    });

    // Resolve unresolved organizer/creator emails to profile names so the UI
    // never shows raw email addresses.
    const emailsToResolve = new Set<string>();
    for (const ev of events) {
      if (!ev.creatorName && ev.creatorEmail)
        emailsToResolve.add(ev.creatorEmail.toLowerCase());
      if (!ev.organizerName && ev.organizerEmail)
        emailsToResolve.add(ev.organizerEmail.toLowerCase());
    }

    if (emailsToResolve.size > 0) {
      const { data: profilesByEmail } = await supabaseAdmin
        .from("profiles")
        .select("email, name")
        .in("email", Array.from(emailsToResolve));

      const nameByEmail = new Map<string, string>();
      for (const p of profilesByEmail ?? []) {
        if (p.email && p.name) nameByEmail.set(p.email.toLowerCase(), p.name);
      }

      events = events.map((ev) => {
        const resolveName = (
          existingName: string | null,
          email: string | null,
        ): string | null => {
          if (existingName) return existingName;
          if (!email) return null;
          const matched = nameByEmail.get(email.toLowerCase());
          if (matched) return matched;
          const localPart = email.split("@")[0];
          return localPart || null;
        };

        return {
          ...ev,
          creatorName: resolveName(ev.creatorName, ev.creatorEmail),
          organizerName: resolveName(ev.organizerName, ev.organizerEmail),
        };
      });
    }

    return NextResponse.json({
      ok: true,
      connected: connectedCount > 0,
      events,
    });
  } catch (e: unknown) {
    console.error("client-events route error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
