"use server";

import { revalidatePath } from "next/cache";
import { requireDirector } from "@/lib/auth/guards";
import { type DuesCommand, validateDuesCommand } from "@/lib/dues-validation";

export async function manageDues(
  command: DuesCommand,
): Promise<{ error?: string; id?: number }> {
  const gate = await requireDirector();
  if (!gate.ok) return { error: gate.error };
  const validation = validateDuesCommand(command);
  if (validation) return { error: validation };

  if (
    command.action === "mark_paid" ||
    ((command.action === "create_period" ||
      command.action === "assign_members") &&
      command.paid_profile_ids?.length)
  ) {
    // An older RPC ignores unknown JSON fields. Never let it silently create
    // unpaid assessments when the caller explicitly marked members as paid.
    const { error } = await gate.supabase
      .from("dues_payments")
      .select("historical")
      .limit(0);
    if (error)
      return {
        error:
          "Historical payment support could not be verified. Apply the latest dues migration before marking members paid, or try again if the database is temporarily unavailable.",
      };
  }

  const { action, ...input } = command;
  const { data, error } = await gate.supabase.rpc("manage_dues", {
    p_action: action,
    p_input: input,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/admin/dues");
  return { id: data };
}
