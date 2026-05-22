import { createClient as createAdminClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function must(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = createAdminClient(
    must("NEXT_PUBLIC_SUPABASE_URL"),
    must("SUPABASE_SECRET_KEY"),
  );

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select("id, role, config")
    .eq("uid", user.id)
    .single();

  if (profileErr || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  if (profile.role !== "director") {
    return NextResponse.json({ error: "Not a director" }, { status: 403 });
  }

  const config = profile.config as any;
  const refreshToken = config?.google?.refresh_token;

  if (!refreshToken) {
    return NextResponse.json(
      { error: "No refresh token found" },
      { status: 400 },
    );
  }

  const oauth2 = new google.auth.OAuth2(
    must("GOOGLE_CLIENT_ID"),
    must("GOOGLE_CLIENT_SECRET"),
    must("GOOGLE_REDIRECT_URI"),
  );

  oauth2.setCredentials({
    refresh_token: refreshToken,
  });

  const calendar = google.calendar({ version: "v3", auth: oauth2 });
  const response = await calendar.calendarList.list();

  const calendars =
    response.data.items?.map((item) => ({
      id: item.id,
      summary: item.summary,
      primary: item.primary ?? false,
      accessRole: item.accessRole,
    })) ?? [];

  return NextResponse.json({ calendars });
}
