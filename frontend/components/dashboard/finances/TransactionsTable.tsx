"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { type ColumnDef, DataTable } from "@/components/data-table";
import { TransactionDetailModal } from "./TransactionDetailModal";
import type { BudgetCategory, BudgetTransaction } from "./types";

interface TransactionsTableProps {
  transactions: BudgetTransaction[];
  categories: BudgetCategory[];
  formatCurrency: (n: number) => string;
  canEdit: boolean;
  onEditTransaction?: (tx: BudgetTransaction) => void;
  onDeleteTransaction?: (id: number) => void;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

/** First line of the description; appends an ellipsis if more lines follow. */
function descriptionPreview(description: string | null): string | null {
  if (!description) return null;
  const [first, ...rest] = description.split("\n");
  const hasMore = rest.some((line) => line.trim().length > 0);
  return hasMore ? `${first}…` : first;
}

export function TransactionsTable({
  transactions,
  categories,
  formatCurrency,
  canEdit,
  onEditTransaction,
  onDeleteTransaction,
}: TransactionsTableProps) {
  const categoryById = new Map(categories.map((c) => [c.id, c.name] as const));
  const [selectedTx, setSelectedTx] = useState<BudgetTransaction | null>(null);

  const columns: ColumnDef<BudgetTransaction>[] = [
    {
      accessor: "occurred_on",
      header: "Date",
      sortable: true,
      width: "w-32",
      render: (v) => (
        <span className="text-sbi-muted tabular-nums">
          {dateFormatter.format(new Date(String(v)))}
        </span>
      ),
    },
    {
      accessor: "title",
      header: "Transaction",
      sortable: true,
      render: (_v, row) => {
        const preview = descriptionPreview(row.description);
        return (
          <div className="flex flex-col min-w-0 max-w-[420px]">
            <span className="text-white truncate">{row.title}</span>
            {preview ? (
              <span className="text-xs text-sbi-muted-dark truncate">
                {preview}
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      accessor: "category_id",
      header: "Category",
      width: "w-44",
      render: (v) => (
        <span className="text-[10px] uppercase tracking-[0.15em] px-2 py-0.5 rounded border border-sbi-dark-border/60 text-sbi-muted">
          {categoryById.get(Number(v)) ?? "—"}
        </span>
      ),
    },
    {
      accessor: "amount",
      header: "Amount",
      sortable: true,
      align: "right",
      width: "w-32",
      render: (v) => (
        <span className="text-white tabular-nums">
          {formatCurrency(Number(v))}
        </span>
      ),
    },
  ];

  if (canEdit) {
    columns.push({
      accessor: "id",
      header: "",
      width: "w-20",
      align: "right",
      render: (_v, row) => (
        <div className="flex items-center justify-end gap-1">
          {onEditTransaction ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEditTransaction(row);
              }}
              className="p-1 text-sbi-muted hover:text-white rounded"
              aria-label="Edit transaction"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {onDeleteTransaction ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteTransaction(row.id);
              }}
              className="p-1 text-sbi-muted hover:text-rose-400 rounded"
              aria-label="Delete transaction"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      ),
    });
  }

  return (
    <>
      <DataTable<BudgetTransaction>
        data={transactions}
        columns={columns}
        rowKey="id"
        searchable
        searchKeys={["title", "description"]}
        searchPlaceholder="Search transactions…"
        pageSize={10}
        primaryColumn="title"
        onRowClick={(row) => setSelectedTx(row)}
      />

      <TransactionDetailModal
        transaction={selectedTx}
        categoryName={
          selectedTx ? (categoryById.get(selectedTx.category_id) ?? "—") : "—"
        }
        formatCurrency={formatCurrency}
        canEdit={canEdit}
        onClose={() => setSelectedTx(null)}
        onEdit={(tx) => {
          setSelectedTx(null);
          onEditTransaction?.(tx);
        }}
        onDelete={(id) => {
          setSelectedTx(null);
          onDeleteTransaction?.(id);
        }}
      />
    </>
  );
}
