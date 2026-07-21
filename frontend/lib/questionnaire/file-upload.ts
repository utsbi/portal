import { createClient } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Client-side helpers for questionnaire file-upload answers. Files live in the
// private 'questionnaire-attachments' bucket under the owner-folder-scoped path
//   <user_uid>/<form_id>/<timestamp>-<filename>
// which satisfies the bucket's RLS (first segment = uploader uid) and lets the
// form owner read them via the director-read policy (second segment = form id).
// The answer value stored in custom_form_submissions.data is the object path
// (a string); the original filename is recovered from it for display.
// ---------------------------------------------------------------------------

export const QUESTIONNAIRE_BUCKET = "questionnaire-attachments";

/** 25 MB — mirrors the bucket's file_size_limit (baseline migration). */
export const MAX_UPLOAD_BYTES = 26214400;

export interface UploadResult {
  path: string;
  name: string;
}

/** Strip characters that don't belong in a storage object name. */
function sanitizeFileName(name: string): string {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^[_.]+/, "");
  return cleaned || "file";
}

/**
 * Upload a single file for the given form. Returns the stored object path (the
 * answer value) and the display name, or an error message.
 */
export async function uploadQuestionnaireFile(
  formId: number,
  file: File,
): Promise<
  { data: UploadResult; error: null } | { data: null; error: string }
> {
  if (file.size > MAX_UPLOAD_BYTES) {
    return { data: null, error: "File is larger than the 25 MB limit." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "You are not signed in." };

  const safeName = sanitizeFileName(file.name);
  const path = `${user.id}/${formId}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from(QUESTIONNAIRE_BUCKET)
    .upload(path, file, { upsert: false });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("mime") || msg.includes("type")) {
      return { data: null, error: "That file type isn't allowed." };
    }
    if (msg.includes("permission") || msg.includes("row-level security")) {
      return { data: null, error: "You don't have permission to upload here." };
    }
    return { data: null, error: error.message };
  }

  return { data: { path, name: safeName }, error: null };
}

/**
 * Create a short-lived signed URL for a stored object path. Works for both the
 * uploader (own-folder policy) and the form owner (director-read policy).
 */
export async function createAttachmentSignedUrl(
  path: string,
  expiresInSeconds = 120,
): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(QUESTIONNAIRE_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}

/** Best-effort delete of an uploaded object (used when a user clears a field). */
export async function removeQuestionnaireFile(path: string): Promise<void> {
  const supabase = createClient();
  await supabase.storage.from(QUESTIONNAIRE_BUCKET).remove([path]);
}

/** Recover a human-readable filename from a stored object path. */
export function fileNameFromPath(path: string): string {
  const last = path.split("/").pop() ?? path;
  // Drop the "<timestamp>-" prefix we add at upload time.
  return last.replace(/^\d+-/, "") || last;
}
