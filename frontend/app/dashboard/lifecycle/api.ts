import { createClient } from "@/lib/supabase/client";
import type {
  Project,
  Task,
  TaskPriorityDB,
  TaskStatusDB,
  TeamNameDB,
} from "./types";

function calculateProgress(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  const completedTasks = tasks.filter(
    (task) => task.status === "completed",
  ).length;
  return Math.round((completedTasks / tasks.length) * 100);
}

const TASK_SELECT =
  "*, assigner:profiles!lifecycle_tasks_assigned_by_fkey(id, name), assignees:lifecycle_task_assignees(profile_id, profiles(id, name))";

// biome-ignore lint/suspicious/noExplicitAny: Supabase row shape with embedded joins
function mapTaskRow(t: any): Task {
  return {
    id: t.id,
    title: t.title,
    description: t.description ?? "",
    status: t.status as TaskStatusDB,
    team: t.team as TeamNameDB,
    due_date: new Date(t.due_date),
    tentative: t.tentative,
    assigned_by: t.assigner?.name ?? "",
    assigned_by_id: t.assigned_by ?? null,
    assignees: (t.assignees ?? []).map(
      // biome-ignore lint/suspicious/noExplicitAny: embedded join row
      (a: any) => a.profiles?.name ?? "Unknown",
    ),
    assignee_ids: (t.assignees ?? []).map(
      // biome-ignore lint/suspicious/noExplicitAny: embedded join row
      (a: any) => a.profile_id as number,
    ),
    priority: t.priority as TaskPriorityDB,
    lifecycle_project_id: t.lifecycle_project_id,
    created_at: new Date(t.created_at),
    updated_at: new Date(t.updated_at),
  };
}

export async function fetchProjects(
  parentProjectId?: number | null,
): Promise<Project[]> {
  const supabase = createClient();

  let query = supabase
    .from("lifecycle_projects")
    .select("*")
    .order("created_at", { ascending: false });
  if (parentProjectId != null) {
    query = query.eq("project_id", parentProjectId);
  }

  const { data: projectsData, error: projectsError } = await query;

  if (projectsError || !projectsData) {
    console.error("Error fetching lifecycle projects:", projectsError);
    return [];
  }

  const { data: tasksData, error: tasksError } = await supabase
    .from("lifecycle_tasks")
    .select(TASK_SELECT);

  if (tasksError) {
    console.error("Error fetching lifecycle tasks:", tasksError);
    return [];
  }

  const tasks: Task[] = (tasksData ?? []).map(mapTaskRow);

  // biome-ignore lint/suspicious/noExplicitAny: Supabase project row
  return projectsData.map((p: any) => {
    const projectTasks = tasks.filter((t) => t.lifecycle_project_id === p.id);
    return {
      id: p.id,
      project_id: p.project_id,
      title: p.title,
      completed: p.completed,
      progress_percent: calculateProgress(projectTasks),
      image: p.image,
      tasks: projectTasks,
    };
  });
}

export async function fetchProjectById(id: number): Promise<Project | null> {
  const supabase = createClient();

  const { data: p, error: projectError } = await supabase
    .from("lifecycle_projects")
    .select("*")
    .eq("id", id)
    .single();

  if (projectError || !p) {
    console.error("Error fetching lifecycle project:", projectError);
    return null;
  }

  const { data: tasksData, error: tasksError } = await supabase
    .from("lifecycle_tasks")
    .select(TASK_SELECT)
    .eq("lifecycle_project_id", id);

  if (tasksError) {
    console.error("Error fetching lifecycle tasks:", tasksError);
    return null;
  }

  const tasks: Task[] = (tasksData ?? []).map(mapTaskRow);

  return {
    id: p.id,
    project_id: p.project_id,
    title: p.title,
    completed: p.completed,
    progress_percent: calculateProgress(tasks),
    image: p.image,
    tasks,
  };
}

/** Director-only: update a task's status. RLS must permit the write. */
export async function updateTaskStatus(
  taskId: number,
  status: TaskStatusDB,
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("lifecycle_tasks")
    .update({ status })
    .eq("id", taskId);
  if (error) {
    console.error("Error updating task status:", error);
    return false;
  }
  return true;
}

/** Director-only: create a lifecycle project under a parent project. */
export async function createLifecycleProject(input: {
  parentProjectId: number;
  title: string;
  image?: string | null;
}): Promise<Project | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("lifecycle_projects")
    .insert({
      project_id: input.parentProjectId,
      title: input.title,
      image: input.image || null,
    })
    .select("*")
    .single();
  if (error || !data) {
    console.error("Error creating lifecycle project:", error);
    return null;
  }
  return {
    id: data.id,
    project_id: data.project_id,
    title: data.title,
    completed: data.completed,
    progress_percent: 0,
    image: data.image,
    tasks: [],
  };
}

export interface NewTaskInput {
  lifecycleProjectId: number;
  title: string;
  description?: string;
  status: TaskStatusDB;
  team: TeamNameDB;
  priority: TaskPriorityDB;
  dueDate: string; // YYYY-MM-DD
  tentative: boolean;
  assignedBy: number | null;
  assigneeProfileIds: number[];
}

/** Director-only: create a task and its assignee rows. */
export async function createLifecycleTask(
  input: NewTaskInput,
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("lifecycle_tasks")
    .insert({
      lifecycle_project_id: input.lifecycleProjectId,
      title: input.title,
      description: input.description || null,
      status: input.status,
      team: input.team,
      priority: input.priority,
      due_date: input.dueDate,
      tentative: input.tentative,
      assigned_by: input.assignedBy,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("Error creating lifecycle task:", error);
    return false;
  }
  if (input.assigneeProfileIds.length > 0) {
    const { error: assigneeError } = await supabase
      .from("lifecycle_task_assignees")
      .insert(
        input.assigneeProfileIds.map((profileId) => ({
          task_id: data.id,
          profile_id: profileId,
        })),
      );
    if (assigneeError) {
      console.error("Error adding task assignees:", assigneeError);
      // Task itself was created; surface as success and let a refetch reconcile.
    }
  }
  return true;
}

/** Director-only: edit a lifecycle project's details. */
export async function updateLifecycleProject(
  id: number,
  patch: { title?: string; image?: string | null; completed?: boolean },
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("lifecycle_projects")
    .update(patch)
    .eq("id", id);
  if (error) {
    console.error("Error updating lifecycle project:", error);
    return false;
  }
  return true;
}

export interface UpdateTaskInput {
  title: string;
  description?: string;
  status: TaskStatusDB;
  team: TeamNameDB;
  priority: TaskPriorityDB;
  dueDate: string;
  tentative: boolean;
  assigneeProfileIds: number[];
}

/** Director-only: edit a task and reconcile its assignees. assigned_by is preserved. */
export async function updateLifecycleTask(
  id: number,
  input: UpdateTaskInput,
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("lifecycle_tasks")
    .update({
      title: input.title,
      description: input.description || null,
      status: input.status,
      team: input.team,
      priority: input.priority,
      due_date: input.dueDate,
      tentative: input.tentative,
    })
    .eq("id", id);
  if (error) {
    console.error("Error updating lifecycle task:", error);
    return false;
  }
  // Reconcile assignees: clear then reinsert the selected set.
  const { error: deleteError } = await supabase
    .from("lifecycle_task_assignees")
    .delete()
    .eq("task_id", id);
  if (deleteError) {
    console.error("Error clearing task assignees:", deleteError);
  }
  if (input.assigneeProfileIds.length > 0) {
    const { error: insertError } = await supabase
      .from("lifecycle_task_assignees")
      .insert(
        input.assigneeProfileIds.map((profileId) => ({
          task_id: id,
          profile_id: profileId,
        })),
      );
    if (insertError) {
      console.error("Error setting task assignees:", insertError);
    }
  }
  return true;
}

/** Director-only: delete a task and its assignee rows. */
export async function deleteLifecycleTask(id: number): Promise<boolean> {
  const supabase = createClient();
  // Remove assignee links first (defensive — independent of FK cascade).
  await supabase.from("lifecycle_task_assignees").delete().eq("task_id", id);
  const { error } = await supabase
    .from("lifecycle_tasks")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("Error deleting lifecycle task:", error);
    return false;
  }
  return true;
}

export interface AssignableProfile {
  id: number;
  name: string;
  role: string;
  department: string | null;
}

/** Profiles eligible to be task assignees (directors + members). */
export async function fetchAssignableProfiles(): Promise<AssignableProfile[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, role, department")
    .in("role", ["director", "member"])
    .order("name", { ascending: true });
  if (error || !data) {
    console.error("Error fetching assignable profiles:", error);
    return [];
  }
  return data as AssignableProfile[];
}
