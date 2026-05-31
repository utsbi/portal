"use client";

import { useMemo, useState } from "react";
import { type ColumnDef, DataTable } from "@/components/data-table/data-table";
import { StatusPill } from "@/components/data-table/status-pill";
import { departmentLabel } from "@/lib/departments";
import { cn } from "@/lib/utils";
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

type StatusFilterValue = "all" | RequestStatus;

const STATUS_CHIPS: { value: StatusFilterValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "in-progress", label: "In Progress" },
  { value: "done", label: "Done" },
  { value: "denied", label: "Denied" },
];

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
  const [activeStatus, setActiveStatus] = useState<StatusFilterValue>("all");

  const counts = useMemo(() => {
    const c: Record<StatusFilterValue, number> = {
      all: requests.length,
      pending: 0,
      "in-progress": 0,
      done: 0,
      denied: 0,
    };
    for (const r of requests) c[r.status] += 1;
    return c;
  }, [requests]);

  const filtered = useMemo(
    () =>
      activeStatus === "all"
        ? requests
        : requests.filter((r) => r.status === activeStatus),
    [requests, activeStatus],
  );

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4 flex flex-wrap gap-2 shrink-0">
        {STATUS_CHIPS.map((chip) => {
          const isActive = activeStatus === chip.value;
          const count = counts[chip.value];
          return (
            <button
              key={chip.value}
              type="button"
              onClick={() => setActiveStatus(chip.value)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs uppercase tracking-[0.15em] transition-colors",
                isActive
                  ? "border-sbi-green/60 bg-sbi-green/10 text-sbi-green"
                  : "border-sbi-dark-border/60 bg-sbi-dark-card/40 text-sbi-muted hover:border-sbi-dark-border hover:text-white",
              )}
            >
              <span>{chip.label}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                  isActive
                    ? "bg-sbi-green/20 text-sbi-green"
                    : "bg-white/5 text-sbi-muted-dark",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <DataTable<Request>
          data={filtered}
          columns={columns}
          rowKey="id"
          searchable
          searchKeys={["subject", "name", "department", "project"]}
          searchPlaceholder="Search requests..."
          pageSize={8}
          primaryColumn="subject"
          onRowClick={onRowClick}
        />
      </div>
    </div>
  );
}
