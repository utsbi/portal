"use client";

import type { LucideIcon } from "lucide-react";
import {
  Ban,
  CircleCheck,
  CircleHelp,
  Clock,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type StatusVariant =
  | "done"
  | "in-progress"
  | "pending"
  | "denied"
  | "unknown";

/**
 * Canonical status → visual-token mapping.
 * Both StatusPill and any Badge-based status usages should consume this
 * instead of defining their own color literals.
 */
export const STATUS_INTENT: Record<
  StatusVariant,
  { label: string; className: string }
> = {
  done: {
    label: "Done",
    className: "text-sbi-green bg-sbi-green/10 border-sbi-green/20",
  },
  "in-progress": {
    label: "In Progress",
    className: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  },
  pending: {
    label: "Pending",
    className: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  },
  denied: {
    label: "Denied",
    className: "text-red-400 bg-red-400/10 border-red-400/20",
  },
  unknown: {
    label: "Unknown",
    className: "text-sbi-muted bg-white/5 border-white/10",
  },
};

const STATUS_ICON: Record<StatusVariant, LucideIcon> = {
  done: CircleCheck,
  "in-progress": Clock,
  pending: TriangleAlert,
  denied: Ban,
  unknown: CircleHelp,
};

// Normalize different status string formats to our variant keys.
// Unrecognized values render as "Unknown" (not silently "Pending") so bad
// data is visible rather than masquerading as a valid state.
function normalizeStatus(status: string): StatusVariant {
  const lower = status.toLowerCase().replace(/\s+/g, "-");
  if (lower === "done" || lower === "complete" || lower === "completed")
    return "done";
  if (lower === "in-progress" || lower === "in-process") return "in-progress";
  if (lower === "pending") return "pending";
  if (lower === "denied" || lower === "rejected") return "denied";
  if (process.env.NODE_ENV !== "production") {
    console.warn(`StatusPill: unrecognized status "${status}" → "unknown"`);
  }
  return "unknown";
}

interface StatusPillProps {
  status: string;
  className?: string;
}

export function StatusPill({ status, className }: StatusPillProps) {
  const variant = normalizeStatus(status);
  const { label, className: intentClass } = STATUS_INTENT[variant];
  const Icon = STATUS_ICON[variant];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border backdrop-blur-sm whitespace-nowrap",
        intentClass,
        className,
      )}
    >
      <Icon size={14} strokeWidth={2.5} />
      {label}
    </span>
  );
}
