"use client";

import {
  ArrowLeft,
  ListChecks,
  ListPlus,
  Pencil,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import {
  btnGhost,
  btnPrimary,
  DashboardMain,
  DashboardShell,
  EmptyState,
  PageHeader,
  SectionLabel,
} from "@/components/dashboard/common/ui";
import { type ColumnDef, DataTable } from "@/components/data-table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toastError, toastSuccess } from "@/lib/notifications";
import { useProject } from "@/lib/project/project-context";
import { deleteLifecycleTask } from "../api";
import {
  TASK_PRIORITY_FILTER,
  TASK_TEAM_FILTER,
} from "../components/constants";
import { PriorityPill, TaskStatusPill } from "../components/Pills";
import { ProjectModal } from "../components/ProjectModal";
import { StatusChips } from "../components/StatusChips";
import { StatusDonut } from "../components/StatusDonut";
import { countByStatus } from "../components/status-meta";
import { TaskModal } from "../components/TaskModal";
import TaskPopUp from "../components/TaskPopUp";
import {
  TASK_PRIORITY_ORDER,
  TASK_STATUS_ORDER,
  type Task,
  type TaskStatusDB,
  TEAM_NAME_LABELS,
} from "../types";
import { useLifecycleProject } from "../use-lifecycle";

const formatDueDate = (d: Date) =>
  d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

function ProjectDetailInner() {
  const params = useParams<{ projectId: string }>();
  const projectId = Number(params.projectId);
  const searchParams = useSearchParams();
  const demoMode = searchParams.get("demo") === "1";

  const { user } = useProject();
  const canEdit = user?.role === "director";

  const { project, loading, refetch, setTaskStatus } = useLifecycleProject({
    projectId,
    demoMode,
  });

  const canCreate = canEdit && !demoMode;
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [statusFilter, setStatusFilter] = useState<TaskStatusDB | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);

  const openAddTask = () => {
    setEditingTask(null);
    setTaskModalOpen(true);
  };
  const openEditTask = (t: Task) => {
    setSelectedTask(null);
    setEditingTask(t);
    setTaskModalOpen(true);
  };
  const requestDeleteTask = (t: Task) => {
    setSelectedTask(null);
    setDeletingTask(t);
  };
  const confirmDeleteTask = async () => {
    if (!deletingTask) return;
    const ok = await deleteLifecycleTask(deletingTask.id);
    if (ok) {
      toastSuccess(`Task "${deletingTask.title}" deleted.`);
      await refetch();
    } else {
      toastError("Couldn't delete the task.");
    }
    setDeletingTask(null);
  };

  const counts = useMemo(
    () => countByStatus(project?.tasks ?? []),
    [project?.tasks],
  );

  const visibleTasks = useMemo(() => {
    const all = project?.tasks ?? [];
    return statusFilter ? all.filter((t) => t.status === statusFilter) : all;
  }, [project?.tasks, statusFilter]);

  const columns: ColumnDef<Task>[] = useMemo(
    () => [
      {
        accessor: "title",
        header: "Task",
        sortable: true,
        render: (value, row) => (
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{value}</p>
            {row.description ? (
              <p className="text-xs text-sbi-muted-dark truncate mt-0.5">
                {row.description}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        accessor: "status",
        header: "Status",
        sortable: true,
        sortFn: (a, b) =>
          TASK_STATUS_ORDER[a.status] - TASK_STATUS_ORDER[b.status],
        render: (_, row) => <TaskStatusPill status={row.status} />,
      },
      {
        accessor: "priority",
        header: "Priority",
        sortable: true,
        responsivePriority: 2,
        sortFn: (a, b) =>
          TASK_PRIORITY_ORDER[b.priority] - TASK_PRIORITY_ORDER[a.priority],
        render: (_, row) => <PriorityPill priority={row.priority} />,
      },
      {
        accessor: "team",
        header: "Team",
        sortable: true,
        responsivePriority: 3,
        render: (_, row) => (
          <span className="text-sm text-sbi-muted">
            {TEAM_NAME_LABELS[row.team]}
          </span>
        ),
      },
      {
        accessor: "due_date",
        header: "Due",
        sortable: true,
        responsivePriority: 2,
        sortFn: (a, b) => a.due_date.getTime() - b.due_date.getTime(),
        render: (_, row) => (
          <span className="text-sm text-sbi-muted tabular-nums whitespace-nowrap">
            {row.tentative ? (
              <span className="mr-1 text-amber-400" title="Tentative">
                ~
              </span>
            ) : null}
            {formatDueDate(row.due_date)}
          </span>
        ),
      },
      ...(canCreate
        ? [
            {
              accessor: "id" as keyof Task,
              header: "",
              width: "w-20",
              align: "right" as const,
              render: (_: unknown, row: Task) => (
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    aria-label="Edit task"
                    title="Edit"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTask(null);
                      setEditingTask(row);
                      setTaskModalOpen(true);
                    }}
                    className="rounded-md p-1.5 text-sbi-muted transition-colors hover:bg-sbi-green/10 hover:text-sbi-green"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Delete task"
                    title="Delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingTask(row);
                    }}
                    className="rounded-md p-1.5 text-sbi-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ),
            },
          ]
        : []),
    ],
    [canCreate],
  );

  if (loading && !project) {
    return (
      <DashboardShell>
        <PageHeader title="Loading…" subtitle="" />
        <div className="flex-1 animate-pulse space-y-6">
          <div className="h-36 rounded-2xl bg-white/5" />
          <div className="h-64 rounded-xl bg-white/5" />
        </div>
      </DashboardShell>
    );
  }

  if (!project) {
    return (
      <DashboardShell>
        <PageHeader title="Project not found" subtitle="" />
        <EmptyState
          icon={<ShieldAlert className="h-6 w-6" />}
          title="We couldn't find that project"
          description="It may have been removed or the link is incorrect."
          action={
            <Link href="/dashboard/lifecycle" className={btnGhost}>
              <ArrowLeft className="h-4 w-4" />
              Back to Lifecycle
            </Link>
          }
        />
      </DashboardShell>
    );
  }

  const blocked = counts.blocked;
  const subtitle = `${project.tasks.length} ${
    project.tasks.length === 1 ? "task" : "tasks"
  } · ${blocked > 0 ? `${blocked} blocked` : "on track"} · ${project.progress_percent}% complete`;

  return (
    <DashboardShell>
      <PageHeader
        title={project.title}
        subtitle={subtitle}
        action={
          <div className="flex items-center gap-2">
            <Link href="/dashboard/lifecycle" className={btnGhost}>
              <ArrowLeft className="h-4 w-4" />
              Lifecycle
            </Link>
            {canCreate ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditProjectOpen(true)}
                  className={btnGhost}
                >
                  <Pencil className="h-4 w-4" /> Edit
                </button>
                <button
                  type="button"
                  onClick={openAddTask}
                  className={btnPrimary}
                >
                  <ListPlus className="h-4 w-4" /> Add Task
                </button>
              </>
            ) : null}
          </div>
        }
      />

      <DashboardMain>
        <div className="flex flex-col gap-8 pb-2">
          <div className="flex flex-col items-center gap-6 rounded-2xl border border-sbi-dark-border/50 bg-sbi-dark-card/40 p-6 sm:flex-row sm:items-center">
            <StatusDonut tasks={project.tasks} size={128} thickness={14} />
            <div className="min-w-0 flex-1">
              <p className="mb-3 text-[10px] uppercase tracking-[0.15em] text-sbi-muted-dark">
                Status breakdown · tap to filter
              </p>
              <StatusChips
                counts={counts}
                active={statusFilter}
                onSelect={setStatusFilter}
              />
              {blocked > 0 ? (
                <p className="mt-3 flex items-center gap-2 text-sm text-red-400">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  {blocked} {blocked === 1 ? "task is" : "tasks are"} blocked —
                  needs attention.
                </p>
              ) : null}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-3">
              <SectionLabel>Tasks</SectionLabel>
              {statusFilter ? (
                <button
                  type="button"
                  onClick={() => setStatusFilter(null)}
                  className="mb-6 ml-auto rounded-full border border-sbi-dark-border/60 px-3 py-1 text-[11px] text-sbi-muted hover:text-white hover:border-white/30 transition-colors"
                >
                  Clear status filter ✕
                </button>
              ) : null}
            </div>
            {project.tasks.length === 0 ? (
              <EmptyState
                icon={<ListChecks className="h-6 w-6" />}
                title="No tasks yet"
                description="Tasks added to this lifecycle project will appear here."
              />
            ) : (
              <DataTable<Task>
                data={visibleTasks}
                columns={columns}
                rowKey="id"
                searchable
                searchKeys={["title", "description", "assigned_by"]}
                searchPlaceholder="Search tasks..."
                filters={[TASK_PRIORITY_FILTER, TASK_TEAM_FILTER]}
                pageSize={8}
                primaryColumn="title"
                onRowClick={setSelectedTask}
              />
            )}
          </div>
        </div>
      </DashboardMain>

      <TaskPopUp
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        canEdit={canEdit}
        onEdit={selectedTask ? () => openEditTask(selectedTask) : undefined}
        onDelete={
          selectedTask ? () => requestDeleteTask(selectedTask) : undefined
        }
        onStatusChange={async (taskId, status) => {
          const ok = await setTaskStatus(taskId, status);
          if (ok) {
            setSelectedTask((prev) =>
              prev && prev.id === taskId ? { ...prev, status } : prev,
            );
          }
          return ok;
        }}
      />

      <TaskModal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        lifecycleProjectId={projectId}
        assignedBy={user?.id ?? null}
        task={editingTask}
        onSaved={refetch}
      />

      <ProjectModal
        open={isEditProjectOpen}
        onClose={() => setIsEditProjectOpen(false)}
        parentProjectId={project.project_id}
        project={project}
        onSaved={refetch}
      />

      <ConfirmDialog
        opened={!!deletingTask}
        onClose={() => setDeletingTask(null)}
        title="Delete task"
        description={
          deletingTask ? (
            <>
              Delete <span className="text-white">{deletingTask.title}</span>?
              This permanently removes the task and its assignees.
            </>
          ) : (
            ""
          )
        }
        confirmLabel="Delete"
        danger
        onConfirm={confirmDeleteTask}
      />
    </DashboardShell>
  );
}

export default function ProjectDetailPage() {
  return (
    <Suspense
      fallback={
        <DashboardShell>
          <PageHeader title="Loading…" subtitle="" />
          <div className="flex-1" />
        </DashboardShell>
      }
    >
      <ProjectDetailInner />
    </Suspense>
  );
}
