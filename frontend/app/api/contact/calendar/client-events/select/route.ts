import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function must(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const calendarId = body?.calendarId;

    if (!calendarId || typeof calendarId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid calendarId" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(
      must("NEXT_PUBLIC_SUPABASE_URL"),
      must("SUPABASE_SECRET_KEY")
    );

    const directorId = must("DIRECTOR_ID");

    const { data, error } = await supabaseAdmin
      .from("directors")
      .update({ calendar_id: calendarId })
      .eq("id", directorId)
      .select("id, calendar_id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: "Calendar saved successfully.",
      director: data,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Unexpected server error",
      },
      { status: 500 }
    );
  }
}