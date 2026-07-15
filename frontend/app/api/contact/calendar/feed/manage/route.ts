import { NextResponse } from "next/server";
import { generateFeedToken } from "@/lib/calendar/feed-token";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

interface ProfileConfig {
  calendar_feed_token_hash?: string;
  [key: string]: unknown;
}

function buildFeedUrl(req: Request, token: string): string {
  // The browser uses https://, but the user pastes this into a calendar app
  // as webcal:// for auto-sync. We return the https form; the settings UI
  // rewrites the scheme to webcal:// when displaying the copy-paste URL.
  const u = new URL(req.url);
  return `${u.origin}/api/contact/calendar/feed/${token}`;
}

async function loadCallerProfileConfig() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const supabaseAdmin = createAdminClient();
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, config")
    .eq("uid", user.id)
    .single();
  if (!profile) {
    return {
      error: NextResponse.json({ error: "Profile not found" }, { status: 404 }),
    };
  }
  return { supabaseAdmin, profile };
}

/**
 * GET /api/contact/calendar/feed/manage
 * Returns the user's current feed URL. Generates a token on first request
 * (so we never return a feed URL that doesn't work).
 */
export async function GET(req: Request) {
  const ctx = await loadCallerProfileConfig();
  if ("error" in ctx) return ctx.error;
  const { supabaseAdmin, profile } = ctx;
  const config = (profile.config ?? {}) as ProfileConfig;

  if (config.calendar_feed_token_hash) {
    // Token hash exists but we don't have the plaintext (it was shown once
    // at generation time and never stored). The user must rotate to get a
    // new URL they can actually paste.
    return NextResponse.json({
      ok: true,
      hasToken: true,
      message:
        "Rotate the URL to get a fresh link — the existing one was only shown once at creation.",
    });
  }

  // First-time generation: create token, store hash, return plaintext URL.
  const token = generateFeedToken();
  const newConfig: ProfileConfig = {
    ...config,
    calendar_feed_token_hash: token.hash,
  };
  const { error: writeErr } = await supabaseAdmin
    .from("profiles")
    .update({ config: newConfig as unknown as Json })
    .eq("id", profile.id);
  if (writeErr) {
    return NextResponse.json(
      { error: "Couldn't save the feed token" },
      { status: 500 },
    );
  }
  return NextResponse.json({
    ok: true,
    hasToken: false,
    url: buildFeedUrl(req, token.plaintext),
  });
}

/**
 * POST /api/contact/calendar/feed/manage  (rotate)
 * Issues a new token, invalidating the old one. Returns the new plaintext URL.
 */
export async function POST(req: Request) {
  const ctx = await loadCallerProfileConfig();
  if ("error" in ctx) return ctx.error;
  const { supabaseAdmin, profile } = ctx;
  const config = (profile.config ?? {}) as ProfileConfig;

  const token = generateFeedToken();
  const newConfig: ProfileConfig = {
    ...config,
    calendar_feed_token_hash: token.hash,
  };
  const { error: writeErr } = await supabaseAdmin
    .from("profiles")
    .update({ config: newConfig as unknown as Json })
    .eq("id", profile.id);
  if (writeErr) {
    return NextResponse.json(
      { error: "Couldn't rotate the feed token" },
      { status: 500 },
    );
  }
  return NextResponse.json({
    ok: true,
    url: buildFeedUrl(req, token.plaintext),
  });
}

/**
 * DELETE /api/contact/calendar/feed/manage  (disable)
 * Removes the feed token. The feed URL stops working immediately.
 */
export async function DELETE() {
  const ctx = await loadCallerProfileConfig();
  if ("error" in ctx) return ctx.error;
  const { supabaseAdmin, profile } = ctx;
  const config = (profile.config ?? {}) as ProfileConfig;
  delete config.calendar_feed_token_hash;

  const { error: writeErr } = await supabaseAdmin
    .from("profiles")
    .update({ config: config as unknown as Json })
    .eq("id", profile.id);
  if (writeErr) {
    return NextResponse.json(
      { error: "Couldn't disable the feed" },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
