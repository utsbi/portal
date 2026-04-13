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

  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

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
          "No refresh_token returned. Remove the app from Google permissions, then reconnect.",
      },
      { status: 400 }
    );
  }

  const supabaseAdmin = createClient(
    must("NEXT_PUBLIC_SUPABASE_URL"),
    must("SUPABASE_SERVICE_ROLE_KEY")
  );

  const directorId = must("DIRECTOR_ID");

  const { data: director, error: readErr } = await supabaseAdmin
    .from("directors")
    .select("config")
    .eq("id", directorId)
    .single();

  if (readErr) {
    return NextResponse.json({ error: readErr.message }, { status: 500 });
  }

  const existingConfig = (director?.config ?? {}) as Record<string, any>;

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

  const { error: writeErr } = await supabaseAdmin
    .from("directors")
    .update({ config: newConfig })
    .eq("id", directorId);

  if (writeErr) {
    return NextResponse.json({ error: writeErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: "Google connected. Refresh token saved. Next step is calendar selection.",
  });
}