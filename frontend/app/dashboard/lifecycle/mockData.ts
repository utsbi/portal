import type {
  Project,
  Task,
  TaskPriorityDB,
  TaskStatusDB,
  TeamNameDB,
} from "./types";

let nextId = 1;

function task(
  projectId: number,
  title: string,
  status: TaskStatusDB,
  team: TeamNameDB,
  priority: TaskPriorityDB,
  due: string,
  opts: {
    description?: string;
    tentative?: boolean;
    assignees?: string[];
  } = {},
): Task {
  return {
    id: nextId++,
    title,
    description:
      opts.description ??
      `${title} — coordinated by the ${team} team for this project phase.`,
    status,
    team,
    due_date: new Date(due),
    tentative: opts.tentative ?? false,
    assigned_by: "Pedro Guzman",
    assignees: opts.assignees ?? ["Jane Doe"],
    priority,
    lifecycle_project_id: projectId,
    created_at: new Date("2025-01-10"),
    updated_at: new Date("2025-03-01"),
  };
}

function progress(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  const done = tasks.filter((t) => t.status === "completed").length;
  return Math.round((done / tasks.length) * 100);
}

// Project 1 — Campus Solar Initiative: active, broad spread incl. blocked.
const SOLAR_TASKS: Task[] = [
  task(
    1,
    "Roof Structural Analysis",
    "completed",
    "architecture",
    "extreme",
    "2025-02-15",
  ),
  task(
    1,
    "Energy Usage Baseline Study",
    "completed",
    "technology",
    "high",
    "2025-03-20",
  ),
  task(
    1,
    "Vendor Shortlist & RFQ",
    "completed",
    "finance",
    "medium",
    "2025-03-28",
  ),
  task(
    1,
    "Panel Layout Schematics",
    "completed",
    "engineering",
    "high",
    "2025-04-12",
  ),
  task(
    1,
    "Grid Interconnection Plan",
    "completed",
    "engineering",
    "high",
    "2025-04-30",
  ),
  task(
    1,
    "Wiring & Conduit Installation",
    "in_progress",
    "engineering",
    "high",
    "2025-11-14",
    {
      assignees: ["Kabir Muzumdar", "Preston Vajdos"],
    },
  ),
  task(
    1,
    "Inverter Commissioning",
    "in_progress",
    "technology",
    "medium",
    "2025-11-22",
  ),
  task(
    1,
    "Community Outreach Plan",
    "pending_approval",
    "public_relations",
    "medium",
    "2025-12-01",
    {
      tentative: true,
      assignees: ["Arianne Yude"],
    },
  ),
  task(
    1,
    "City Permit Submittal",
    "blocked",
    "legal",
    "extreme",
    "2025-11-21",
    {
      description:
        "Permit package is complete but stalled in the city review queue. Blocked until the municipal inspector signs off on the structural addendum.",
      assignees: ["Alim Makanov"],
    },
  ),
  task(
    1,
    "Rooftop Load Re-certification",
    "blocked",
    "architecture",
    "high",
    "2025-12-02",
    {
      description:
        "Waiting on the third-party structural engineer's stamped re-certification before installation can resume.",
      assignees: ["Christian Butler"],
    },
  ),
];

// Project 2 — Green Roof Retrofit: mostly done.
const GREEN_ROOF_TASKS: Task[] = [
  task(2, "Drainage Survey", "completed", "engineering", "high", "2025-02-01"),
  task(
    2,
    "Waterproof Membrane Spec",
    "completed",
    "architecture",
    "medium",
    "2025-02-20",
  ),
  task(
    2,
    "Substrate & Planting Plan",
    "completed",
    "research",
    "medium",
    "2025-03-15",
  ),
  task(
    2,
    "Irrigation Loop Install",
    "in_progress",
    "engineering",
    "medium",
    "2025-11-30",
  ),
];

// Project 3 — Water Reclamation: early, one blocked.
const WATER_TASKS: Task[] = [
  task(
    3,
    "Greywater Feasibility Study",
    "completed",
    "research",
    "high",
    "2025-05-10",
  ),
  task(
    3,
    "Treatment Vendor Evaluation",
    "in_progress",
    "finance",
    "medium",
    "2025-12-10",
  ),
  task(3, "Plumbing Code Review", "blocked", "legal", "high", "2025-12-18", {
    description:
      "Awaiting updated state plumbing code interpretation before the design can be finalized.",
    assignees: ["Alim Makanov"],
  }),
  task(
    3,
    "Storage Tank Siting",
    "not_started",
    "architecture",
    "low",
    "2026-01-15",
  ),
];

// Project 4 — Building Energy Optimization: complete.
const ENERGY_TASKS: Task[] = [
  task(4, "HVAC Audit", "completed", "engineering", "high", "2024-09-01"),
  task(4, "LED Retrofit", "completed", "engineering", "medium", "2024-10-15"),
  task(
    4,
    "Smart Thermostat Rollout",
    "completed",
    "technology",
    "medium",
    "2024-11-20",
  ),
  task(4, "Final Savings Report", "completed", "finance", "low", "2024-12-10"),
];

export const MOCK_PROJECTS: Project[] = [
  {
    id: 1,
    project_id: 1,
    title: "Campus Solar Initiative",
    completed: false,
    progress_percent: progress(SOLAR_TASKS),
    image: undefined,
    tasks: SOLAR_TASKS,
  },
  {
    id: 2,
    project_id: 1,
    title: "Green Roof Retrofit",
    completed: false,
    progress_percent: progress(GREEN_ROOF_TASKS),
    image: undefined,
    tasks: GREEN_ROOF_TASKS,
  },
  {
    id: 3,
    project_id: 1,
    title: "Water Reclamation System",
    completed: false,
    progress_percent: progress(WATER_TASKS),
    image: undefined,
    tasks: WATER_TASKS,
  },
  {
    id: 4,
    project_id: 1,
    title: "Building Energy Optimization",
    completed: true,
    progress_percent: progress(ENERGY_TASKS),
    image: undefined,
    tasks: ENERGY_TASKS,
  },
];

export function getProjectById(id: number): Project | undefined {
  return MOCK_PROJECTS.find((p) => p.id === id);
}
