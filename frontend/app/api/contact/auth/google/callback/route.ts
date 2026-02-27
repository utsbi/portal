import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

function must(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

  const oauth2 = new google.auth.OAuth2(
    must("GOOGLE_CLIENT_ID"),
    must("GOOGLE_CLIENT_SECRET"),
    must("GOOGLE_REDIRECT_URI")
  );

  const { tokens } = await oauth2.getToken(code);

  if (!tokens.refresh_token) {
    return NextResponse.json(
      {
        error:
          "No refresh_token returned. Go to myaccount.google.com/permissions, remove your app access, then try /api/auth/google again.",
      },
      { status: 400 }
    );
  }

  const supabaseAdmin = createClient(must("NEXT_PUBLIC_SUPABASE_URL"), must("SUPABASE_SERVICE_ROLE_KEY"));

  const directorId = must("DIRECTOR_CLIENT_ID");

  // Get existing config so we merge instead of overwrite
  const { data: director, error: readErr } = await supabaseAdmin
    .from("clients")
    .select("config")
    .eq("id", directorId)
    .single();

  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });

  const existingConfig = (director?.config ?? {}) as Record<string, any>;

  const newConfig = {
    ...existingConfig,
    google: {
      ...(existingConfig.google ?? {}),
      calendar_id: "primary",
      refresh_token: tokens.refresh_token,
    },
  };

  const { error: writeErr } = await supabaseAdmin
    .from("clients")
    .update({ config: newConfig })
    .eq("id", directorId);

  if (writeErr) return NextResponse.json({ error: writeErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    message: "Google connected. Refresh token saved into clients.config.google on your director row.",
  });
}