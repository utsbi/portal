// DB enum values (must match Postgres enums exactly)
export type TaskStatusDB =
  | "not_started"
  | "in_progress"
  | "pending_approval"
  | "blocked"
  | "completed";
export type TaskPriorityDB = "extreme" | "high" | "medium" | "low" | "stretch";
export type TeamNameDB =
  | "technology"
  | "architecture"
  | "public_relations"
  | "engineering"
  | "finance"
  | "research"
  | "legal"
  | "executive";

// Display labels
export const TASK_STATUS_LABELS: Record<TaskStatusDB, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  pending_approval: "Pending Approval",
  blocked: "Blocked",
  completed: "Completed",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriorityDB, string> = {
  extreme: "Extremely High",
  high: "High",
  medium: "Medium",
  low: "Low",
  stretch: "Stretch",
};

export const TEAM_NAME_LABELS: Record<TeamNameDB, string> = {
  technology: "Technology",
  architecture: "Architecture",
  public_relations: "Public Relations",
  engineering: "Engineering",
  finance: "Finance",
  research: "Research & Development",
  legal: "Legal",
  executive: "Executive Board",
};

// Ordering for sorting
export const TASK_STATUS_ORDER: Record<TaskStatusDB, number> = {
  not_started: 0,
  in_progress: 1,
  pending_approval: 2,
  blocked: 3,
  completed: 4,
};

export const TASK_PRIORITY_ORDER: Record<TaskPriorityDB, number> = {
  stretch: 0,
  low: 1,
  medium: 2,
  high: 3,
  extreme: 4,
};

// Frontend types (used by components)
export type Task = {
  id: number;
  title: string;
  description: string;
  status: TaskStatusDB;
  team: TeamNameDB;
  due_date: Date;
  tentative: boolean;
  assigned_by: string;
  assignees: string[];
  priority: TaskPriorityDB;
  lifecycle_project_id: number;
  created_at: Date;
  updated_at: Date;
};

export type Project = {
  id: number;
  project_id: number;
  title: string;
  completed: boolean;
  progress_percent: number;
  tasks: Task[];
  image?: string;
};

// Sort options
export type SortOption =
  | "dueDate-asc"
  | "dueDate-desc"
  | "status-asc"
  | "status-desc"
  | "priority-asc"
  | "priority-desc";

export function sortTasks(tasks: Task[], sortOption: SortOption): Task[] {
  const sorted = [...tasks];
  switch (sortOption) {
    case "dueDate-asc":
      return sorted.sort((a, b) => a.due_date.getTime() - b.due_date.getTime());
    case "dueDate-desc":
      return sorted.sort((a, b) => b.due_date.getTime() - a.due_date.getTime());
    case "status-asc":
      return sorted.sort(
        (a, b) => TASK_STATUS_ORDER[a.status] - TASK_STATUS_ORDER[b.status],
      );
    case "status-desc":
      return sorted.sort(
        (a, b) => TASK_STATUS_ORDER[b.status] - TASK_STATUS_ORDER[a.status],
      );
    case "priority-asc":
      return sorted.sort(
        (a, b) =>
          TASK_PRIORITY_ORDER[a.priority] - TASK_PRIORITY_ORDER[b.priority],
      );
    case "priority-desc":
      return sorted.sort(
        (a, b) =>
          TASK_PRIORITY_ORDER[b.priority] - TASK_PRIORITY_ORDER[a.priority],
      );
    default:
      return sorted;
  }
}
