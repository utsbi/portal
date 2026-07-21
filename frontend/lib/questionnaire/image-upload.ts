import { createClient } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Upload helper for form image blocks. Targets the PUBLIC questionnaire-images
// bucket so the resulting URL renders on public forms without auth. Director
// uploads land under <uid>/... (owner-folder write policy); reads are public.
// ---------------------------------------------------------------------------

export const FORM_IMAGE_BUCKET = "questionnaire-images";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

function sanitizeFileName(name: string): string {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^[_.]+/, "");
  return cleaned || "image";
}

export async function uploadFormImage(
  file: File,
): Promise<{ url: string; error: null } | { url: null; error: string }> {
  if (!file.type.startsWith("image/")) {
    return { url: null, error: "Please choose an image file." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { url: null, error: "Image is larger than the 5 MB limit." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { url: null, error: "You are not signed in." };

  const path = `${user.id}/${Date.now()}-${sanitizeFileName(file.name)}`;
  const { error } = await supabase.storage
    .from(FORM_IMAGE_BUCKET)
    .upload(path, file, { upsert: false });
  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("permission") || msg.includes("row-level security")) {
      return {
        url: null,
        error: "You don't have permission to upload images.",
      };
    }
    return { url: null, error: error.message };
  }

  const { data } = supabase.storage.from(FORM_IMAGE_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}
