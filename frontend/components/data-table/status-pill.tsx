"use client";

import {
  CheckCircleIcon,
  ClockIcon,
  type Icon as PhosphorIcon,
  ProhibitIcon,
  QuestionIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export type StatusVariant =
  | "done"
  | "in-progress"
  | "pending"
  | "denied"
  | "unknown";

interface StatusConfig {
  label: string;
  icon: PhosphorIcon;
  className: string;
}

const STATUS_MAP: Record<StatusVariant, StatusConfig> = {
  done: {
    label: "Done",
    icon: CheckCircleIcon,
    className: "text-sbi-green bg-sbi-green/10 border-sbi-green/20",
  },
  "in-progress": {
    label: "In Progress",
    icon: ClockIcon,
    className: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  },
  pending: {
    label: "Pending",
    icon: WarningIcon,
    className: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  },
  denied: {
    label: "Denied",
    icon: ProhibitIcon,
    className: "text-red-400 bg-red-400/10 border-red-400/20",
  },
  unknown: {
    label: "Unknown",
    icon: QuestionIcon,
    className: "text-sbi-muted bg-white/5 border-white/10",
  },
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
  const config = STATUS_MAP[variant];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border backdrop-blur-sm whitespace-nowrap",
        config.className,
        className,
      )}
    >
      <Icon size={14} weight="bold" />
      {config.label}
    </span>
  );
}
