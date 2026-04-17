import { createClient } from '@/lib/supabase/client';
import { Project, Task, ProjectDB, TaskDB } from './types';

// Convert DB task to frontend Task type
function taskFromDB(taskDB: TaskDB): Task {
  return {
    id: taskDB.id,
    title: taskDB.title,
    description: taskDB.description,
    status: taskDB.status as any,
    team: taskDB.team as any,
    due_date: new Date(taskDB.due_date),
    tentative: taskDB.tentative,
    assigned_by: taskDB.assigned_by,
    assignees: taskDB.assignees,
    priority: taskDB.priority as any,
    project_id: taskDB.project_id,
    created_at: new Date(taskDB.created_at),
    last_updated: new Date(taskDB.updated_at),
  };
}

// Calculate progress based on tasks
function calculateProgress(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  const completedTasks = tasks.filter(task => task.status === 'Completed').length;
  return Math.round((completedTasks / tasks.length) * 100);
}

// Fetch all projects with their tasks
export async function fetchProjects(): Promise<Project[]> {
  const supabase = createClient();
  
  // Fetch projects
  const { data: projectsData, error: projectsError } = await supabase
    .from('lifecycle_projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (projectsError) {
    console.error('Error fetching projects:', projectsError);
    return [];
  }

  // Fetch all tasks
  const { data: tasksData, error: tasksError } = await supabase
    .from('lifecycle_tasks')
    .select('*');

  if (tasksError) {
    console.error('Error fetching tasks:', tasksError);
    return [];
  }

  // Convert to frontend types
  const tasks = tasksData.map(taskFromDB);

  // Combine projects with their tasks
  const projects: Project[] = projectsData.map((projectDB: ProjectDB) => {
    const projectTasks = tasks.filter(task => task.project_id === projectDB.id);
    return {
      id: projectDB.id,
      title: projectDB.title,
      client: projectDB.client,
      completed: projectDB.completed,
      progress_percent: calculateProgress(projectTasks),
      image: projectDB.image,
      tasks: projectTasks,
    };
  });

  return projects;
}

// Fetch single project by ID
export async function fetchProjectById(id: string): Promise<Project | null> {
  const supabase = createClient();
  
  const { data: projectDB, error: projectError } = await supabase
    .from('lifecycle_projects')
    .select('*')
    .eq('id', id)
    .single();

  if (projectError || !projectDB) {
    console.error('Error fetching project:', projectError);
    return null;
  }

  const { data: tasksData, error: tasksError } = await supabase
    .from('lifecycle_tasks')
    .select('*')
    .eq('project_id', id);

  if (tasksError) {
    console.error('Error fetching tasks:', tasksError);
    return null;
  }

  const tasks = tasksData.map(taskFromDB);

  return {
    id: projectDB.id,
    title: projectDB.title,
    client: projectDB.client,
    completed: projectDB.completed,
    progress_percent: calculateProgress(tasks),
    image: projectDB.image,
    tasks,
  };
}