import type { NextRequest } from "next/server";
import { getBackendUrl } from "@/lib/env/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const BACKEND_URL = getBackendUrl();

function jsonError(status: number, detail: string) {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * List the Document-Portal files indexed into a project's RAG corpus. Forwards
 * `?project_id=<n>` to the backend, which re-verifies membership. Mirrors the
 * auth shape of /api/knowledge/upload.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError(401, "Unauthorized");

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return jsonError(401, "No active session");

  const projectId = request.nextUrl.searchParams.get("project_id") ?? "";

  const backendRes = await fetch(
    `${BACKEND_URL}/api/v1/documents/knowledge/indexed?project_id=${encodeURIComponent(projectId)}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${session.access_token}` },
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
