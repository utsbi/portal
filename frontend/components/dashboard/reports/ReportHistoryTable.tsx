"use client";

import { FileText } from "lucide-react";
import type { ReportItem } from "@/app/api/reports/route";
import { btnPrimary, EmptyState } from "@/components/dashboard/common/ui";
import { type ColumnDef, DataTable, StatusPill } from "@/components/data-table";
import { departmentLabel } from "@/lib/departments";
import { DEPT_FILTER, STATUS_FILTER } from "./constants";

const COLUMNS: ColumnDef<ReportItem>[] = [
  {
    accessor: "title",
    header: "Subject",
    sortable: true,
    render: (value, row) => (
      <div>
        <div className="text-white font-medium text-sm">{value}</div>
        <div className="text-xs text-sbi-muted-dark mt-0.5">
          {row.project || "n/a"}
        </div>
      </div>
    ),
  },
  {
    accessor: "director",
    header: "Assigned To",
    sortable: true,
    responsivePriority: 2,
  },
  {
    accessor: "department",
    header: "Department",
    sortable: true,
    responsivePriority: 3,
    render: (value) => departmentLabel(value),
  },
  {
    accessor: "date",
    header: "Date",
    sortable: true,
    responsivePriority: 2,
    render: (value) =>
      new Date(value).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
  },
  {
    accessor: "status",
    header: "Status",
    sortable: true,
    render: (value) => <StatusPill status={value} />,
  },
];

interface ReportHistoryTableProps {
  reports: ReportItem[];
  canCreate: boolean;
  onRowClick: (report: ReportItem) => void;
  onCreateClick: () => void;
}

export function ReportHistoryTable({
  reports,
  canCreate,
  onRowClick,
  onCreateClick,
}: ReportHistoryTableProps) {
  if (reports.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="h-6 w-6" />}
        title="No reports yet"
        description="Reports submitted by directors will appear here."
        action={
          canCreate ? (
            <button
              type="button"
              onClick={onCreateClick}
              className={btnPrimary}
            >
              Create First Report
            </button>
          ) : undefined
        }
      />
    );
  }

  return (
    <DataTable<ReportItem>
      data={reports}
      columns={COLUMNS}
      rowKey="id"
      searchable
      searchKeys={["title", "director", "numid", "department"]}
      searchPlaceholder="Search reports..."
      filters={[STATUS_FILTER, DEPT_FILTER]}
      pageSize={5}
      primaryColumn="title"
      onRowClick={onRowClick}
      columnToggle
      toggleFilter={{ key: "status", value: "Done", label: "Hide Done" }}
    />
  );
}
