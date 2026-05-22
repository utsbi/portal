import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

function jsonError(status: number, detail: string) {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return jsonError(401, "Unauthorized");

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return jsonError(401, "No active session");

  const formData = await request.formData();

  const backendRes = await fetch(`${BACKEND_URL}/api/v1/chat/extract-text`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: formData,
    signal: request.signal,
  });

  const passthroughHeaders = new Headers();
  const contentType = backendRes.headers.get("Content-Type");
  if (contentType) passthroughHeaders.set("Content-Type", contentType);

  return new Response(backendRes.body, {
    status: backendRes.status,
    headers: passthroughHeaders,
  });
}
