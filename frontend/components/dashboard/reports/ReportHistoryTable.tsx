"use client";

import { FileText } from "lucide-react";
import type { ReportItem } from "@/app/api/reports/route";
import { DataTable, type ColumnDef, StatusPill } from "@/components/data-table";
import { EmptyState, btnPrimary } from "@/components/dashboard/common/ui";
import { STATUS_FILTER, DEPT_FILTER } from "./constants";

const COLUMNS: ColumnDef<ReportItem>[] = [
  {
    accessor: "title",
    header: "Subject",
    sortable: true,
    render: (value, row) => (
      <div>
        <div className="text-white font-medium text-sm">{value}</div>
        <div className="text-xs text-sbi-muted-dark mt-0.5">{row.project || "n/a"}</div>
      </div>
    ),
  },
  { accessor: "director", header: "Assigned To", sortable: true },
  { accessor: "department", header: "Department", sortable: true },
  {
    accessor: "date",
    header: "Date",
    sortable: true,
    render: (value) =>
      new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
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
  isDirector: boolean;
  onRowClick: (report: ReportItem) => void;
  onCreateClick: () => void;
}

export function ReportHistoryTable({ reports, isDirector, onRowClick, onCreateClick }: ReportHistoryTableProps) {
  if (reports.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="h-6 w-6" />}
        title="No reports yet"
        description="Reports submitted by directors will appear here."
        action={
          isDirector ? (
            <button onClick={onCreateClick} className={btnPrimary}>
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
