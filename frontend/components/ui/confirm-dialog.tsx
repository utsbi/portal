"use client";

import { AlertTriangle } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Modal } from "@/components/dashboard/common/Modal";
import {
  btnDanger,
  btnGhost,
  btnPrimary,
  inputClass,
  labelClass,
} from "@/components/dashboard/common/ui";
import { cn } from "@/lib/utils";

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
            <label className={cn(labelClass, "block mb-2")}>
              Type{" "}
              <span className="text-white font-medium normal-case">
                {confirmationText}
              </span>{" "}
              to confirm
              <input
                type="text"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                disabled={isWorking}
                className={cn(inputClass, "mt-2")}
                placeholder={confirmationText}
              />
            </label>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={isWorking}
            className={cn(btnGhost, "h-9 px-4")}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={cn(danger ? btnDanger : btnPrimary, "h-9 px-4")}
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
