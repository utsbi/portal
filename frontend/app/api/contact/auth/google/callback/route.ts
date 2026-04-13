import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

function must(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  // Get the authenticated user to determine which director this is
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Look up the director's profile
  const supabaseAdmin = createClient(
    must("NEXT_PUBLIC_SUPABASE_URL"),
    must("SUPABASE_SECRET_KEY")
  );

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, role, config")
    .eq("uid", user.id)
    .single();

  if (!profile || profile.role !== "director") {
    return NextResponse.json({ error: "Only directors can connect Google Calendar" }, { status: 403 });
  }

  const oauth2 = new google.auth.OAuth2(
    must("GOOGLE_CLIENT_ID"),
    must("GOOGLE_CLIENT_SECRET"),
    must("GOOGLE_REDIRECT_URI")
  );

  const { tokens } = await oauth2.getToken(code);

  if (!tokens.refresh_token) {
    return NextResponse.json(
      { error: "No refresh_token returned. Remove the app from Google permissions, then reconnect." },
      { status: 400 }
    );
  }

  const existingConfig = (profile.config ?? {}) as Record<string, any>;

  const newConfig = {
    ...existingConfig,
    google: {
      ...(existingConfig.google ?? {}),
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token ?? null,
      scope: tokens.scope ?? null,
      token_type: tokens.token_type ?? null,
      expiry_date: tokens.expiry_date ?? null,
    },
  };

  // Save to profiles table (new identity model)
  const { error: writeErr } = await supabaseAdmin
    .from("profiles")
    .update({ config: newConfig })
    .eq("id", profile.id);

  if (writeErr) {
    return NextResponse.json({ error: writeErr.message }, { status: 500 });
  }

  // Also update the old directors table for backward compat during migration
  const { data: directorRow } = await supabaseAdmin
    .from("directors")
    .select("id")
    .eq("uid", user.id)
    .single();

  if (directorRow) {
    await supabaseAdmin
      .from("directors")
      .update({ config: newConfig })
      .eq("id", directorRow.id);
  }

  return NextResponse.json({
    ok: true,
    message: "Google connected. Refresh token saved.",
  });
}
