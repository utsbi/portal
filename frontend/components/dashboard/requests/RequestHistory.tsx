"use client";

import { Calendar, Download, Eye, File, Mail, User } from "lucide-react";
import { useCallback } from "react";
import { type ColumnDef, DataTable } from "@/components/data-table/data-table";
import { type FilterDef } from "@/components/data-table/data-table-filters";
import { StatusPill } from "@/components/data-table/status-pill";
import { createClient } from "@/lib/supabase/client";
import { type RequestStatus } from "./StatusBadge";

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
    onStatusChange?: (requestId: string, newStatus: RequestStatus) => Promise<void>;
}

async function getSignedUrl(path: string): Promise<string | null> {
    const supabase = createClient();
    const { data, error } = await supabase.storage
        .from("ticket-attachments")
        .createSignedUrl(path, 3600);
    if (error) { console.error("Signed URL error:", error.message); return null; }
    return data.signedUrl;
}

const STATUS_FILTER_OPTIONS: FilterDef = {
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

const formatDate = (date: Date) =>
    new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(date);

export function RequestHistory({ requests, onStatusChange }: RequestHistoryProps) {
    const handleView = useCallback(async (path: string) => {
        const url = await getSignedUrl(path);
        if (url) window.open(url, "_blank", "noopener,noreferrer");
    }, []);

    const handleDownload = useCallback(async (path: string, name: string) => {
        const url = await getSignedUrl(path);
        if (!url) return;
        const blob = await fetch(url).then((r) => r.blob());
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
    }, []);

    const columns: ColumnDef<Request>[] = [
        {
            accessor: "subject",
            header: "Subject",
            sortable: true,
            render: (value, row) => (
                <div className="min-w-0">
                    <p className="text-sm font-light text-white truncate">{value}</p>
                    <p className="text-xs text-sbi-muted truncate">{row.department}</p>
                </div>
            ),
        },
        {
            accessor: "name",
            header: "Name",
            sortable: true,
        },
        {
            accessor: "createdAt",
            header: "Date",
            sortable: true,
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

    // Custom filter: when status filter is "all", show everything
    const filteredRequests = requests;

    const renderExpandedRow = (request: Request) => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-start gap-3">
                    <User className="w-4 h-4 text-sbi-green mt-1 shrink-0" />
                    <div>
                        <p className="text-xs tracking-[0.2em] uppercase text-sbi-muted mb-1">Name</p>
                        <p className="text-sm text-white">{request.name}</p>
                    </div>
                </div>

                <div className="flex items-start gap-3">
                    <Mail className="w-4 h-4 text-sbi-green mt-1 shrink-0" />
                    <div>
                        <p className="text-xs tracking-[0.2em] uppercase text-sbi-muted mb-1">Email</p>
                        <p className="text-sm text-white">{request.email}</p>
                    </div>
                </div>

                <div className="flex items-start gap-3">
                    <User className="w-4 h-4 text-sbi-green mt-1 shrink-0" />
                    <div>
                        <p className="text-xs tracking-[0.2em] uppercase text-sbi-muted mb-1">Assigned To</p>
                        <p className="text-sm text-white">{request.assignedTo || "Unassigned"}</p>
                    </div>
                </div>

                <div className="flex items-start gap-3">
                    <User className="w-4 h-4 text-sbi-green mt-1 shrink-0" />
                    <div>
                        <p className="text-xs tracking-[0.2em] uppercase text-sbi-muted mb-1">Project</p>
                        <p className="text-sm text-white">{request.project || "N/A"}</p>
                    </div>
                </div>

                <div className="flex items-start gap-3">
                    <Calendar className="w-4 h-4 text-sbi-green mt-1 shrink-0" />
                    <div>
                        <p className="text-xs tracking-[0.2em] uppercase text-sbi-muted mb-1">Created</p>
                        <p className="text-sm text-white">{formatDate(request.createdAt)}</p>
                    </div>
                </div>

                <div className="flex items-start gap-3">
                    <Calendar className="w-4 h-4 text-sbi-green mt-1 shrink-0" />
                    <div>
                        <p className="text-xs tracking-[0.2em] uppercase text-sbi-muted mb-1">Updated</p>
                        <p className="text-sm text-white">{formatDate(request.updatedAt)}</p>
                    </div>
                </div>
            </div>

            {onStatusChange && (
                <div className="flex items-center gap-4 pt-1">
                    <p className="text-xs tracking-[0.2em] uppercase text-sbi-muted shrink-0">Change Status</p>
                    <select
                        defaultValue={request.status}
                        onChange={(e) => onStatusChange(request.id, e.target.value as RequestStatus)}
                        className="appearance-none bg-sbi-dark-card border border-sbi-dark-border/50 text-sm text-white px-3 py-1.5 pr-8 hover:border-sbi-green/50 focus:border-sbi-green focus:outline-none transition-colors cursor-pointer"
                    >
                        <option value="pending">Pending</option>
                        <option value="in-progress">In Progress</option>
                        <option value="done">Done</option>
                        <option value="denied">Denied</option>
                    </select>
                </div>
            )}

            {request.message && (
                <div>
                    <p className="text-xs tracking-[0.2em] uppercase text-sbi-muted mb-3">Message</p>
                    <p className="text-sm text-white/80 leading-relaxed">{request.message}</p>
                </div>
            )}

            {request.attachments?.length > 0 && (
                <div>
                    <p className="text-xs tracking-[0.2em] uppercase text-sbi-muted mb-3">Attachments</p>
                    <div className="space-y-3">
                        {request.attachments.map((file) => (
                            <div key={file.id} className="border border-sbi-dark-border/30 hover:border-sbi-green/30 transition-colors">
                                <div className="flex items-center gap-3 p-3">
                                    <File className="w-4 h-4 text-sbi-green shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-white truncate">{file.name}</p>
                                        <p className="text-xs text-sbi-muted">{file.size}</p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => handleView(file.id)}
                                            title="View"
                                            className="p-1.5 text-sbi-muted hover:text-sbi-green transition-colors"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDownload(file.id, file.name)}
                                            title="Download"
                                            className="p-1.5 text-sbi-muted hover:text-sbi-green transition-colors"
                                        >
                                            <Download className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div className="flex flex-col h-full">
            {/* Section Header */}
            <div className="flex items-center gap-3 mb-4 shrink-0">
                <div className="w-8 h-px bg-sbi-green" />
                <p className="text-xs tracking-[0.2em] uppercase text-sbi-muted">
                    Request History
                </p>
            </div>

            {/* DataTable */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <DataTable<Request>
                    data={filteredRequests}
                    columns={columns}
                    rowKey="id"
                    searchable
                    searchKeys={["subject", "name", "department", "project"]}
                    searchPlaceholder="Search requests..."
                    filters={[STATUS_FILTER_OPTIONS]}
                    pageSize={8}
                    primaryColumn="subject"
                    renderExpandedRow={renderExpandedRow}
                />
            </div>
        </div>
    );
}
