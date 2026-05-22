import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function must(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function POST() {
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

  const existingConfig = (profile.config ?? {}) as Record<string, unknown>;
  const existingGoogle = (existingConfig.google ?? {}) as Record<
    string,
    unknown
  >;
  const accessToken = existingGoogle.access_token as string | undefined;

  // Best-effort revoke at Google. We don't fail the disconnect if this errors.
  if (accessToken) {
    try {
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
    .update({ config: newConfig })
    .eq("id", profile.id);

  if (writeErr) {
    return NextResponse.json({ error: writeErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
