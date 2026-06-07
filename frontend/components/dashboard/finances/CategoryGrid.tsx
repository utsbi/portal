"use client";

import { Pencil, Tag, Trash2 } from "lucide-react";
import { EmptyState, Panel } from "@/components/dashboard/common/ui";
import type { BudgetCategory } from "./types";

interface CategoryGridProps {
  categories: BudgetCategory[];
  actualByCategory: Map<number, number>;
  formatCurrency: (n: number) => string;
  canEdit: boolean;
  onEdit?: () => void;
  onDeleteCategory?: (id: number) => void;
}

export function CategoryGrid({
  categories,
  actualByCategory,
  formatCurrency,
  canEdit,
  onEdit,
  onDeleteCategory,
}: CategoryGridProps) {
  if (categories.length === 0) {
    return (
      <Panel>
        <EmptyState
          icon={<Tag className="h-6 w-6" />}
          title="No categories yet"
          description={
            canEdit
              ? "Add categories to start defining your budget allocation."
              : "Categories will appear here once your director sets them up."
          }
        />
      </Panel>
    );
  }

  const totalExpected = categories.reduce(
    (s, c) => s + Number(c.expected_amount),
    0,
  );
  const totalActual = categories.reduce(
    (s, c) => s + (actualByCategory.get(c.id) ?? 0),
    0,
  );

  return (
    <div className="rounded-lg border border-white/[0.06] bg-sbi-dark-card overflow-hidden">
      <div className="grid grid-cols-[minmax(0,1fr)_120px_120px_130px_56px] gap-4 px-5 py-2.5 text-[10px] tracking-[0.2em] uppercase text-sbi-muted-dark bg-sbi-dark-btn/50 border-b border-white/[0.04]">
        <div>Category</div>
        <div className="text-right">Expected</div>
        <div className="text-right">Actual</div>
        <div className="text-right">Variance</div>
        <div />
      </div>
      {categories.map((cat) => {
        const expected = Number(cat.expected_amount);
        const actual = actualByCategory.get(cat.id) ?? 0;
        const variance = expected - actual;
        const varClass = variance >= 0 ? "text-emerald-400" : "text-rose-400";
        const sign = variance >= 0 ? "+" : "−";
        return (
          <div
            key={cat.id}
            className="group grid grid-cols-[minmax(0,1fr)_120px_120px_130px_56px] gap-4 items-center px-5 py-3 border-b border-white/[0.04] transition-colors hover:bg-white/[0.04]"
          >
            <div className="text-sm font-medium text-white truncate">
              {cat.name}
            </div>
            <div className="text-sm text-sbi-muted text-right tabular-nums">
              {formatCurrency(expected)}
            </div>
            <div className="text-sm text-white text-right tabular-nums">
              {formatCurrency(actual)}
            </div>
            <div className={`text-sm text-right tabular-nums ${varClass}`}>
              {sign}
              {formatCurrency(Math.abs(variance))}
            </div>
            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {canEdit && onEdit ? (
                <button
                  type="button"
                  onClick={onEdit}
                  className="p-1.5 rounded-md text-sbi-muted hover:text-sbi-green hover:bg-sbi-green/10 transition-colors"
                  aria-label={`Edit ${cat.name}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              ) : null}
              {canEdit && onDeleteCategory ? (
                <button
                  type="button"
                  onClick={() => onDeleteCategory(cat.id)}
                  className="p-1.5 rounded-md text-sbi-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  aria-label={`Delete ${cat.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
      <div className="grid grid-cols-[minmax(0,1fr)_120px_120px_130px_56px] gap-4 items-center px-5 py-3 bg-sbi-dark-btn/30">
        <div className="text-[11px] tracking-[0.15em] uppercase text-sbi-muted">
          Total
        </div>
        <div className="text-sm text-white text-right tabular-nums">
          {formatCurrency(totalExpected)}
        </div>
        <div className="text-sm text-white text-right tabular-nums">
          {formatCurrency(totalActual)}
        </div>
        <div
          className={`text-sm font-medium text-right tabular-nums ${
            totalExpected - totalActual >= 0
              ? "text-emerald-400"
              : "text-rose-400"
          }`}
        >
          {totalExpected - totalActual >= 0 ? "+" : "−"}
          {formatCurrency(Math.abs(totalExpected - totalActual))}
        </div>
        <div />
      </div>
    </div>
  );
}
