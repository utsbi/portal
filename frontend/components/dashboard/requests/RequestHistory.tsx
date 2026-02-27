"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, File, Calendar, User, Mail, ChevronLeft, ChevronRight, Search, X, Download, Eye } from "lucide-react";
import { StatusBadge, type RequestStatus } from "./StatusBadge";
import { createClient } from "@/lib/supabase/client";

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

const ITEMS_PER_PAGE = 10;

const STATUS_OPTIONS: { label: string; value: RequestStatus | "all" }[] = [
    { label: "All Statuses", value: "all" },
    { label: "Pending", value: "pending" },
    { label: "In Progress", value: "in-progress" },
    { label: "Done", value: "done" },
    { label: "Denied", value: "denied" },
];

async function getSignedUrl(path: string): Promise<string | null> {
    const supabase = createClient();
    const { data, error } = await supabase.storage
        .from("request-attachments")
        .createSignedUrl(path, 3600);
    if (error) { console.error("Signed URL error:", error.message); return null; }
    return data.signedUrl;
}


export function RequestHistory({ requests, onStatusChange }: RequestHistoryProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState("");
    const [loadingUrls, setLoadingUrls] = useState<Record<string, boolean>>({});
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const handleStatusChange = useCallback(
        async (requestId: string, newStatus: RequestStatus) => {
            if (!onStatusChange) return;
            setUpdatingId(requestId);
            await onStatusChange(requestId, newStatus);
            setUpdatingId(null);
        },
        [onStatusChange]
    );

    const handleView = useCallback(async (path: string) => {
        setLoadingUrls((prev) => ({ ...prev, [path]: true }));
        const url = await getSignedUrl(path);
        setLoadingUrls((prev) => ({ ...prev, [path]: false }));
        if (url) window.open(url, "_blank", "noopener,noreferrer");
    }, []);

    const handleDownload = useCallback(async (path: string, name: string) => {
        setLoadingUrls((prev) => ({ ...prev, [path]: true }));
        const url = await getSignedUrl(path);
        setLoadingUrls((prev) => ({ ...prev, [path]: false }));
        if (!url) return;
        // Fetch as blob so the browser saves to disk instead of navigating
        const blob = await fetch(url).then((r) => r.blob());
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
    }, []);
    const [statusFilter, setStatusFilter] = useState<RequestStatus | "all">("all");

    const filteredRequests = requests.filter((req) => {
        const matchesSearch =
            searchQuery.trim() === "" ||
            req.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
            req.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            req.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
            req.project.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesStatus = statusFilter === "all" || req.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    const totalPages = Math.ceil(filteredRequests.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const currentRequests = filteredRequests.slice(startIndex, endIndex);

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        setCurrentPage(1);
        setExpandedId(null);
    };

    const handleStatusFilterChange = (value: RequestStatus | "all") => {
        setStatusFilter(value);
        setCurrentPage(1);
        setExpandedId(null);
    };

    const clearSearch = () => {
        setSearchQuery("");
        setCurrentPage(1);
        setExpandedId(null);
    };

    const toggleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    const formatDate = (date: Date) => {
        return new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        }).format(date);
    };

    const goToNextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
            setExpandedId(null);
        }
    };

    const goToPreviousPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
            setExpandedId(null);
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Section Header with Search & Filter */}
            <div className="flex items-center justify-between gap-3 mb-6 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-px bg-sbi-green" />
                    <p className="text-xs tracking-[0.2em] uppercase text-sbi-muted">
                        Request History
                    </p>
                </div>

                {/* Search + Filter Controls */}
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-sbi-muted pointer-events-none" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            placeholder="Search requests..."
                            className="bg-sbi-dark-card border border-sbi-dark-border/50 text-white text-xs placeholder:text-sbi-muted pl-6 pr-6 py-1.5 w-45 focus:outline-none focus:border-sbi-green/50 transition-colors"
                        />
                        {searchQuery && (
                            <button
                                onClick={clearSearch}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-sbi-muted hover:text-white transition-colors"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </div>

                    <select
                        value={statusFilter}
                        onChange={(e) => handleStatusFilterChange(e.target.value as RequestStatus | "all")}
                        className="bg-sbi-dark-card border border-sbi-dark-border/50 text-sbi-muted text-xs py-1.5 px-2 focus:outline-none focus:border-sbi-green/50 transition-colors appearance-none cursor-pointer pr-6"
                        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" }}
                    >
                        {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value} className="bg-sbi-dark-card">
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Column Headers */}
            {filteredRequests.length > 0 && (
                <div className="grid grid-cols-[auto_1fr_160px_120px_160px] gap-4 px-4 pb-2 border-b border-sbi-dark-border/40 shrink-0">
                    <div className="w-4" /> {/* chevron spacer */}
                    <p className="text-xs tracking-[0.15em] uppercase text-sbi-muted">Subject</p>
                    <p className="text-xs tracking-[0.15em] uppercase text-sbi-muted">Name</p>
                    <p className="text-xs tracking-[0.15em] uppercase text-sbi-muted">Date</p>
                    <p className="text-xs tracking-[0.15em] uppercase text-sbi-muted">Status</p>
                </div>
            )}

            {/* Request Rows (Scrollable Area) */}
            <div className="flex-1 overflow-y-auto pr-2 space-y-1 mt-4 custom-scrollbar">
                {currentRequests.map((request, index) => {
                    const isExpanded = expandedId === request.id;

                    return (
                        <motion.div
                            key={request.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.04 }}
                            className="border border-sbi-dark-border/50 bg-sbi-dark-card hover:border-sbi-green/30 transition-all duration-300"
                        >
                            {/* Compact Row */}
                            <button
                                type="button"
                                onClick={() => toggleExpand(request.id)}
                                className="w-full grid grid-cols-[auto_1fr_160px_120px_160px] gap-4 items-center px-4 py-3 text-left"
                            >
                                {/* Expand Icon */}
                                <motion.div
                                    animate={{ rotate: isExpanded ? 180 : 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="text-sbi-muted w-4 relative"
                                    style={{ height: '16px' }}
                                >
                                    <ChevronDown className="w-4 h-4 absolute top-0 left-0" />
                                </motion.div>

                                {/* Subject + Department */}
                                <div className="min-w-0">
                                    <p className="text-sm font-light text-white truncate">
                                        {request.subject}
                                    </p>
                                    <p className="text-xs text-sbi-muted truncate">
                                        {request.department}
                                    </p>
                                </div>

                                {/* Name */}
                                <p className="text-xs text-white/80 truncate">{request.name}</p>

                                {/* Date */}
                                <p className="text-xs text-sbi-muted whitespace-nowrap">
                                    {formatDate(request.createdAt)}
                                </p>

                                {/* Status Badge */}
                                <div className="flex justify-start">
                                    <StatusBadge status={request.status} />
                                </div>
                            </button>

                            {/* Expanded Details */}
                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                                        className="overflow-hidden border-t border-sbi-dark-border/30"
                                    >
                                        <div className="p-6 space-y-6">
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


                                            {/* Status changer - only shown if caller provides onStatusChange */}
                                            {onStatusChange && (
                                                <div className="flex items-center gap-4 pt-1">
                                                    <p className="text-xs tracking-[0.2em] uppercase text-sbi-muted shrink-0">Change Status</p>
                                                    <div className="relative">
                                                        <select
                                                            value={request.status}
                                                            disabled={updatingId === request.id}
                                                            onChange={(e) =>
                                                                handleStatusChange(request.id, e.target.value as RequestStatus)
                                                            }
                                                            className={`appearance-none bg-sbi-dark-card border border-sbi-dark-border/50 text-sm text-white px-3 py-1.5 pr-8 hover:border-sbi-green/50 focus:border-sbi-green focus:outline-none transition-colors cursor-pointer ${updatingId === request.id ? "opacity-50 cursor-not-allowed" : ""}`}
                                                        >
                                                            <option value="pending">Pending</option>
                                                            <option value="in-progress">In Progress</option>
                                                            <option value="done">Done</option>
                                                            <option value="denied">Denied</option>
                                                        </select>
                                                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-sbi-muted pointer-events-none" />
                                                    </div>
                                                    {updatingId === request.id && (
                                                        <span className="text-xs text-sbi-muted animate-pulse">Saving...</span>
                                                    )}
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
                                                        {request.attachments.map((file) => {
                                                            const isLoading = loadingUrls[file.id];
                                                            return (
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
                                                                                disabled={isLoading}
                                                                                title="View"
                                                                                className="p-1.5 text-sbi-muted hover:text-sbi-green disabled:opacity-40 transition-colors"
                                                                            >
                                                                                <Eye className="w-4 h-4" />
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleDownload(file.id, file.name)}
                                                                                disabled={isLoading}
                                                                                title="Download"
                                                                                className="p-1.5 text-sbi-muted hover:text-sbi-green disabled:opacity-40 transition-colors"
                                                                            >
                                                                                <Download className="w-4 h-4" />
                                                                            </button>
                                                                        </div>
                                                                    </div>

                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    );
                })}

                {filteredRequests.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center py-12 border border-dashed border-sbi-dark-border"
                    >
                        <p className="text-sm text-sbi-muted">
                            {requests.length === 0 ? "No requests yet" : "No requests match your search"}
                        </p>
                        <p className="text-xs text-sbi-muted mt-1">
                            {requests.length === 0
                                ? "Submit your first request using the form"
                                : "Try adjusting your search or filter"}
                        </p>
                    </motion.div>
                )}
            </div>

            {/* Pagination Controls */}
            {filteredRequests.length > 0 && totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 pb-2 border-t border-sbi-dark-border/30 shrink-0">
                    <p className="text-xs text-sbi-muted">
                        Showing {startIndex + 1}-{Math.min(endIndex, filteredRequests.length)} of {filteredRequests.length}
                        {statusFilter !== "all" || searchQuery ? ` (filtered from ${requests.length})` : ""}
                    </p>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={goToPreviousPage}
                            disabled={currentPage === 1}
                            className="p-2 border border-sbi-dark-border/50 hover:border-sbi-green/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4 text-white" />
                        </button>

                        <span className="text-xs text-sbi-muted px-3">
                            Page {currentPage} of {totalPages}
                        </span>

                        <button
                            onClick={goToNextPage}
                            disabled={currentPage === totalPages}
                            className="p-2 border border-sbi-dark-border/50 hover:border-sbi-green/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronRight className="w-4 h-4 text-white" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
