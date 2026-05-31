import type { FilterDef } from "@/components/data-table";
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type TaskPriorityDB,
  type TaskStatusDB,
  TEAM_NAME_LABELS,
  type TeamNameDB,
} from "../types";

const orderedEntries = <K extends string>(
  keys: K[],
  labels: Record<K, string>,
) => keys.map((value) => ({ value, label: labels[value] }));

const STATUS_KEYS: TaskStatusDB[] = [
  "not_started",
  "in_progress",
  "pending_approval",
  "blocked",
  "completed",
];

const PRIORITY_KEYS: TaskPriorityDB[] = [
  "extreme",
  "high",
  "medium",
  "low",
  "stretch",
];

const TEAM_KEYS: TeamNameDB[] = [
  "technology",
  "architecture",
  "public_relations",
  "engineering",
  "finance",
  "research",
  "legal",
  "executive",
];

export const TASK_STATUS_FILTER: FilterDef = {
  key: "status",
  label: "Status",
  defaultValue: "all",
  width: "w-44",
  options: [
    { value: "all", label: "All Statuses" },
    ...orderedEntries(STATUS_KEYS, TASK_STATUS_LABELS),
  ],
};

export const TASK_PRIORITY_FILTER: FilterDef = {
  key: "priority",
  label: "Priority",
  defaultValue: "all",
  width: "w-40",
  options: [
    { value: "all", label: "All Priorities" },
    ...orderedEntries(PRIORITY_KEYS, TASK_PRIORITY_LABELS),
  ],
};

export const TASK_TEAM_FILTER: FilterDef = {
  key: "team",
  label: "Team",
  defaultValue: "all",
  width: "w-44",
  options: [
    { value: "all", label: "All Teams" },
    ...orderedEntries(TEAM_KEYS, TEAM_NAME_LABELS),
  ],
};
