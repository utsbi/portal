"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { upsertCategories } from "@/app/dashboard/finances/actions";
import { btnGhost, btnPrimary, Modal } from "@/components/dashboard/common/ui";
import type { BudgetCategory, CategoryDraft } from "./types";

interface CategoryEditorDrawerProps {
  open: boolean;
  onClose: () => void;
  budgetId: number;
  categories: BudgetCategory[];
  onSaved: () => void | Promise<void>;
}

type DraftRow = CategoryDraft & { _key: string };

function makeKey() {
  return `new-${Math.random().toString(36).slice(2, 9)}`;
}

export function CategoryEditorDrawer({
  open,
  onClose,
  budgetId,
  categories,
  onSaved,
}: CategoryEditorDrawerProps) {
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setRows(
        categories.map((c) => ({
          _key: String(c.id),
          id: c.id,
          name: c.name,
          expected_amount: Number(c.expected_amount),
          sort_order: c.sort_order,
        })),
      );
      setError(null);
    }
  }, [open, categories]);

  function updateRow(key: string, patch: Partial<DraftRow>) {
    setRows((rs) => rs.map((r) => (r._key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: string) {
    setRows((rs) => rs.filter((r) => r._key !== key));
  }

  function addRow() {
    setRows((rs) => [
      ...rs,
      {
        _key: makeKey(),
        name: "",
        expected_amount: 0,
        sort_order: rs.length,
      },
    ]);
  }

  async function onSubmit() {
    setSubmitting(true);
    setError(null);
    const drafts: CategoryDraft[] = rows
      .filter((r) => r.name.trim().length > 0)
      .map((r, i) => ({
        id: r.id,
        name: r.name,
        expected_amount: Number(r.expected_amount) || 0,
        sort_order: i,
      }));

    if (drafts.length === 0) {
      setError("Add at least one category.");
      setSubmitting(false);
      return;
    }

    const result = await upsertCategories(budgetId, drafts);
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
      title="Edit budget categories"
      size="lg"
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-sbi-muted">
          Each category has an expected amount. Actual is computed from
          transactions.
        </p>

        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[minmax(0,1fr)_140px_32px] gap-2 text-[10px] tracking-[0.2em] uppercase text-sbi-muted-dark px-1">
            <div>Name</div>
            <div className="text-right">Expected ($)</div>
            <div />
          </div>
          {rows.map((row) => (
            <div
              key={row._key}
              className="grid grid-cols-[minmax(0,1fr)_140px_32px] gap-2 items-center"
            >
              <input
                type="text"
                value={row.name}
                placeholder="e.g. Design & Development"
                onChange={(e) => updateRow(row._key, { name: e.target.value })}
                className="px-3 h-9 text-sm bg-sbi-dark-card/40 border border-sbi-dark-border/50 rounded text-white placeholder:text-sbi-muted-dark focus:outline-none focus:border-sbi-green/40"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                value={row.expected_amount}
                onChange={(e) =>
                  updateRow(row._key, {
                    expected_amount: Number(e.target.value),
                  })
                }
                className="px-3 h-9 text-sm bg-sbi-dark-card/40 border border-sbi-dark-border/50 rounded text-white text-right tabular-nums focus:outline-none focus:border-sbi-green/40"
              />
              <button
                type="button"
                onClick={() => removeRow(row._key)}
                className="p-2 text-sbi-muted hover:text-rose-400 rounded"
                aria-label="Remove row"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addRow}
            className="self-start inline-flex items-center gap-1 text-xs text-sbi-green hover:text-sbi-green/80 mt-1"
          >
            <Plus className="h-3.5 w-3.5" /> Add category
          </button>
        </div>

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
            {submitting ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
