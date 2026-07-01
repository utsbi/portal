import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const calendarId = body?.calendarId;

    if (!calendarId || typeof calendarId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid calendarId" },
        { status: 400 },
      );
    }

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

    const config =
      (profile.config as {
        google?: Record<string, unknown>;
        [key: string]: unknown;
      } | null) ?? {};
    const updatedConfig = {
      ...config,
      google: {
        ...config.google,
        calendar_id: calendarId,
      },
    };

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update({ config: updatedConfig as unknown as Json })
      .eq("id", profile.id)
      .select("id, config")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: "Calendar saved successfully.",
      profile: data,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Unexpected server error",
      },
      { status: 500 },
    );
  }
}
