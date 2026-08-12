import type { FilterDef } from "@/components/data-table";

export interface TeamMember {
  value: string;
  label: string;
  department: string | null;
}

// Placeholder roster while we wait for a directory backed by `profiles`.
// Departments use canonical values from lib/departments.ts.
export const TEAM_MEMBERS: TeamMember[] = [
  { value: "pedro", label: "Pedro Guzman, President", department: null },
  { value: "sam", label: "Sam Moran, Vice President", department: null },
  {
    value: "brendan",
    label: "Brendan Lyon, Director of Project Operations",
    department: "Engineering — General",
  },
  {
    value: "kabir",
    label: "Kabir Muzumdar, Director of Civil Engineering",
    department: "Engineering — Civil",
  },
  {
    value: "preston",
    label: "Preston Vajdos, Director of Civil Engineering",
    department: "Engineering — Civil",
  },
  {
    value: "enoch",
    label: "Enoch Zhu, Director of External Technologies",
    department: "Internal Technologies",
  },
  {
    value: "daniel",
    label: "Daniel Lam, Director of Internal Technologies",
    department: "Internal Technologies",
  },
  {
    value: "dev",
    label: "Dev Shroff, Director of Business",
    department: "Finance",
  },
  {
    value: "arianne",
    label: "Arianne Yude, Director of Public Relations",
    department: "Public Relations",
  },
  {
    value: "christian",
    label: "Christian Butler, Director of Architecture",
    department: "Architecture",
  },
  {
    value: "alim",
    label: "Alim Makanov, Director of Legal",
    department: "Legal",
  },
];

export function memberLabel(value: string | null | undefined): string {
  if (!value) return "Unassigned";
  return TEAM_MEMBERS.find((m) => m.value === value)?.label ?? value;
}

export const STATUS_FILTER: FilterDef = {
  key: "status",
  label: "Status",
  defaultValue: "all",
  width: "w-40",
  options: [
    { value: "all", label: "All Statuses" },
    { value: "pending", label: "Pending" },
    { value: "in-progress", label: "In Progress" },
    { value: "done", label: "Done" },
    { value: "denied", label: "Denied" },
  ],
};
