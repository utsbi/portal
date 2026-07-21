"use server";

import { revalidatePath } from "next/cache";
import type {
  ActionResult,
  CategoryDraft,
  TransactionInput,
} from "@/components/dashboard/finances/types";
import { requireProjectDirector } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

const FINANCES_PATH = "/dashboard/finances";

async function projectIdForBudget(budgetId: number): Promise<number | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("project_budgets")
    .select("project_id")
    .eq("id", budgetId)
    .single();
  return data?.project_id ?? null;
}

export async function createBudget(input: {
  projectId: number;
  periodStart: string;
  periodEnd: string;
  currency?: string;
}): Promise<ActionResult> {
  const gate = await requireProjectDirector(input.projectId);
  if ("error" in gate) return { error: gate.error };

  const { error } = await gate.supabase.from("project_budgets").insert({
    project_id: input.projectId,
    period_start: input.periodStart,
    period_end: input.periodEnd,
    currency: input.currency ?? "USD",
    created_by: gate.profileId,
  });

  if (error) return { error: error.message };
  revalidatePath(FINANCES_PATH);
  return {};
}

export async function upsertCategories(
  budgetId: number,
  drafts: CategoryDraft[],
): Promise<ActionResult> {
  const projectId = await projectIdForBudget(budgetId);
  if (!projectId) return { error: "Budget not found" };
  const gate = await requireProjectDirector(projectId);
  if ("error" in gate) return { error: gate.error };

  const rows = drafts.map((d) => {
    const base = {
      budget_id: budgetId,
      name: d.name.trim(),
      expected_amount: d.expected_amount,
      sort_order: d.sort_order,
    };
    return d.id !== undefined ? { ...base, id: d.id } : base;
  });

  const { error } = await gate.supabase
    .from("budget_categories")
    .upsert(rows, { onConflict: "id", defaultToNull: false });

  if (error) return { error: error.message };
  revalidatePath(FINANCES_PATH);
  return {};
}

export async function deleteCategory(
  categoryId: number,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: cat } = await supabase
    .from("budget_categories")
    .select("budget_id")
    .eq("id", categoryId)
    .single();
  if (!cat) return { error: "Category not found" };

  const projectId = await projectIdForBudget(cat.budget_id);
  if (!projectId) return { error: "Budget not found" };
  const gate = await requireProjectDirector(projectId);
  if ("error" in gate) return { error: gate.error };

  const { error } = await gate.supabase
    .from("budget_categories")
    .delete()
    .eq("id", categoryId);

  if (error) {
    if (error.code === "23503") {
      return {
        error: "This category has transactions. Reassign or delete them first.",
      };
    }
    return { error: error.message };
  }
  revalidatePath(FINANCES_PATH);
  return {};
}

export async function logTransaction(
  input: TransactionInput,
): Promise<ActionResult> {
  const projectId = await projectIdForBudget(input.budget_id);
  if (!projectId) return { error: "Budget not found" };
  const gate = await requireProjectDirector(projectId);
  if ("error" in gate) return { error: gate.error };

  const { error } = await gate.supabase.from("budget_transactions").insert({
    budget_id: input.budget_id,
    category_id: input.category_id,
    occurred_on: input.occurred_on,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    amount: input.amount,
    created_by: gate.profileId,
  });

  if (error) return { error: error.message };
  revalidatePath(FINANCES_PATH);
  return {};
}

export async function updateTransaction(
  id: number,
  patch: Partial<TransactionInput>,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: tx } = await supabase
    .from("budget_transactions")
    .select("budget_id")
    .eq("id", id)
    .single();
  if (!tx) return { error: "Transaction not found" };

  const projectId = await projectIdForBudget(tx.budget_id);
  if (!projectId) return { error: "Budget not found" };
  const gate = await requireProjectDirector(projectId);
  if ("error" in gate) return { error: gate.error };

  const updateRow: Record<string, unknown> = {};
  if (patch.category_id !== undefined)
    updateRow.category_id = patch.category_id;
  if (patch.occurred_on !== undefined)
    updateRow.occurred_on = patch.occurred_on;
  if (patch.title !== undefined) updateRow.title = patch.title.trim();
  if (patch.description !== undefined) {
    updateRow.description = patch.description?.trim() || null;
  }
  if (patch.amount !== undefined) updateRow.amount = patch.amount;

  const { error } = await gate.supabase
    .from("budget_transactions")
    .update(updateRow)
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath(FINANCES_PATH);
  return {};
}

export async function deleteTransaction(id: number): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: tx } = await supabase
    .from("budget_transactions")
    .select("budget_id")
    .eq("id", id)
    .single();
  if (!tx) return { error: "Transaction not found" };

  const projectId = await projectIdForBudget(tx.budget_id);
  if (!projectId) return { error: "Budget not found" };
  const gate = await requireProjectDirector(projectId);
  if ("error" in gate) return { error: gate.error };

  const { error } = await gate.supabase
    .from("budget_transactions")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath(FINANCES_PATH);
  return {};
}
