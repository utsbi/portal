"use client";

import { useEffect, useState } from "react";
import { createBudget } from "@/app/dashboard/finances/actions";
import { DatePicker } from "@/components/dashboard/common/DateTimePicker";
import { btnGhost, btnPrimary, Modal } from "@/components/dashboard/common/ui";

interface SetupBudgetDrawerProps {
  open: boolean;
  onClose: () => void;
  projectId: number;
  onCreated: () => void | Promise<void>;
}

const todayIso = () => new Date().toISOString().slice(0, 10);
const oneYearFromIso = (iso: string) => {
  const d = new Date(iso);
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
};

export function SetupBudgetDrawer({
  open,
  onClose,
  projectId,
  onCreated,
}: SetupBudgetDrawerProps) {
  const [periodStart, setPeriodStart] = useState(todayIso());
  const [periodEnd, setPeriodEnd] = useState(oneYearFromIso(todayIso()));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  useEffect(() => {
    if (open) {
      const today = todayIso();
      setPeriodStart(today);
      setPeriodEnd(oneYearFromIso(today));
      setError(null);
    }
  }, [open]);

  async function onSubmit() {
    setSubmitting(true);
    setError(null);
    const result = await createBudget({
      projectId,
      periodStart,
      periodEnd,
      currency: "USD",
    });
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onClose();
    await onCreated();
  }

  return (
    <Modal
      opened={open}
      onClose={onClose}
      title="Set up project budget"
      contentClassName={datePickerOpen ? "overflow-visible" : undefined}
      bodyClassName={datePickerOpen ? "overflow-visible" : undefined}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-sbi-muted">
          Define the budget period. You can add categories and log transactions
          after.
        </p>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-[0.15em] text-sbi-muted">
            Period start
          </span>
          <DatePicker
            value={periodStart}
            onChange={setPeriodStart}
            onOpenChange={setDatePickerOpen}
            ariaLabel="Budget period start"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-[0.15em] text-sbi-muted">
            Period end
          </span>
          <DatePicker
            value={periodEnd}
            onChange={setPeriodEnd}
            onOpenChange={setDatePickerOpen}
            ariaLabel="Budget period end"
          />
        </div>
        <p className="text-xs text-sbi-muted-dark">
          Currency: USD (multi-currency comes later.)
        </p>

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
            disabled={submitting || periodEnd < periodStart}
          >
            {submitting ? "Creating…" : "Create Budget"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
