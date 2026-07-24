import type { NextRequest } from "next/server";
import { getBackendUrl } from "@/lib/env/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const BACKEND_URL = getBackendUrl();

// Upload guardrails: cap size and restrict to a small allowlist of document
// types before forwarding to the backend extractor.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "txt",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
] as const;
const ALLOWED_MIME_TYPES = new Set<string>([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/octet-stream", // some browsers omit a precise type
]);

function jsonError(status: number, detail: string) {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

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

  // Validate the uploaded file (size + type) before forwarding to the backend.
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return jsonError(400, "No file provided");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return jsonError(413, "File too large (max 10 MB)");
  }
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const extensionAllowed = (ALLOWED_EXTENSIONS as readonly string[]).includes(
    extension,
  );
  const mimeAllowed = !file.type || ALLOWED_MIME_TYPES.has(file.type);
  if (!extensionAllowed || !mimeAllowed) {
    return jsonError(
      400,
      "Unsupported file type. Allowed: pdf, doc, docx, txt, png, jpg, jpeg, webp, gif",
    );
  }

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
