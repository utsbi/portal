import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

function must(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function GET() {
  const supabaseAdmin = createClient(
    must("NEXT_PUBLIC_SUPABASE_URL"),
    must("SUPABASE_SECRET_KEY")
  );

  const directorId = must("DIRECTOR_ID");

  const { data: director, error } = await supabaseAdmin
    .from("directors")
    .select("config")
    .eq("id", directorId)
    .single();

  if (error || !director) {
    return NextResponse.json({ error: "Director not found" }, { status: 404 });
  }

  const refreshToken = director.config?.google?.refresh_token;

  if (!refreshToken) {
    return NextResponse.json({ error: "No refresh token found" }, { status: 400 });
  }

  const oauth2 = new google.auth.OAuth2(
    must("GOOGLE_CLIENT_ID"),
    must("GOOGLE_CLIENT_SECRET"),
    must("GOOGLE_REDIRECT_URI")
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