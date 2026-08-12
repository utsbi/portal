import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type DiscordVerification = {
  discordId: string | number;
  name: string;
  email: string;
  eid?: string | null;
  department?: string | null;
  graduation?: number | null;
};

/**
 * Persistence boundary for the Discord verifier. The bot itself intentionally
 * remains outside this web app; it should call this server-only helper after a
 * successful verification. The DB trigger assigns the current default project.
 */
export async function upsertDiscordMemberProfile(input: DiscordVerification) {
  const discordId = String(input.discordId).trim();
  const name = input.name.trim();
  const contactEmail = input.email.trim().toLowerCase();
  if (!/^\d{15,22}$/.test(discordId)) {
    throw new Error("A valid Discord user ID is required");
  }
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    throw new Error("A valid name and contact email are required");
  }

  const admin = createAdminClient();
  const { data: existing, error: lookupError } = await admin
    .from("profiles")
    .select("id, role, uid")
    .eq("discord_id", discordId)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing && existing.role !== "member") {
    throw new Error("Discord ID is already attached to a non-member profile");
  }

  const identity = {
    name,
    contact_email: contactEmail,
    eid: input.eid?.trim().toLowerCase() || null,
    department: input.department?.trim() || null,
    graduation: input.graduation ?? null,
  };
  if (existing) {
    const { data, error } = await admin
      .from("profiles")
      .update(identity)
      .eq("id", existing.id)
      .select("id, uid")
      .single();
    if (error) throw error;
    return { profile: data, created: false };
  }

  const { data, error } = await admin
    .from("profiles")
    .insert({ ...identity, discord_id: discordId, role: "member", uid: null })
    .select("id, uid")
    .single();
  if (error) throw error;
  return { profile: data, created: true };
}
