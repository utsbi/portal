"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/dashboard/common/Modal";

interface ConfirmDialogProps {
  opened: boolean;
  onClose: () => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /**
   * If provided, the user must type this exact string (case-insensitive)
   * before the confirm button enables. Use for high-risk destructive actions.
   */
  confirmationText?: string;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  opened,
  onClose,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  confirmationText,
  onConfirm,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  const typedMatches = confirmationText
    ? typed.trim().toLowerCase() === confirmationText.trim().toLowerCase()
    : true;
  const canConfirm = typedMatches && !isWorking;

  const handleConfirm = async () => {
    setIsWorking(true);
    try {
      await onConfirm();
    } finally {
      setIsWorking(false);
      setTyped("");
    }
  };

  const handleClose = () => {
    if (isWorking) return;
    setTyped("");
    onClose();
  };

  return (
    <Modal opened={opened} onClose={handleClose} hideClose size="sm">
      <div>
        <div className="flex items-start gap-3 mb-4">
          {danger && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-light tracking-tight text-white mb-1">
              {title}
            </h2>
            <div className="text-sm text-sbi-muted leading-relaxed">
              {description}
            </div>
          </div>
        </div>

        {confirmationText && (
          <div className="mb-5 mt-2">
            <label className="block text-xs uppercase tracking-[0.15em] text-sbi-muted mb-2">
              Type{" "}
              <span className="text-white font-medium normal-case">
                {confirmationText}
              </span>{" "}
              to confirm
            </label>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={isWorking}
              autoFocus
              className="w-full bg-sbi-dark-card border border-sbi-dark-border/50 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-sbi-green/50 transition-colors disabled:opacity-50"
              placeholder={confirmationText}
            />
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={isWorking}
            className="cursor-pointer rounded-md border border-sbi-dark-border/50 px-4 py-2 text-xs font-medium text-sbi-muted hover:text-white hover:border-sbi-dark-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={[
              "inline-flex items-center gap-2 rounded-md px-4 py-2 text-xs font-medium uppercase tracking-[0.04em] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
              danger
                ? "bg-red-500/15 text-red-300 border border-red-500/40 hover:bg-red-500/25 hover:text-red-200"
                : "bg-sbi-green text-sbi-dark hover:bg-sbi-green/90",
            ].join(" ")}
          >
            {isWorking ? (
              <>
                <span className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Working…
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
