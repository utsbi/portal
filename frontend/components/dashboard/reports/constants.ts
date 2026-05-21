import type { FilterDef } from "@/components/data-table";

export const DEPARTMENTS: NonNullable<FilterDef["options"]> = [
  { value: "All Depts", label: "All Departments" },
  { value: "Architecture", label: "Architecture" },
  {
    label: "Engineering",
    options: [
      { value: "Engineering General", label: "General" },
      { value: "Civil", label: "Civil" },
      { value: "Environmental", label: "Environmental" },
      { value: "Structural", label: "Structural" },
      { value: "Electrical", label: "Electrical" },
    ],
  },
  { value: "Finance", label: "Finance" },
  { value: "Public Relations", label: "Public Relations" },
  { value: "Marketing", label: "Marketing" },
  { value: "Internal Technologies", label: "Internal Tech" },
  { value: "Legal", label: "Legal" },
  { value: "R&D", label: "R&D" },
];

export const STATUS_FILTER: FilterDef = {
  key: "status",
  label: "Status",
  defaultValue: "All",
  width: "w-40",
  options: [
    { value: "All", label: "All Status" },
    { value: "Pending", label: "Pending" },
    { value: "In Progress", label: "In Progress" },
    { value: "Done", label: "Done" },
    { value: "Denied", label: "Denied" },
  ],
};

export const DEPT_FILTER: FilterDef = {
  key: "department",
  label: "Department",
  defaultValue: "All Depts",
  width: "w-48",
  options: DEPARTMENTS,
};
