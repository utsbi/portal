import type { FilterDef } from "@/components/data-table";
import { DEPARTMENTS } from "@/lib/departments";

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
  options: [{ value: "All Depts", label: "All Departments" }, ...DEPARTMENTS],
};
