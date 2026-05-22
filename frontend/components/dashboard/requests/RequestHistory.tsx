"use client";

import { type ColumnDef, DataTable } from "@/components/data-table/data-table";
import { StatusPill } from "@/components/data-table/status-pill";
import { departmentLabel } from "@/lib/departments";
import { STATUS_FILTER } from "./constants";
import type { RequestStatus } from "./StatusBadge";

export interface Request {
  id: string;
  name: string;
  email: string;
  subject: string;
  department: string;
  assignedTo: string;
  project: string;
  message: string;
  attachments: { id: string; name: string; size: string }[];
  status: RequestStatus;
  createdAt: Date;
  updatedAt: Date;
}

interface RequestHistoryProps {
  requests: Request[];
  onRowClick?: (request: Request) => void;
}

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);

const columns: ColumnDef<Request>[] = [
  {
    accessor: "subject",
    header: "Subject",
    sortable: true,
    render: (value, row) => (
      <div className="min-w-0">
        <p className="text-sm font-medium text-white truncate">{value}</p>
        <p className="text-xs text-sbi-muted truncate">{departmentLabel(row.department)}</p>
      </div>
    ),
  },
  {
    accessor: "name",
    header: "From",
    sortable: true,
  },
  {
    accessor: "createdAt",
    header: "Date",
    sortable: true,
    render: (value) => (
      <span className="text-xs text-sbi-muted whitespace-nowrap">{formatDate(value)}</span>
    ),
  },
  {
    accessor: "status",
    header: "Status",
    render: (value) => <StatusPill status={value} />,
  },
];

export function RequestHistory({ requests, onRowClick }: RequestHistoryProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <div className="w-8 h-px bg-sbi-green" />
        <p className="text-xs tracking-[0.2em] uppercase text-sbi-muted">Request History</p>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <DataTable<Request>
          data={requests}
          columns={columns}
          rowKey="id"
          searchable
          searchKeys={["subject", "name", "department", "project"]}
          searchPlaceholder="Search requests..."
          filters={[STATUS_FILTER]}
          pageSize={8}
          primaryColumn="subject"
          onRowClick={onRowClick}
        />
      </div>
    </div>
  );
}
