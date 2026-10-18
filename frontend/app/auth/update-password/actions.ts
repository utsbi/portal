"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * An invited account is not considered active when the invitation is sent.
 * The password form calls this after Supabase accepts the new password, for
 * every role, so the account leaves the pending roster after setup.
 */
export async function markPortalAccountActivated(): Promise<
  { success: true } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await createAdminClient()
    .from("profiles")
    .update({ portal_activated_at: new Date().toISOString() })
    .eq("uid", user.id)
    .is("portal_activated_at", null);

  if (error) return { error: error.message };
  return { success: true };
}
