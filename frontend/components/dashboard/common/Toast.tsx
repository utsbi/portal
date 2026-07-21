"use client";

import { Check, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

export type ToastKind = "success" | "error" | "info";

const ICON: Record<ToastKind, { Icon: typeof Check; color: string }> = {
  success: { Icon: Check, color: "text-sbi-green" },
  error: { Icon: TriangleAlert, color: "text-red-400" },
  info: { Icon: Info, color: "text-sbi-muted" },
};

interface ToastProps {
  kind: ToastKind;
  title?: string;
  message: ReactNode;
}

/**
 * Quiet confirmation toast: one small status glyph, one line of text. No
 * icon chip, no close button, no countdown bar, no backdrop blur. sonner
 * owns stacking, swipe-to-dismiss, auto-dismiss, and enter/exit.
 */
export function Toast({ kind, title, message }: ToastProps) {
  const { Icon, color } = ICON[kind];

  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      aria-live={kind === "error" ? "assertive" : "polite"}
      aria-atomic="true"
      className="font-urbanist flex w-fit min-w-[240px] max-w-[min(380px,calc(100vw-2rem))] items-start gap-3 rounded-xl border border-sbi-dark-border/60 bg-sbi-dark-card px-4 py-3 shadow-[0_16px_48px_-16px_rgba(0,0,0,0.75)]"
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
      <div className="min-w-0 flex-1">
        {title ? (
          <p className="text-sm font-medium leading-snug text-white">{title}</p>
        ) : null}
        <div
          className={
            title
              ? "mt-0.5 text-[0.8rem] leading-snug text-sbi-muted"
              : "text-[0.8rem] leading-snug text-white"
          }
        >
          {message}
        </div>
      </div>
    </div>
  );
}
