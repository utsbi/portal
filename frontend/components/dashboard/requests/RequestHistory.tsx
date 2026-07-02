"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { type ColumnDef, DataTable } from "@/components/data-table/data-table";
import { StatusPill } from "@/components/data-table/status-pill";
import { departmentLabel } from "@/lib/departments";
import type { RequestStatus } from "@/lib/supabase/requests";
import { cn } from "@/lib/utils";

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
        <p className="text-xs text-sbi-muted truncate">
          {departmentLabel(row.department)}
        </p>
      </div>
    ),
  },
  {
    accessor: "name",
    header: "From",
    sortable: true,
    responsivePriority: 2,
  },
  {
    accessor: "createdAt",
    header: "Date",
    sortable: true,
    responsivePriority: 2,
    render: (value) => (
      <span className="text-xs text-sbi-muted whitespace-nowrap">
        {formatDate(value)}
      </span>
    ),
  },
  {
    accessor: "status",
    header: "Status",
    render: (value) => <StatusPill status={value} />,
  },
];

const SEARCH_KEYS: (keyof Request)[] = [
  "subject",
  "name",
  "department",
  "project",
];

export function RequestHistory({ requests, onRowClick }: RequestHistoryProps) {
  const [activeStatus, setActiveStatus] = useState<StatusFilterValue>("all");
  const [searchQuery, setSearchQuery] = useState("");

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

  const filtered = useMemo(() => {
    const byStatus =
      activeStatus === "all"
        ? requests
        : requests.filter((r) => r.status === activeStatus);
    const q = searchQuery.trim().toLowerCase();
    if (!q) return byStatus;
    return byStatus.filter((r) =>
      SEARCH_KEYS.some((key) => {
        const v = r[key];
        return typeof v === "string" && v.toLowerCase().includes(q);
      }),
    );
  }, [requests, activeStatus, searchQuery]);

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4 flex flex-wrap items-center gap-3 shrink-0">
        {/* Search (left, grows) */}
        <div className="relative w-full group sm:w-auto sm:grow sm:min-w-[240px] sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-sbi-muted-dark group-focus-within:text-sbi-green transition-colors" />
          <input
            type="text"
            placeholder="Search requests..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm bg-sbi-input rounded-lg border border-sbi-dark-border/60 text-white placeholder:text-sbi-muted-dark focus:outline-none focus:border-sbi-green/40 transition-colors"
          />
        </div>

        {/* Status chips (right). One scrollable row on phones (scrollbar
            hidden, overscroll contained); wraps normally from sm up. */}
        <div className="ml-auto flex w-full items-center gap-1.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:w-auto sm:flex-wrap sm:overflow-x-visible">
          {STATUS_CHIPS.map((chip) => {
            const isActive = activeStatus === chip.value;
            const count = counts[chip.value];
            return (
              <button
                key={chip.value}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActiveStatus(chip.value)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3",
                  isActive
                    ? "border-sbi-green/60 bg-sbi-green/10 text-sbi-green shadow-[inset_0_0_0_1px_currentColor]"
                    : "border-sbi-dark-border/60 bg-transparent text-sbi-muted hover:bg-white/5 hover:text-white",
                )}
              >
                <span>{chip.label}</span>
                <span className="tabular-nums opacity-70">· {count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar -mr-4 sm:-mr-6 md:-mr-8 pr-4 sm:pr-6 md:pr-8">
        <DataTable<Request>
          data={filtered}
          columns={columns}
          rowKey="id"
          pageSize={8}
          primaryColumn="subject"
          onRowClick={onRowClick}
        />
      </div>
    </div>
  );
}
