import type { NextRequest } from "next/server";
import { getBackendUrl } from "@/lib/env/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const BACKEND_URL = getBackendUrl();

function jsonError(status: number, detail: string) {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Index a Document-Portal file into the project's RAG corpus. Forwards
 * `{ project_id, storage_path }` to the backend, which re-verifies membership
 * (it rejects a project the caller doesn't belong to) and pulls the object from
 * Storage to embed it. Mirrors the auth shape of /api/knowledge/upload.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError(401, "Unauthorized");

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return jsonError(401, "No active session");

  const body = await request.text();

  const backendRes = await fetch(
    `${BACKEND_URL}/api/v1/documents/knowledge/index-file`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body,
      signal: request.signal,
    },
  );

  const passthroughHeaders = new Headers();
  const contentType = backendRes.headers.get("Content-Type");
  if (contentType) passthroughHeaders.set("Content-Type", contentType);

  return new Response(backendRes.body, {
    status: backendRes.status,
    headers: passthroughHeaders,
  });
}
