import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { FinancesView } from "@/components/dashboard/finances";
import type { BudgetFetchResult } from "@/components/dashboard/finances/types";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function fetchFinancesData(
  projectId: number,
): Promise<BudgetFetchResult | { redirect: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { redirect: "/login" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("uid", user.id)
    .single();
  if (!profile) return { redirect: "/login" };

  const { data: membership } = await supabase
    .from("project_members")
    .select("role")
    .eq("profile_id", profile.id)
    .eq("project_id", projectId)
    .maybeSingle();
  const canEdit = membership?.role === "director";

  const { data: budget } = await supabase
    .from("project_budgets")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  if (!budget) {
    return { budget: null, categories: [], transactions: [], canEdit };
  }

  const [{ data: categories }, { data: transactions }] = await Promise.all([
    supabase
      .from("budget_categories")
      .select("*")
      .eq("budget_id", budget.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("budget_transactions")
      .select("*")
      .eq("budget_id", budget.id)
      .order("occurred_on", { ascending: false }),
  ]);

  return {
    budget,
    categories: categories ?? [],
    transactions: transactions ?? [],
    canEdit,
  };
}

export default async function FinancesPage() {
  const cookieStore = await cookies();
  const projectIdRaw = cookieStore.get("active_project_id")?.value;
  const projectId = projectIdRaw ? parseInt(projectIdRaw, 10) : NaN;
  if (!Number.isFinite(projectId)) redirect("/dashboard");

  const result = await fetchFinancesData(projectId);
  if ("redirect" in result) redirect(result.redirect);

  return (
    <FinancesView
      key={projectId}
      projectId={projectId}
      canEdit={result.canEdit}
      initialBudget={result.budget}
      initialCategories={result.categories}
      initialTransactions={result.transactions}
    />
  );
}
