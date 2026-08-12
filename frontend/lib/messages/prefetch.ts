/**
 * Prefetch a conversation into the conv-cache on hover, so switching feels
 * instant. No-ops if a fresh snapshot (< 30s old) already exists.
 */

import { fetchLastRead } from "@/components/dashboard/messages/read-state";
import { createClient } from "@/lib/supabase/client";
import { signWithCache } from "./attachment-cache";
import {
  type CachedAttachment,
  type CachedMessage,
  getCachedConv,
  setCachedConv,
} from "./conv-cache";

const FRESH_THRESHOLD_MS = 30 * 1000; // 30 seconds

export async function prefetchConv(convId: string): Promise<void> {
  const existing = getCachedConv(convId);
  if (existing && Date.now() - existing.cachedAt < FRESH_THRESHOLD_MS) {
    return;
  }

  const supabase = createClient();

  const [msgsRes, lastReadMs] = await Promise.all([
    supabase
      .from("messages")
      .select(
        "id, content, sender_role, sender_profile_id, created_at, edited_at, reply_to_id, is_pinned, pinned_at, message_attachments(id, path, name, mime_type, meta, sort_index), message_unfurls(url, title, description, image_url, site_name)",
      )
      .eq("conversation_id", Number(convId))
      .order("created_at", { ascending: true }),
    fetchLastRead(convId),
  ]);

  if (msgsRes.error || !msgsRes.data) return;

  const mapped: CachedMessage[] = msgsRes.data.map((row) => {
    const rawAttachments = Array.isArray(row.message_attachments)
      ? row.message_attachments
      : [];
    const attachments: CachedAttachment[] = rawAttachments
      .slice()
      .sort(
        (a: { sort_index: number }, b: { sort_index: number }) =>
          a.sort_index - b.sort_index,
      )
      .map(
        (a: {
          id: number;
          path: string;
          name: string;
          mime_type: string | null;
          meta: unknown;
          sort_index: number;
        }) => ({
          id: a.id,
          path: a.path,
          name: a.name,
          mimeType: a.mime_type,
          meta: (a.meta as CachedAttachment["meta"]) ?? null,
          signedUrl: null,
        }),
      );
    // 1:1 join — PostgREST returns object|null, not an array. Handle both.
    type RawUnfurl = {
      url: string;
      title: string | null;
      description: string | null;
      image_url: string | null;
      site_name: string | null;
    };
    const rawUnfurl = (row as Record<string, unknown>).message_unfurls as
      | RawUnfurl
      | RawUnfurl[]
      | null
      | undefined;
    const firstUnfurl: RawUnfurl | undefined = Array.isArray(rawUnfurl)
      ? rawUnfurl[0]
      : (rawUnfurl ?? undefined);
    return {
      id: row.id,
      text: row.content ?? null,
      senderRole:
        (row.sender_role as "client" | "director" | "president" | "member") ??
        "client",
      senderProfileId: (row.sender_profile_id as number | null) ?? null,
      createdAt: (row.created_at as string) ?? new Date().toISOString(),
      editedAt:
        ((row as Record<string, unknown>).edited_at as string | null) ?? null,
      replyToId:
        ((row as Record<string, unknown>).reply_to_id as number | null) ?? null,
      attachments,
      status: "sent" as const,
      isPinned: Boolean((row as Record<string, unknown>).is_pinned),
      pinnedAt:
        ((row as Record<string, unknown>).pinned_at as string | null) ?? null,
      unfurl: firstUnfurl ?? null,
    };
  });

  // Sign thumbnails in the background.
  const allPaths: string[] = [];
  for (const m of mapped) {
    for (const a of m.attachments) {
      if (a.path) allPaths.push(a.path);
    }
  }

  if (allPaths.length > 0) {
    const urlMap = await signWithCache(supabase, allPaths, {
      width: 560,
      quality: 75,
    });
    for (const m of mapped) {
      for (const a of m.attachments) {
        if (a.path && urlMap.has(a.path)) {
          a.signedUrl = urlMap.get(a.path) ?? null;
        }
      }
    }
  }

  // Compute divider: first unseen peer message after last read.
  // We don't know the senderRole here, so we skip it (divider computed properly
  // in loadMessages when the thread actually opens).
  const newDividerBeforeId = getCachedConv(convId)?.newDividerBeforeId ?? null;

  setCachedConv(convId, {
    messages: mapped,
    lastRead: lastReadMs,
    cachedAt: Date.now(),
    newDividerBeforeId,
  });
}
