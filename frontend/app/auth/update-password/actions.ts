"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * A member invite is not considered active when the director sends it. The
 * password form calls this after Supabase accepts the new password, keeping
 * the member in the pending roster until they have completed setup.
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
    .eq("role", "member")
    .is("portal_activated_at", null);

  if (error) return { error: error.message };
  return { success: true };
}
