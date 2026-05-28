"use client";

import { useEffect, useState } from "react";
import {
  logTransaction,
  updateTransaction,
} from "@/app/dashboard/finances/actions";
import { btnGhost, btnPrimary, Modal } from "@/components/dashboard/common/ui";
import { SearchableDropdown } from "@/components/ui/searchable-dropdown";
import type { BudgetCategory, BudgetTransaction, ProjectBudget } from "./types";

interface LogTransactionDrawerProps {
  open: boolean;
  onClose: () => void;
  budget: ProjectBudget;
  categories: BudgetCategory[];
  editingTransaction: BudgetTransaction | null;
  onSaved: () => void | Promise<void>;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

function parseAmount(input: string): number {
  const cleaned = input.replace(/[^\d.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function LogTransactionDrawer({
  open,
  onClose,
  budget,
  categories,
  editingTransaction,
  onSaved,
}: LogTransactionDrawerProps) {
  const [occurredOn, setOccurredOn] = useState(todayIso());
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [amountStr, setAmountStr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editingTransaction) {
      setOccurredOn(editingTransaction.occurred_on);
      setTitle(editingTransaction.title);
      setDescription(editingTransaction.description ?? "");
      setCategoryId(editingTransaction.category_id);
      setAmountStr(String(editingTransaction.amount));
    } else {
      setOccurredOn(todayIso());
      setTitle("");
      setDescription("");
      setCategoryId(categories[0]?.id ?? null);
      setAmountStr("");
    }
    setError(null);
  }, [open, editingTransaction, categories]);

  const outOfPeriod =
    occurredOn < budget.period_start || occurredOn > budget.period_end;

  async function onSubmit() {
    setSubmitting(true);
    setError(null);
    const amount = parseAmount(amountStr);
    if (!title.trim()) {
      setError("Add a title.");
      setSubmitting(false);
      return;
    }
    if (!categoryId) {
      setError("Pick a category.");
      setSubmitting(false);
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Amount must be greater than 0.");
      setSubmitting(false);
      return;
    }

    const result = editingTransaction
      ? await updateTransaction(editingTransaction.id, {
          category_id: categoryId,
          occurred_on: occurredOn,
          title,
          description,
          amount,
        })
      : await logTransaction({
          budget_id: budget.id,
          category_id: categoryId,
          occurred_on: occurredOn,
          title,
          description,
          amount,
        });

    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onClose();
    await onSaved();
  }

  return (
    <Modal
      opened={open}
      onClose={onClose}
      title={editingTransaction ? "Edit transaction" : "Log transaction"}
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] tracking-[0.2em] uppercase text-sbi-muted-dark">
            Date
          </span>
          <input
            type="date"
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
            className="px-3 h-9 text-sm bg-sbi-dark-card/40 border border-sbi-dark-border/50 rounded text-white focus:outline-none focus:border-sbi-green/40"
          />
          {outOfPeriod ? (
            <span className="text-[11px] text-amber-400">
              Date is outside the budget period ({budget.period_start} →{" "}
              {budget.period_end}). Saving anyway.
            </span>
          ) : null}
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] tracking-[0.2em] uppercase text-sbi-muted-dark">
            Title
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Figma annual subscription"
            className="px-3 h-9 text-sm bg-sbi-dark-card/40 border border-sbi-dark-border/50 rounded text-white placeholder:text-sbi-muted-dark focus:outline-none focus:border-sbi-green/40"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] tracking-[0.2em] uppercase text-sbi-muted-dark">
            Description{" "}
            <span className="text-sbi-muted-dark/60 normal-case tracking-normal">
              (optional)
            </span>
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Additional detail about this expense"
            rows={2}
            className="px-3 py-2 text-sm bg-sbi-dark-card/40 border border-sbi-dark-border/50 rounded text-white placeholder:text-sbi-muted-dark focus:outline-none focus:border-sbi-green/40 resize-none"
          />
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] tracking-[0.2em] uppercase text-sbi-muted-dark">
            Category
          </span>
          <SearchableDropdown
            value={categoryId ? String(categoryId) : ""}
            onChange={(v) => setCategoryId(v ? Number(v) : null)}
            options={categories.map((c) => ({
              value: String(c.id),
              label: c.name,
            }))}
            placeholder="Select a category"
            className="w-full"
          />
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] tracking-[0.2em] uppercase text-sbi-muted-dark">
            Amount (USD)
          </span>
          <div className="flex items-center gap-1">
            <span className="text-sm text-sbi-muted">$</span>
            <input
              type="text"
              inputMode="decimal"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="0.00"
              className="px-3 h-9 text-sm bg-sbi-dark-card/40 border border-sbi-dark-border/50 rounded text-white text-right tabular-nums w-full focus:outline-none focus:border-sbi-green/40"
            />
          </div>
        </label>

        {error ? <p className="text-sm text-rose-400">{error}</p> : null}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            className={btnGhost}
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className={btnPrimary}
            onClick={onSubmit}
            disabled={submitting}
          >
            {submitting
              ? "Saving…"
              : editingTransaction
                ? "Save"
                : "Log Transaction"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
