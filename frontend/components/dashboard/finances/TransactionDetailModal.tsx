"use client";

import { Pencil, Trash2 } from "lucide-react";
import { btnGhost, btnPrimary, Modal } from "@/components/dashboard/common/ui";
import type { BudgetTransaction } from "./types";

interface TransactionDetailModalProps {
  transaction: BudgetTransaction | null;
  categoryName: string;
  formatCurrency: (n: number) => string;
  canEdit: boolean;
  onClose: () => void;
  onEdit: (tx: BudgetTransaction) => void;
  onDelete: (id: number) => void;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

export function TransactionDetailModal({
  transaction,
  categoryName,
  formatCurrency,
  canEdit,
  onClose,
  onEdit,
  onDelete,
}: TransactionDetailModalProps) {
  return (
    <Modal
      opened={transaction !== null}
      onClose={onClose}
      title={transaction?.title ?? "Transaction"}
      uppercaseTitle={false}
      footer={
        canEdit && transaction ? (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className={btnGhost}
              onClick={() => onDelete(transaction.id)}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
            <button
              type="button"
              className={btnPrimary}
              onClick={() => onEdit(transaction)}
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          </div>
        ) : null
      }
    >
      {transaction ? (
        <div className="flex flex-col gap-5">
          <div>
            <div className="text-3xl font-thin tracking-tight tabular-nums text-white">
              {formatCurrency(Number(transaction.amount))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] tracking-[0.2em] uppercase text-sbi-muted-dark mb-1">
                Date
              </div>
              <div className="text-sm text-white tabular-nums">
                {dateFormatter.format(new Date(transaction.occurred_on))}
              </div>
            </div>
            <div>
              <div className="text-[10px] tracking-[0.2em] uppercase text-sbi-muted-dark mb-1">
                Category
              </div>
              <span className="inline-block text-[10px] uppercase tracking-[0.15em] px-2 py-0.5 rounded border border-sbi-dark-border/60 text-sbi-muted">
                {categoryName}
              </span>
            </div>
          </div>

          <div>
            <div className="text-[10px] tracking-[0.2em] uppercase text-sbi-muted-dark mb-1">
              Description
            </div>
            {transaction.description ? (
              <p className="text-sm text-sbi-muted whitespace-pre-wrap leading-relaxed">
                {transaction.description}
              </p>
            ) : (
              <p className="text-sm text-sbi-muted-dark italic">
                No description.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
