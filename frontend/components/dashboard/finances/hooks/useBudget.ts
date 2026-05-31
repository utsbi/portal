"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  BudgetCategory,
  BudgetTransaction,
  ProjectBudget,
} from "../types";

interface UseBudgetArgs {
  initialBudget: ProjectBudget | null;
  initialCategories: BudgetCategory[];
  initialTransactions: BudgetTransaction[];
  projectId: number;
}

interface UseBudgetReturn {
  budget: ProjectBudget | null;
  categories: BudgetCategory[];
  transactions: BudgetTransaction[];
  refetch: () => Promise<void>;
}

export function useBudget(args: UseBudgetArgs): UseBudgetReturn {
  const [budget, setBudget] = useState(args.initialBudget);
  const [categories, setCategories] = useState(args.initialCategories);
  const [transactions, setTransactions] = useState(args.initialTransactions);

  const refetch = useCallback(async () => {
    const supabase = createClient();

    const { data: budgetRow } = await supabase
      .from("project_budgets")
      .select("*")
      .eq("project_id", args.projectId)
      .maybeSingle();

    if (!budgetRow) {
      setBudget(null);
      setCategories([]);
      setTransactions([]);
      return;
    }

    const [{ data: cats }, { data: txs }] = await Promise.all([
      supabase
        .from("budget_categories")
        .select("*")
        .eq("budget_id", budgetRow.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("budget_transactions")
        .select("*")
        .eq("budget_id", budgetRow.id)
        .order("occurred_on", { ascending: false }),
    ]);

    setBudget(budgetRow);
    setCategories(cats ?? []);
    setTransactions(txs ?? []);
  }, [args.projectId]);

  useEffect(() => {
    const onFocus = () => {
      void refetch();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refetch]);

  return { budget, categories, transactions, refetch };
}
