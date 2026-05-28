import type { Database } from "@/lib/supabase/database.types";

type Tables = Database["public"]["Tables"];

export type ProjectBudget = Tables["project_budgets"]["Row"];
export type BudgetCategory = Tables["budget_categories"]["Row"];
export type BudgetTransaction = Tables["budget_transactions"]["Row"];

export type CategoryDraft = {
  id?: number;
  name: string;
  expected_amount: number;
  sort_order: number;
};

export type TransactionInput = {
  budget_id: number;
  category_id: number;
  occurred_on: string;
  title: string;
  description?: string | null;
  amount: number;
};

export type BudgetFetchResult = {
  budget: ProjectBudget | null;
  categories: BudgetCategory[];
  transactions: BudgetTransaction[];
  canEdit: boolean;
};

export type ActionResult = { error?: string };
