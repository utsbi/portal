"use client";

import { Wallet } from "lucide-react";
import { btnPrimary, EmptyState } from "@/components/dashboard/common/ui";

interface EmptyBudgetStateProps {
  canEdit: boolean;
  onSetUp?: () => void;
}

export function EmptyBudgetState({ canEdit, onSetUp }: EmptyBudgetStateProps) {
  return (
    <EmptyState
      icon={<Wallet className="h-6 w-6" />}
      title="No budget set up yet"
      description={
        canEdit
          ? "Set the budget period and currency to start tracking spend."
          : "Your project budget hasn't been set up yet. Check back soon."
      }
      action={
        canEdit && onSetUp ? (
          <button type="button" onClick={onSetUp} className={btnPrimary}>
            Set Up Budget
          </button>
        ) : null
      }
    />
  );
}
