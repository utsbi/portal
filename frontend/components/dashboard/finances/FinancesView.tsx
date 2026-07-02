"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  deleteCategory,
  deleteTransaction,
} from "@/app/dashboard/finances/actions";
import {
  btnGhost,
  btnPrimary,
  DashboardMain,
  DashboardShell,
  PageHeader,
  SectionLabel,
} from "@/components/dashboard/common/ui";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CategoryEditorDrawer } from "./CategoryEditorDrawer";
import { CategoryGrid } from "./CategoryGrid";
import { EmptyBudgetState } from "./EmptyBudgetState";
import { useBudget } from "./hooks/useBudget";
import { LogTransactionDrawer } from "./LogTransactionDrawer";
import { OverviewTiles } from "./OverviewTiles";
import { SetupBudgetDrawer } from "./SetupBudgetDrawer";
import { SpendChart } from "./SpendChart";
import { TransactionsTable } from "./TransactionsTable";
import type { BudgetCategory, BudgetTransaction, ProjectBudget } from "./types";

interface FinancesViewProps {
  projectId: number;
  canEdit: boolean;
  initialBudget: ProjectBudget | null;
  initialCategories: BudgetCategory[];
  initialTransactions: BudgetTransaction[];
}

const wholeCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatCurrency(n: number) {
  return wholeCurrency.format(n);
}

const xAxisFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "2-digit",
});

export function FinancesView({
  projectId,
  canEdit,
  initialBudget,
  initialCategories,
  initialTransactions,
}: FinancesViewProps) {
  const { budget, categories, transactions, refetch } = useBudget({
    initialBudget,
    initialCategories,
    initialTransactions,
    projectId,
  });

  const [setupOpen, setSetupOpen] = useState(false);
  const [categoryEditorOpen, setCategoryEditorOpen] = useState(false);
  const [logTxOpen, setLogTxOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<BudgetTransaction | null>(null);
  const [pendingDeleteCategory, setPendingDeleteCategory] =
    useState<BudgetCategory | null>(null);
  const [pendingDeleteTx, setPendingDeleteTx] =
    useState<BudgetTransaction | null>(null);

  const actualByCategory = useMemo(() => {
    const map = new Map<number, number>();
    for (const tx of transactions) {
      map.set(
        tx.category_id,
        (map.get(tx.category_id) ?? 0) + Number(tx.amount),
      );
    }
    return map;
  }, [transactions]);

  const txCountByCategory = useMemo(() => {
    const map = new Map<number, number>();
    for (const tx of transactions) {
      map.set(tx.category_id, (map.get(tx.category_id) ?? 0) + 1);
    }
    return map;
  }, [transactions]);

  const totalExpected = useMemo(
    () => categories.reduce((s, c) => s + Number(c.expected_amount), 0),
    [categories],
  );
  const totalActual = useMemo(
    () => transactions.reduce((s, t) => s + Number(t.amount), 0),
    [transactions],
  );

  const cumulativeByDate = useMemo(() => {
    if (transactions.length === 0) return [];
    const sorted = [...transactions].sort(
      (a, b) =>
        new Date(a.occurred_on).getTime() - new Date(b.occurred_on).getTime(),
    );
    let running = 0;
    return sorted.map((t) => {
      running += Number(t.amount);
      return {
        date: xAxisFmt.format(new Date(t.occurred_on)),
        cumulative: running,
      };
    });
  }, [transactions]);

  const pendingDeleteCategoryTxCount = pendingDeleteCategory
    ? transactions.filter((t) => t.category_id === pendingDeleteCategory.id)
        .length
    : 0;
  const deleteCategoryBlocked = pendingDeleteCategoryTxCount > 0;

  if (!budget) {
    return (
      <DashboardShell>
        <PageHeader
          title="Finances"
          subtitle="Track your project budget and spending"
        />
        <DashboardMain>
          <EmptyBudgetState
            canEdit={canEdit}
            onSetUp={() => setSetupOpen(true)}
          />
        </DashboardMain>
        <SetupBudgetDrawer
          open={setupOpen}
          onClose={() => setSetupOpen(false)}
          projectId={projectId}
          onCreated={refetch}
        />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <PageHeader
        title="Finances"
        subtitle="Track your project budget and spending"
        action={
          canEdit ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCategoryEditorOpen(true)}
                className={btnGhost}
              >
                Edit Categories
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingTx(null);
                  setLogTxOpen(true);
                }}
                className={btnPrimary}
              >
                Log Transaction
              </button>
            </div>
          ) : null
        }
      />
      <DashboardMain>
        <div className="flex flex-col gap-8 pb-8">
          <OverviewTiles
            totalBudget={totalExpected}
            totalSpent={totalActual}
            periodStart={budget.period_start}
            periodEnd={budget.period_end}
            formatCurrency={formatCurrency}
          />

          <SpendChart
            totalBudget={totalExpected}
            cumulativeByDate={cumulativeByDate}
            formatCurrency={formatCurrency}
          />

          <div>
            <SectionLabel>Spending by Category</SectionLabel>
            <CategoryGrid
              categories={categories}
              actualByCategory={actualByCategory}
              formatCurrency={formatCurrency}
              canEdit={canEdit}
              onEdit={() => setCategoryEditorOpen(true)}
              onDeleteCategory={(id) => {
                const cat = categories.find((c) => c.id === id);
                if (cat) setPendingDeleteCategory(cat);
              }}
            />
          </div>

          <div>
            <SectionLabel>Recent Transactions</SectionLabel>
            <TransactionsTable
              transactions={transactions}
              categories={categories}
              formatCurrency={formatCurrency}
              canEdit={canEdit}
              onEditTransaction={(tx) => {
                setEditingTx(tx);
                setLogTxOpen(true);
              }}
              onDeleteTransaction={(id) => {
                const tx = transactions.find((t) => t.id === id);
                if (tx) setPendingDeleteTx(tx);
              }}
            />
          </div>
        </div>
      </DashboardMain>

      <CategoryEditorDrawer
        open={categoryEditorOpen}
        onClose={() => setCategoryEditorOpen(false)}
        budgetId={budget.id}
        categories={categories}
        txCountByCategory={txCountByCategory}
        onSaved={refetch}
      />

      <LogTransactionDrawer
        open={logTxOpen}
        onClose={() => {
          setLogTxOpen(false);
          setEditingTx(null);
        }}
        budget={budget}
        categories={categories}
        editingTransaction={editingTx}
        onSaved={refetch}
      />

      <ConfirmDialog
        opened={pendingDeleteCategory !== null}
        onClose={() => setPendingDeleteCategory(null)}
        title={
          deleteCategoryBlocked
            ? `Can't delete "${pendingDeleteCategory?.name ?? ""}"`
            : `Delete category "${pendingDeleteCategory?.name ?? ""}"?`
        }
        description={
          deleteCategoryBlocked
            ? `This category has ${pendingDeleteCategoryTxCount} transaction${
                pendingDeleteCategoryTxCount === 1 ? "" : "s"
              }. Reassign or delete them first, then you can remove the category.`
            : "This permanently removes the category. This can't be undone."
        }
        confirmLabel={deleteCategoryBlocked ? "Got it" : "Delete"}
        cancelLabel={deleteCategoryBlocked ? "Close" : "Cancel"}
        danger={!deleteCategoryBlocked}
        onConfirm={async () => {
          if (!pendingDeleteCategory) return;
          if (deleteCategoryBlocked) {
            setPendingDeleteCategory(null);
            return;
          }
          const result = await deleteCategory(pendingDeleteCategory.id);
          setPendingDeleteCategory(null);
          if (result.error) {
            toast.error(result.error);
          }
          await refetch();
        }}
      />

      <ConfirmDialog
        opened={pendingDeleteTx !== null}
        onClose={() => setPendingDeleteTx(null)}
        title="Delete this transaction?"
        description={
          pendingDeleteTx
            ? `${pendingDeleteTx.title} — ${formatCurrency(Number(pendingDeleteTx.amount))}`
            : ""
        }
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          if (!pendingDeleteTx) return;
          const result = await deleteTransaction(pendingDeleteTx.id);
          setPendingDeleteTx(null);
          if (result.error) toast.error(result.error);
          await refetch();
        }}
      />
    </DashboardShell>
  );
}
