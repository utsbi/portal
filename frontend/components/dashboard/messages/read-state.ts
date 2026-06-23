"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Server-backed per-conversation read tracking. Replaces the old
 * localStorage approach so unread state is consistent across browsers and
 * devices (the localStorage version silently broke under Brave's storage
 * partitioning). Backed by `public.conversation_reads`, RLS-scoped to the
 * caller's profile; writes go through the `mark_conversation_read` RPC so
 * the client never has to resolve its own profile id.
 */

/** Map of conversationId -> last-read epoch ms, for the current profile. */
export async function fetchReadMap(): Promise<Record<string, number>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("conversation_reads")
    .select("conversation_id, last_read_at");
  if (error || !data) return {};
  const map: Record<string, number> = {};
  for (const row of data) {
    map[String(row.conversation_id)] = new Date(
      row.last_read_at as string,
    ).getTime();
  }
  return map;
}

/** Last-read epoch ms for one conversation (0 if never read). */
export async function fetchLastRead(
  conversationId: string | number,
): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("conversation_reads")
    .select("last_read_at")
    .eq("conversation_id", Number(conversationId))
    .maybeSingle();
  if (error || !data?.last_read_at) return 0;
  return new Date(data.last_read_at as string).getTime();
}

/** Mark a conversation read up to now (idempotent upsert via RPC). */
export async function markRead(conversationId: string | number): Promise<void> {
  const supabase = createClient();
  await supabase.rpc("mark_conversation_read", {
    p_conversation_id: Number(conversationId),
  });
}
