"use client";

import { cn } from "@/lib/utils";
import { TASK_STATUS_LABELS, type TaskStatusDB } from "../types";
import {
  STATUS_CHIP_STYLE,
  STATUS_DISPLAY_ORDER,
  type StatusCounts,
} from "./status-meta";

interface StatusChipsProps {
  counts: StatusCounts;
  active: TaskStatusDB | null;
  onSelect: (status: TaskStatusDB | null) => void;
}

export function StatusChips({ counts, active, onSelect }: StatusChipsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {STATUS_DISPLAY_ORDER.map((status) => {
        const c = STATUS_CHIP_STYLE[status];
        const isActive = active === status;
        return (
          <button
            key={status}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(isActive ? null : status)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              c.text,
              c.border,
              isActive ? c.activeBg : "bg-transparent hover:bg-white/5",
              isActive && "shadow-[inset_0_0_0_1px_currentColor]",
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
            {TASK_STATUS_LABELS[status]}
            <span className="tabular-nums opacity-70">· {counts[status]}</span>
          </button>
        );
      })}
    </div>
  );
}
