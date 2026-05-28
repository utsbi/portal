import type { Task, TaskStatusDB } from "../types";

/** Hex equivalents of the Tailwind status colors, for recharts fills. */
export const STATUS_HEX: Record<TaskStatusDB, string> = {
  not_started: "#6b7c74",
  in_progress: "#60a5fa",
  pending_approval: "#f59e0b",
  blocked: "#f87171",
  completed: "#22c55e",
};

/** Order the statuses are surfaced in chips and donut: attention-first. */
export const STATUS_DISPLAY_ORDER: TaskStatusDB[] = [
  "blocked",
  "pending_approval",
  "in_progress",
  "not_started",
  "completed",
];

/** Tailwind classes per status for chips / count badges. Shared by
 * StatusChips and ProjectHeroCard so the palette stays in one place. */
export const STATUS_CHIP_STYLE: Record<
  TaskStatusDB,
  { text: string; dot: string; border: string; activeBg: string }
> = {
  blocked: {
    text: "text-red-400",
    dot: "bg-red-400",
    border: "border-red-400/30",
    activeBg: "bg-red-400/15",
  },
  pending_approval: {
    text: "text-amber-400",
    dot: "bg-amber-400",
    border: "border-amber-400/25",
    activeBg: "bg-amber-400/15",
  },
  in_progress: {
    text: "text-blue-400",
    dot: "bg-blue-400",
    border: "border-blue-400/25",
    activeBg: "bg-blue-400/15",
  },
  not_started: {
    text: "text-sbi-muted",
    dot: "bg-sbi-muted",
    border: "border-white/10",
    activeBg: "bg-white/10",
  },
  completed: {
    text: "text-sbi-green",
    dot: "bg-sbi-green",
    border: "border-sbi-green/25",
    activeBg: "bg-sbi-green/15",
  },
};

export type StatusCounts = Record<TaskStatusDB, number>;

export function countByStatus(tasks: Task[]): StatusCounts {
  const counts: StatusCounts = {
    not_started: 0,
    in_progress: 0,
    pending_approval: 0,
    blocked: 0,
    completed: 0,
  };
  for (const t of tasks) counts[t.status] += 1;
  return counts;
}
