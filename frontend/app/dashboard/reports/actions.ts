"use server";

import { isStaffRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// updateReportStatus
//
// Updates the status of a tickets row (ticket_type='report') via the server
// client.  The caller must be authenticated and either a global director or a
// member of the project that owns the ticket.
// ---------------------------------------------------------------------------
export async function updateReportStatus(
  reportId: string,
  status: string,
): Promise<{ error: string } | { error: null; success: true }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Not authenticated" };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("uid", user.id)
    .single();
  if (profileError || !profile) return { error: "Profile not found" };

  if (!isStaffRole(profile.role) && profile.role !== "member") {
    return { error: "Insufficient permissions" };
  }

  // For non-directors, confirm they belong to the project that owns this ticket.
  if (!isStaffRole(profile.role)) {
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .select("project_id")
      .eq("id", reportId)
      .eq("ticket_type", "report")
      .maybeSingle();
    if (ticketError || !ticket) return { error: "Report not found" };

    if (ticket.project_id != null) {
      const { data: membership, error: memberError } = await supabase
        .from("project_members")
        .select("project_id")
        .eq("profile_id", profile.id)
        .eq("project_id", ticket.project_id)
        .maybeSingle();
      if (memberError || !membership) {
        return { error: "You are not a member of this project" };
      }
    }
  }

  const { error } = await supabase
    .from("tickets")
    .update({ status })
    .eq("id", reportId);

  if (error) return { error: error.message };
  return { error: null, success: true };
}
