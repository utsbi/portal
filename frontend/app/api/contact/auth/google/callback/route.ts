import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { encryptToken } from "@/lib/crypto/tokens";
import { createClient as createServerClient } from "@/lib/supabase/server";

function must(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function settingsUrl(req: Request, params: Record<string, string>) {
  const origin = new URL(req.url).origin;
  const url = new URL("/dashboard/settings", origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");
  const stateParam = searchParams.get("state");

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get("google_oauth_state")?.value;
  cookieStore.delete("google_oauth_state");

  if (!stateCookie || !stateParam || stateCookie !== stateParam) {
    return new Response("Invalid or missing OAuth state", { status: 400 });
  }

  if (oauthError) {
    return NextResponse.redirect(
      settingsUrl(req, { google: "error", reason: oauthError }),
    );
  }

  if (!code) {
    return NextResponse.redirect(
      settingsUrl(req, { google: "error", reason: "missing_code" }),
    );
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      settingsUrl(req, { google: "error", reason: "unauthenticated" }),
    );
  }

  const supabaseAdmin = createClient(
    must("NEXT_PUBLIC_SUPABASE_URL"),
    must("SUPABASE_SECRET_KEY"),
  );

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, role, config")
    .eq("uid", user.id)
    .single();

  if (!profile || profile.role !== "director") {
    return NextResponse.redirect(
      settingsUrl(req, { google: "error", reason: "not_director" }),
    );
  }

  const oauth2 = new google.auth.OAuth2(
    must("GOOGLE_CLIENT_ID"),
    must("GOOGLE_CLIENT_SECRET"),
    must("GOOGLE_REDIRECT_URI"),
  );

  const exchanged = await oauth2.getToken(code).catch(() => null);
  if (!exchanged) {
    return NextResponse.redirect(
      settingsUrl(req, { google: "error", reason: "exchange_failed" }),
    );
  }
  const { tokens } = exchanged;

  if (!tokens.refresh_token) {
    // Google returns a refresh_token only on the first consent. If the user
    // previously connected and is reconnecting without revoking, no refresh
    // token comes back. Direct them to revoke and try again.
    return NextResponse.redirect(
      settingsUrl(req, { google: "error", reason: "no_refresh_token" }),
    );
  }

  const existingConfig = (profile.config ?? {}) as Record<string, unknown>;
  const existingGoogle = (existingConfig.google ?? {}) as Record<
    string,
    unknown
  >;

  const newConfig = {
    ...existingConfig,
    google: {
      ...existingGoogle,
      refresh_token: encryptToken(tokens.refresh_token),
      access_token: tokens.access_token
        ? encryptToken(tokens.access_token)
        : null,
      scope: tokens.scope ?? null,
      token_type: tokens.token_type ?? null,
      expiry_date: tokens.expiry_date ?? null,
      connected_at: new Date().toISOString(),
    },
  };

  const { error: writeErr } = await supabaseAdmin
    .from("profiles")
    .update({ config: newConfig })
    .eq("id", profile.id);

  if (writeErr) {
    return NextResponse.redirect(
      settingsUrl(req, { google: "error", reason: "save_failed" }),
    );
  }

  return NextResponse.redirect(settingsUrl(req, { google: "connected" }));
}
