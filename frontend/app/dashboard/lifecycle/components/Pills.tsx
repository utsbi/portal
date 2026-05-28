import {
  CheckCircleIcon,
  CircleDashedIcon,
  ClockIcon,
  type Icon as PhosphorIcon,
  ProhibitIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type TaskPriorityDB,
  type TaskStatusDB,
} from "../types";

const STATUS_STYLES: Record<
  TaskStatusDB,
  { className: string; Icon: PhosphorIcon }
> = {
  not_started: {
    className: "text-sbi-muted bg-white/5 border-white/10",
    Icon: CircleDashedIcon,
  },
  in_progress: {
    className: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    Icon: ClockIcon,
  },
  pending_approval: {
    className: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    Icon: WarningIcon,
  },
  blocked: {
    className: "text-red-400 bg-red-400/10 border-red-400/20",
    Icon: ProhibitIcon,
  },
  completed: {
    className: "text-sbi-green bg-sbi-green/10 border-sbi-green/20",
    Icon: CheckCircleIcon,
  },
};

export function TaskStatusPill({
  status,
  className,
}: {
  status: TaskStatusDB;
  className?: string;
}) {
  const { className: variantClass, Icon } = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border backdrop-blur-sm whitespace-nowrap",
        variantClass,
        className,
      )}
    >
      <Icon size={14} weight="bold" />
      {TASK_STATUS_LABELS[status]}
    </span>
  );
}

const PRIORITY_STYLES: Record<TaskPriorityDB, string> = {
  extreme: "text-red-400 bg-red-400/10 border-red-400/20",
  high: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  medium: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  low: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  stretch: "text-sbi-muted bg-white/5 border-white/10",
};

const PRIORITY_DOT: Record<TaskPriorityDB, string> = {
  extreme: "bg-red-400",
  high: "bg-orange-400",
  medium: "bg-amber-400",
  low: "bg-blue-400",
  stretch: "bg-sbi-muted",
};

export function PriorityPill({
  priority,
  className,
}: {
  priority: TaskPriorityDB;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap",
        PRIORITY_STYLES[priority],
        className,
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", PRIORITY_DOT[priority])}
      />
      {TASK_PRIORITY_LABELS[priority]}
    </span>
  );
}

export function PriorityDot({
  priority,
  className,
}: {
  priority: TaskPriorityDB;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={`Priority: ${TASK_PRIORITY_LABELS[priority]}`}
      className={cn(
        "inline-block h-2 w-2 rounded-full",
        PRIORITY_DOT[priority],
        className,
      )}
    />
  );
}
