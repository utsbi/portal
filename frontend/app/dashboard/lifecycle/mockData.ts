// frontend/app/(dashboard)/dashboard/lifecycle/mockData.ts

import { Project, Task, TaskStatus, Priority, TeamName } from './types';

export const MOCK_TASKS: Task[] = [
  {
    id: "task-1",
    title: "Roof Structural Analysis",
    description: "Conduct structural analysis of Building A roof to determine load capacity for solar panels.",
    status: TaskStatus.COMPLETED,
    team: TeamName.ARCH,
    due_date: new Date("2024-02-15"),
    tentative: false,
    assigned_by: "John Green",
    assignees: ["John Green", "John Green"],
    priority: Priority.EX_HIGH,
    project_id: "proj-1",
    created_at: new Date("2024-01-01"),
    last_updated: new Date("2024-02-16"),
  },
  {
    id: "task-2",
    title: "Energy Usage Study",
    description: "Analyze current energy usage patterns to establish baseline metrics.",
    status: TaskStatus.IN_PROGRESS,
    team: TeamName.TECH,
    due_date: new Date("2024-03-20"),
    tentative: false,
    assigned_by: "John Green",
    assignees: ["John Green"],
    priority: Priority.HIGH,
    project_id: "proj-1",
    created_at: new Date("2024-01-15"),
    last_updated: new Date("2024-03-01"),
  },
  {
    id: "task-3",
    title: "Community Outreach Plan",
    description: "Develop strategy to inform campus about solar initiative benefits.",
    status: TaskStatus.PENDING,
    team: TeamName.PR,
    due_date: new Date("2024-04-10"),
    tentative: true,
    assigned_by: "John Green",
    assignees: ["John Green"],
    priority: Priority.MED,
    project_id: "proj-1",
    created_at: new Date("2024-02-01"),
    last_updated: new Date("2024-02-20"),
  },
  {
    id: "task-4",
    title: "ROI Analysis",
    description: "Calculate projected return on investment over 25-year period.",
    status: TaskStatus.NOT_STARTED,
    team: TeamName.FIN,
    due_date: new Date("2024-05-01"),
    tentative: false,
    assigned_by: "John Green",
    assignees: ["John Green"],
    priority: Priority.LOW,
    project_id: "proj-1",
    created_at: new Date("2024-02-15"),
    last_updated: new Date("2024-02-15"),
  },
];

export const MOCK_PROJECTS: Project[] = [
  {
    id: "proj-1",
    title: "Campus Solar Initiative",
    client: "client-ut-austin",
    completed: false,
    progress_percent: 50,
    image: undefined,
    tasks: MOCK_TASKS.filter(t => t.project_id === "proj-1"), // Filter tasks properly
  },
  {
    id: "proj-2",
    title: "Green Roof Retrofit",
    client: "client-ut-austin",
    completed: false,
    progress_percent: 75,
    image: undefined,
    tasks: [], // Empty for now
  },
  {
    id: "proj-3",
    title: "Building Energy Optimization",
    client: "client-ut-austin",
    completed: true,
    progress_percent: 100,
    image: undefined,
    tasks: [],
  },
];

// Helper functions
export function getProjectById(id: string): Project | undefined {
  return MOCK_PROJECTS.find(p => p.id === id);
}

export function getProjectsByClient(clientId: string): Project[] {
  return MOCK_PROJECTS.filter(p => p.client === clientId);
}