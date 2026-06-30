import { NextResponse } from "next/server";
import { decryptToken } from "@/lib/crypto/tokens";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = createAdminClient();

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

  const existingConfig = (profile.config ?? {}) as Record<string, unknown>;
  const existingGoogle = (existingConfig.google ?? {}) as Record<
    string,
    unknown
  >;
  const rawAccessToken = existingGoogle.access_token as string | undefined;

  // Best-effort revoke at Google. We don't fail the disconnect if this errors.
  if (rawAccessToken) {
    try {
      const accessToken = decryptToken(rawAccessToken);
      await fetch(
        `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(accessToken)}`,
        {
          method: "POST",
        },
      );
    } catch {
      // Ignore — local state is what matters.
    }
  }

  const newConfig = { ...existingConfig };
  delete (newConfig as Record<string, unknown>).google;

  const { error: writeErr } = await supabaseAdmin
    .from("profiles")
    .update({ config: newConfig as unknown as Json })
    .eq("id", profile.id);

  if (writeErr) {
    return NextResponse.json({ error: writeErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
