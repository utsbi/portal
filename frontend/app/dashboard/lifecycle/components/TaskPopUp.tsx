"use client";

import {
  Calendar as CalendarIcon,
  Flag,
  Pencil,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { useState } from "react";
import { btnGhost, btnPrimary, Modal } from "@/components/dashboard/common/ui";
import { toastError, toastSuccess } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import {
  TASK_STATUS_LABELS,
  type Task,
  type TaskStatusDB,
  TEAM_NAME_LABELS,
} from "../types";
import { PriorityPill, TaskStatusPill } from "./Pills";
import { STATUS_DISPLAY_ORDER } from "./status-meta";

type TaskPopUpProps = {
  task: Task | null;
  onClose: () => void;
  /** Directors may change status; everyone else is read-only. */
  canEdit?: boolean;
  onStatusChange?: (taskId: number, status: TaskStatusDB) => Promise<boolean>;
  /** Director-only: open the full edit form for this task. */
  onEdit?: () => void;
  /** Director-only: request deletion of this task. */
  onDelete?: () => void;
};

function MetaRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 text-sbi-green mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.15em] text-sbi-muted mb-0.5">
          {label}
        </p>
        <div className="text-sm text-white">{value}</div>
      </div>
    </div>
  );
}

function formatLongDate(value: Date) {
  return value.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatShortDateTime(value: Date) {
  return value.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TaskPopUp({
  task,
  onClose,
  canEdit = false,
  onStatusChange,
  onEdit,
  onDelete,
}: TaskPopUpProps) {
  const [saving, setSaving] = useState<TaskStatusDB | null>(null);

  if (!task) return null;

  const handleStatus = async (next: TaskStatusDB) => {
    if (next === task.status || saving || !onStatusChange) return;
    setSaving(next);
    const ok = await onStatusChange(task.id, next);
    setSaving(null);
    if (ok) {
      toastSuccess(`Status set to ${TASK_STATUS_LABELS[next]}.`);
    } else {
      toastError("Couldn't update status.");
    }
  };

  const title = (
    <span className="flex items-center gap-3">
      <span className="truncate text-white normal-case tracking-normal">
        {task.title}
      </span>
      <TaskStatusPill status={task.status} />
    </span>
  );

  const footer =
    canEdit && onStatusChange ? (
      <div className="flex flex-wrap items-center gap-3">
        <span className="shrink-0 text-[10px] uppercase tracking-[0.15em] text-sbi-muted">
          Set status
        </span>
        <div className="flex flex-wrap gap-2">
          {STATUS_DISPLAY_ORDER.map((s) => {
            const isActive = task.status === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => handleStatus(s)}
                disabled={saving !== null}
                aria-pressed={isActive}
                className={cn(
                  isActive ? btnPrimary : btnGhost,
                  "h-9 px-4 text-[11px]",
                  isActive && "shadow-[inset_0_0_0_1px_var(--color-sbi-green)]",
                )}
              >
                {saving === s ? "Saving…" : TASK_STATUS_LABELS[s]}
              </button>
            );
          })}
        </div>
      </div>
    ) : undefined;

  return (
    <Modal
      opened={!!task}
      onClose={onClose}
      title={title}
      uppercaseTitle={false}
      size="xl"
      padded={false}
      footer={footer}
      headerActions={
        canEdit && (onEdit || onDelete) ? (
          <div className="flex items-center gap-2">
            {onEdit ? (
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-1.5 rounded-md border border-sbi-dark-border/60 px-2.5 py-1 text-xs text-sbi-muted transition-colors hover:border-white/30 hover:text-white"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
            ) : null}
            {onDelete ? (
              <button
                type="button"
                onClick={onDelete}
                aria-label="Delete task"
                className="inline-flex items-center gap-1.5 rounded-md border border-sbi-dark-border/60 px-2.5 py-1 text-xs text-sbi-muted transition-colors hover:border-red-400/40 hover:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            ) : null}
          </div>
        ) : undefined
      }
    >
      <div className="grid md:grid-cols-[260px_1fr] gap-0 md:gap-px bg-sbi-dark-border/30">
        <aside className="bg-sbi-dark p-6 flex flex-col gap-5">
          <MetaRow
            icon={CalendarIcon}
            label="Due Date"
            value={
              <span>
                {formatLongDate(task.due_date)}
                {task.tentative && (
                  <span className="ml-2 text-amber-400">(Tentative)</span>
                )}
              </span>
            }
          />
          <MetaRow
            icon={Users}
            label="Team"
            value={TEAM_NAME_LABELS[task.team]}
          />
          <MetaRow
            icon={Flag}
            label="Priority"
            value={<PriorityPill priority={task.priority} />}
          />
          <MetaRow
            icon={User}
            label="Assigned By"
            value={task.assigned_by || "—"}
          />
          <MetaRow
            icon={Users}
            label="Assignees"
            value={
              task.assignees.length > 0 ? (
                <div className="space-y-0.5">
                  {task.assignees.map((a) => (
                    <p key={a}>{a}</p>
                  ))}
                </div>
              ) : (
                <span className="text-sbi-muted italic">Unassigned</span>
              )
            }
          />
        </aside>

        <main className="bg-sbi-dark p-6 flex flex-col gap-6 min-w-0">
          <section>
            <h3 className="text-xs uppercase tracking-[0.15em] text-sbi-muted mb-3">
              Description
            </h3>
            {task.description ? (
              <p className="text-sm text-white/85 leading-relaxed whitespace-pre-wrap">
                {task.description}
              </p>
            ) : (
              <p className="text-sm text-sbi-muted italic">
                No description provided.
              </p>
            )}
          </section>

          <div className="mt-auto flex items-center gap-4 border-t border-sbi-dark-border/40 pt-4 text-xs text-sbi-muted-dark tabular-nums">
            <span>Created {formatShortDateTime(task.created_at)}</span>
            <span aria-hidden>•</span>
            <span>Updated {formatShortDateTime(task.updated_at)}</span>
          </div>
        </main>
      </div>
    </Modal>
  );
}
