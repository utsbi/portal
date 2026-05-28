"use client";

import { Pencil, Trash2 } from "lucide-react";
import { type ColumnDef, DataTable } from "@/components/data-table";
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

export function TransactionsTable({
  transactions,
  categories,
  formatCurrency,
  canEdit,
  onEditTransaction,
  onDeleteTransaction,
}: TransactionsTableProps) {
  const categoryById = new Map(categories.map((c) => [c.id, c.name] as const));

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
      render: (_v, row) => (
        <div className="flex flex-col">
          <span className="text-white">{row.title}</span>
          {row.description ? (
            <span className="text-xs text-sbi-muted-dark truncate">
              {row.description}
            </span>
          ) : null}
        </div>
      ),
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
    <DataTable<BudgetTransaction>
      data={transactions}
      columns={columns}
      rowKey="id"
      searchable
      searchKeys={["title", "description"]}
      searchPlaceholder="Search transactions…"
      pageSize={10}
    />
  );
}
