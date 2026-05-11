import { createClient } from '@/lib/supabase/client';
import { Project, Task, type TaskStatusDB, type TaskPriorityDB, type TeamNameDB } from './types';

function calculateProgress(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  const completedTasks = tasks.filter(task => task.status === 'completed').length;
  return Math.round((completedTasks / tasks.length) * 100);
}

export async function fetchProjects(): Promise<Project[]> {
  const supabase = createClient();

  const { data: projectsData, error: projectsError } = await supabase
    .from('lifecycle_projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (projectsError || !projectsData) {
    console.error('Error fetching lifecycle projects:', projectsError);
    return [];
  }

  const { data: tasksData, error: tasksError } = await supabase
    .from('lifecycle_tasks')
    .select('*, assignees:lifecycle_task_assignees(profile_id, profiles(id, name))');

  if (tasksError) {
    console.error('Error fetching lifecycle tasks:', tasksError);
    return [];
  }

  const tasks: Task[] = (tasksData ?? []).map((t: any) => ({
    id: t.id,
    title: t.title,
    description: t.description ?? '',
    status: t.status as TaskStatusDB,
    team: t.team as TeamNameDB,
    due_date: new Date(t.due_date),
    tentative: t.tentative,
    assigned_by: '', // resolved below if needed
    assignees: (t.assignees ?? []).map((a: any) => a.profiles?.name ?? 'Unknown'),
    priority: t.priority as TaskPriorityDB,
    lifecycle_project_id: t.lifecycle_project_id,
    created_at: new Date(t.created_at),
    updated_at: new Date(t.updated_at),
  }));

  return projectsData.map((p: any) => {
    const projectTasks = tasks.filter(t => t.lifecycle_project_id === p.id);
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
    .from('lifecycle_projects')
    .select('*')
    .eq('id', id)
    .single();

  if (projectError || !p) {
    console.error('Error fetching lifecycle project:', projectError);
    return null;
  }

  const { data: tasksData, error: tasksError } = await supabase
    .from('lifecycle_tasks')
    .select('*, assignees:lifecycle_task_assignees(profile_id, profiles(id, name))')
    .eq('lifecycle_project_id', id);

  if (tasksError) {
    console.error('Error fetching lifecycle tasks:', tasksError);
    return null;
  }

  const tasks: Task[] = (tasksData ?? []).map((t: any) => ({
    id: t.id,
    title: t.title,
    description: t.description ?? '',
    status: t.status as TaskStatusDB,
    team: t.team as TeamNameDB,
    due_date: new Date(t.due_date),
    tentative: t.tentative,
    assigned_by: '',
    assignees: (t.assignees ?? []).map((a: any) => a.profiles?.name ?? 'Unknown'),
    priority: t.priority as TaskPriorityDB,
    lifecycle_project_id: t.lifecycle_project_id,
    created_at: new Date(t.created_at),
    updated_at: new Date(t.updated_at),
  }));

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
