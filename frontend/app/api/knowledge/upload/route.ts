import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

// PDF only (the backend ingester accepts PDF), capped at 10 MB.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function jsonError(status: number, detail: string) {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Forward a PDF to the backend RAG ingester, tagging it with the active project.
 * Membership for `project_id` is re-verified by the backend (it rejects a
 * project the caller doesn't belong to), so this route only checks auth + the
 * file/shape, mirroring /api/chat/extract.
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

  const formData = await request.formData();

  const file = formData.get("file");
  if (!(file instanceof File)) return jsonError(400, "No file provided");
  if (file.size > MAX_UPLOAD_BYTES) {
    return jsonError(413, "File too large (max 10 MB)");
  }
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (extension !== "pdf") {
    return jsonError(400, "Only PDF files are supported.");
  }

  const projectIdRaw = formData.get("project_id");
  const projectId =
    typeof projectIdRaw === "string" ? Number(projectIdRaw) : Number.NaN;
  if (!Number.isInteger(projectId) || projectId <= 0) {
    return jsonError(400, "A valid project_id is required.");
  }

  const backendRes = await fetch(`${BACKEND_URL}/api/v1/documents/upload`, {
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
