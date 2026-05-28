"use client";

import { ListPlus, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { btnGhost, btnPrimary, Modal } from "@/components/dashboard/common/ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toastError, toastSuccess } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import {
  type AssignableProfile,
  createLifecycleTask,
  fetchAssignableProfiles,
  updateLifecycleTask,
} from "../api";
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type Task,
  type TaskPriorityDB,
  type TaskStatusDB,
  TEAM_NAME_LABELS,
  type TeamNameDB,
} from "../types";
import { STATUS_DISPLAY_ORDER } from "./status-meta";

const labelClass =
  "text-xs uppercase tracking-[0.1em] text-sbi-muted mb-2 font-medium";
const fieldClass =
  "bg-sbi-dark border-sbi-dark-border rounded-lg px-4 py-3 h-auto text-base text-white placeholder:text-white/30 focus-visible:border-sbi-green/50 focus-visible:ring-sbi-green/20 focus-visible:ring-[2px] shadow-none";
const selectClass =
  "w-full cursor-pointer rounded-lg border border-sbi-dark-border bg-sbi-dark px-3 py-2.5 text-sm text-white focus:border-sbi-green/50 focus:outline-none disabled:opacity-50";

const TEAMS: TeamNameDB[] = [
  "technology",
  "architecture",
  "public_relations",
  "engineering",
  "finance",
  "research",
  "legal",
  "executive",
];
const PRIORITIES: TaskPriorityDB[] = [
  "extreme",
  "high",
  "medium",
  "low",
  "stretch",
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function toISODate(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

interface TaskModalProps {
  open: boolean;
  onClose: () => void;
  lifecycleProjectId: number;
  /** profiles.id of the acting director, stored as assigned_by on create. */
  assignedBy: number | null;
  /** When provided, edits this task instead of creating one. */
  task?: Task | null;
  onSaved: () => void | Promise<void>;
}

export function TaskModal({
  open,
  onClose,
  lifecycleProjectId,
  assignedBy,
  task,
  onSaved,
}: TaskModalProps) {
  const isEdit = !!task;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [team, setTeam] = useState<TeamNameDB>("engineering");
  const [priority, setPriority] = useState<TaskPriorityDB>("medium");
  const [status, setStatus] = useState<TaskStatusDB>("not_started");
  const [dueDate, setDueDate] = useState(todayISO());
  const [tentative, setTentative] = useState(false);
  const [profiles, setProfiles] = useState<AssignableProfile[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  // Load the assignable roster whenever the modal opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchAssignableProfiles().then((p) => {
      if (!cancelled) setProfiles(p);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Prefill (edit) or reset (create) when the modal opens.
  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setTeam(task?.team ?? "engineering");
    setPriority(task?.priority ?? "medium");
    setStatus(task?.status ?? "not_started");
    setDueDate(task ? toISODate(task.due_date) : todayISO());
    setTentative(task?.tentative ?? false);
    setSelected(new Set(task?.assignee_ids ?? []));
  }, [open, task]);

  const toggleAssignee = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDate) return;
    setSubmitting(true);
    const assigneeProfileIds = [...selected];
    let ok: boolean;
    if (isEdit && task) {
      ok = await updateLifecycleTask(task.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        team,
        priority,
        dueDate,
        tentative,
        assigneeProfileIds,
      });
    } else {
      ok = await createLifecycleTask({
        lifecycleProjectId,
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        team,
        priority,
        dueDate,
        tentative,
        assignedBy,
        assigneeProfileIds,
      });
    }
    setSubmitting(false);
    if (!ok) {
      toastError(`Couldn't ${isEdit ? "save" : "create"} the task. Try again.`);
      return;
    }
    toastSuccess(
      isEdit ? `Task "${title.trim()}" updated.` : `Task "${title.trim()}" added.`,
    );
    await onSaved();
    onClose();
  };

  return (
    <Modal
      opened={open}
      onClose={onClose}
      title={isEdit ? "Edit Task" : "Add Task"}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Label htmlFor="lt-title" className={labelClass}>
            Title
            <span className="ml-1 text-red-400" aria-hidden>
              *
            </span>
          </Label>
          <Input
            id="lt-title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={submitting}
            className={fieldClass}
            placeholder="e.g. Rooftop load re-certification"
          />
        </div>

        <div>
          <Label htmlFor="lt-desc" className={labelClass}>
            Description
          </Label>
          <Textarea
            id="lt-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={submitting}
            rows={3}
            className={`${fieldClass} min-h-[90px] resize-none`}
            placeholder="What needs doing, and any context the client should see."
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <span className={`block ${labelClass}`}>Team</span>
            <select
              value={team}
              onChange={(e) => setTeam(e.target.value as TeamNameDB)}
              disabled={submitting}
              className={selectClass}
            >
              {TEAMS.map((t) => (
                <option key={t} value={t}>
                  {TEAM_NAME_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className={`block ${labelClass}`}>Priority</span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriorityDB)}
              disabled={submitting}
              className={selectClass}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {TASK_PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className={`block ${labelClass}`}>Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatusDB)}
              disabled={submitting}
              className={selectClass}
            >
              {STATUS_DISPLAY_ORDER.map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="lt-due" className={labelClass}>
              Due date
              <span className="ml-1 text-red-400" aria-hidden>
                *
              </span>
            </Label>
            <Input
              id="lt-due"
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={submitting}
              className={fieldClass}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 self-end pb-3 text-sm text-white/85">
            <input
              type="checkbox"
              checked={tentative}
              onChange={(e) => setTentative(e.target.checked)}
              disabled={submitting}
              className="h-4 w-4 rounded border-sbi-dark-border bg-sbi-dark text-sbi-green focus:ring-sbi-green/40"
            />
            Due date is tentative
          </label>
        </div>

        <div>
          <span className={`block ${labelClass}`}>Assignees</span>
          {profiles.length === 0 ? (
            <p className="text-sm text-sbi-muted">
              No assignable team members found.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {profiles.map((p) => {
                const isOn = selected.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleAssignee(p.id)}
                    disabled={submitting}
                    aria-pressed={isOn}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      isOn
                        ? "border-sbi-green/50 bg-sbi-green/15 text-sbi-green"
                        : "border-sbi-dark-border/60 text-sbi-muted hover:border-white/30 hover:text-white",
                    )}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-sbi-dark-border pt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className={btnGhost}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !title.trim() || !dueDate}
            className={btnPrimary}
          >
            {submitting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Saving…
              </>
            ) : isEdit ? (
              <>
                <Save className="h-4 w-4" />
                Save Changes
              </>
            ) : (
              <>
                <ListPlus className="h-4 w-4" />
                Add Task
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
