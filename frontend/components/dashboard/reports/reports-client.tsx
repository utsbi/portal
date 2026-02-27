"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
    Loader2,
    Search,
    Filter,
    X,
    FileText,
    CheckCircle2,
    Clock,
    Ban,
    AlertCircle,
    ChevronDown,
    ChevronUp,
    BarChart3,
} from "lucide-react";
import type { ReportItem } from "@/app/api/reports/route";
import { cn } from "@/lib/utils";
import { ReportsOverview } from "./reports-overview";

import { SearchableDropdown } from "@/components/ui/searchable-dropdown";

const DEPARTMENTS = [
    { value: "All Depts", label: "All Departments" },
    { value: "Architecture", label: "Architecture" },
    {
        label: "Engineering", options: [
            { value: "Engineering General", label: "General" },
            { value: "Civil", label: "Civil" },
            { value: "Environmental", label: "Environmental" },
            { value: "Structural", label: "Structural" },
            { value: "Electrical", label: "Electrical" },
        ]
    },
    { value: "Finance", label: "Finance" },
    { value: "Public Relations", label: "Public Relations" },
    { value: "Marketing", label: "Marketing" },
    { value: "Internal Technologies", label: "Internal Tech" },
    { value: "Legal", label: "Legal" },
    { value: "R&D", label: "R&D" },
];

const STATUS_OPTIONS = [
    { value: "All", label: "All Status" },
    { value: "Pending", label: "Pending" },
    { value: "In Progress", label: "In Progress" },
    { value: "Done", label: "Done" },
    { value: "Denied", label: "Denied" },
];

const TIMEFRAME_OPTIONS = [
    { value: "All Time", label: "All Time" },
    { value: "This Week", label: "This Week" },
    { value: "This Month", label: "This Month" },
    { value: "Last Month", label: "Last Month" },
    { value: "Custom Range", label: "Custom Range" },
];


export function ReportsClient() {
    const [reports, setReports] = useState<ReportItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("All");
    const [teamFilter, setTeamFilter] = useState<string>("All Depts");
    const [timeframeFilter, setTimeframeFilter] = useState<string>("All Time");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    type SortColumn = 'numid' | 'status' | 'title' | 'department' | 'date' | 'director' | null;
    const [sortColumn, setSortColumn] = useState<SortColumn>("numid");
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    const ITEMS_PER_PAGE = 5;
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        try {
            const response = await fetch(`/api/reports?t=${Date.now()}`, {
                cache: "no-store",
                headers: {
                    "Pragma": "no-cache"
                }
            });
            if (!response.ok) throw new Error("Failed to fetch reports");
            const data = await response.json();
            setReports(data);
        } catch (error) {
            console.error("Error fetching reports:", error);
        } finally {
            setLoading(false);
        }
    };

    const isDateInTimeframe = (dateString: string, timeframe: string) => {
        if (timeframe === "All Time") return true;

        const date = new Date(dateString);
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (timeframe === "This Week") {
            const startOfWeek = new Date(startOfToday);
            startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay()); // Sunday
            return date >= startOfWeek;
        }

        if (timeframe === "This Month") {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            return date >= startOfMonth;
        }

        if (timeframe === "Last Month") {
            const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            return date >= startOfLastMonth && date < startOfThisMonth;
        }

        if (timeframe === "Custom Range") {
            if (startDate && dateString < startDate) return false;
            if (endDate && dateString > endDate) return false;
            return true;
        }

        return true;
    };

    const filteredReports = reports.filter((req) => {
        const matchesSearch =
            req.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            req.director.toLowerCase().includes(searchQuery.toLowerCase()) ||
            req.numid.includes(searchQuery);
        const matchesStatus =
            statusFilter === "All" || req.status === statusFilter;
        const matchesTeam =
            teamFilter === "All Depts" || req.department === teamFilter;
        const matchesTimeframe = isDateInTimeframe(req.date, timeframeFilter);

        return matchesSearch && matchesStatus && matchesTeam && matchesTimeframe;
    });

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, statusFilter, teamFilter, timeframeFilter]);

    const sortedReports = useMemo(() => {
        if (!sortColumn) return filteredReports;

        return [...filteredReports].sort((a, b) => {
            let aVal: any = a[sortColumn];
            let bVal: any = b[sortColumn];

            if (sortColumn === 'status') {
                const statusOrder = { 'Done': 1, 'In Progress': 2, 'Pending': 3, 'Denied': 4 };
                aVal = statusOrder[a.status as keyof typeof statusOrder] || 5;
                bVal = statusOrder[b.status as keyof typeof statusOrder] || 5;
            } else if (sortColumn === 'date') {
                aVal = new Date(a.date).getTime();
                bVal = new Date(b.date).getTime();
            } else if (sortColumn === 'numid') {
                aVal = parseInt(a.numid, 10) || 0;
                bVal = parseInt(b.numid, 10) || 0;
            } else {
                if (typeof aVal === 'string') aVal = aVal.toLowerCase();
                if (typeof bVal === 'string') bVal = bVal.toLowerCase();
            }

            if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredReports, sortColumn, sortDirection]);

    const handleSort = (column: SortColumn) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const renderSortIcon = (column: SortColumn) => {
        if (sortColumn !== column) return null;
        return sortDirection === 'asc' ?
            <ChevronUp className="w-3 h-3 inline-block ml-1 text-sbi-green transition-transform" /> :
            <ChevronDown className="w-3 h-3 inline-block ml-1 text-sbi-green transition-transform" />;
    };

    const totalPages = Math.ceil(sortedReports.length / ITEMS_PER_PAGE);
    const paginatedReports = sortedReports.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const getStatusColor = (status: string) => {
        switch (status) {
            case "Done":
                return "text-sbi-green bg-sbi-green/10 border-sbi-green/20";
            case "Denied":
                return "text-red-400 bg-red-400/10 border-red-400/20";
            case "In Progress":
                return "text-blue-400 bg-blue-400/10 border-blue-400/20";
            case "Pending":
                return "text-amber-400 bg-amber-400/10 border-amber-400/20";
            default:
                return "text-sbi-muted bg-sbi-muted/10 border-sbi-muted/20";
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "Done":
                return <CheckCircle2 className="w-3.5 h-3.5" />;
            case "Denied":
                return <Ban className="w-3.5 h-3.5" />;
            case "In Progress":
                return <Clock className="w-3.5 h-3.5" />;
            case "Pending":
                return <AlertCircle className="w-3.5 h-3.5" />;
            default:
                return null;
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px] bg-sbi-dark text-sbi-muted">
                <Loader2 className="w-8 h-8 text-sbi-green animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-4rem)] bg-sbi-dark font-urbanist text-sbi-muted overflow-hidden flex-col">
            <main className="flex-1 overflow-auto p-6 md:p-10 dashboard-scrollbar flex flex-col w-full">

                {/* Header Section */}
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-light text-white tracking-wide">
                        Reports
                    </h1>
                    <button className="bg-sbi-green hover:bg-green-500 text-black font-semibold px-4 py-2 rounded-md flex items-center gap-2 text-sm transition-colors">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
                        New Report
                    </button>
                </div>

                {/* Permanent Overview Section */}
                <section className="mb-12">
                    <ReportsOverview reports={reports} />
                </section>

                {/* Sub-Header & Filters */}
                <div className="flex flex-wrap justify-between items-end mb-6 gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-[2px] bg-sbi-green" />
                        <h2 className="text-[11px] tracking-[0.2em] uppercase text-sbi-muted font-bold">
                            Report History
                        </h2>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sbi-muted-dark" />
                            <input
                                type="text"
                                placeholder="Search reports..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 pr-4 py-2 text-sm bg-[#0a0f0c] border border-white/5 rounded-md text-white placeholder:text-sbi-muted-dark focus:outline-none focus:border-sbi-green/30 transition-colors w-64 shadow-sm"
                            />
                        </div>
                        <SearchableDropdown
                            value={statusFilter}
                            onChange={setStatusFilter}
                            options={STATUS_OPTIONS}
                            className="w-40"
                        />
                    </div>
                </div>

                {/* Table Headers */}
                <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-white/5 mb-4 text-[10px] tracking-[0.2em] uppercase text-sbi-muted-dark font-bold">
                    <div className="col-span-5">Subject</div>
                    <div className="col-span-3">Name</div>
                    <div className="col-span-2">Date</div>
                    <div className="col-span-2">Status</div>
                </div>

                {/* List Items */}
                <div className="flex flex-col gap-[2px]">
                    {paginatedReports.map((report) => (
                        <div
                            key={report.id}
                            onClick={() => setSelectedReport(report)}
                            className="group grid grid-cols-12 gap-4 px-6 py-4 bg-[#0d130f] hover:bg-[#121814] rounded-lg items-center cursor-pointer transition-colors border border-transparent hover:border-white/5"
                        >
                            <div className="col-span-5 flex items-center gap-4">
                                <ChevronDown className="w-4 h-4 text-sbi-muted-dark group-hover:text-white transition-colors stretch-0 shrink-0" />
                                <div>
                                    <div className="text-white font-medium text-sm">{report.title}</div>
                                    <div className="text-xs text-sbi-muted-dark mt-0.5">{report.project || "n/a"}</div>
                                </div>
                            </div>
                            <div className="col-span-3 text-xs text-sbi-muted">
                                {report.director}
                            </div>
                            <div className="col-span-2 text-xs text-sbi-muted">
                                {formatDate(report.date)}
                            </div>
                            <div className="col-span-2 flex items-center gap-2">
                                <div className={cn("w-1.5 h-1.5 rounded-full",
                                    report.status === "Done" ? "bg-sbi-green" :
                                        report.status === "Pending" ? "bg-red-500" :
                                            report.status === "Denied" ? "bg-red-500" :
                                                "bg-blue-400"
                                )} />
                                <span className={cn("text-[10px] tracking-wider uppercase font-semibold",
                                    report.status === "Done" ? "text-sbi-green" :
                                        report.status === "Pending" ? "text-red-500" :
                                            report.status === "Denied" ? "text-red-500" :
                                                "text-blue-400"
                                )}>
                                    {report.status}
                                </span>
                            </div>
                        </div>
                    ))}
                    {sortedReports.length === 0 && (
                        <div className="text-center py-12 text-sbi-muted-dark text-sm">
                            No reports found.
                        </div>
                    )}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-6 px-4">
                        <span className="text-sm text-sbi-muted-dark">
                            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, sortedReports.length)} of {sortedReports.length} results
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 text-sm rounded-md bg-[#0a0f0c] border border-white/5 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/5 transition-colors"
                            >
                                Previous
                            </button>
                            <span className="text-sm text-sbi-muted px-2">
                                Page {currentPage} of {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1.5 text-sm rounded-md bg-[#0a0f0c] border border-white/5 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/5 transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </main>

            {/* Detail View Modal (Legal Document Style - Dark Mode) */}
            <AnimatePresence>
                {selectedReport && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedReport(null)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />

                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="relative w-full max-w-5xl h-[85vh] bg-sbi-dark shadow-2xl flex flex-col z-10 border border-sbi-dark-border rounded-xl overflow-hidden"
                        >
                            {/* Modal Header */}
                            <div className="flex items-center justify-between p-6 border-b border-sbi-dark-border bg-sbi-dark">
                                <div>
                                    <h2 className="text-xl font-bold text-white font-urbanist">{selectedReport.title}</h2>
                                    <p className="text-sm text-sbi-muted mt-1 font-mono">ID: #{selectedReport.numid} • {selectedReport.department}</p>
                                </div>
                                <button
                                    onClick={() => setSelectedReport(null)}
                                    className="p-2 text-sbi-muted hover:text-white rounded-full hover:bg-sbi-dark-card transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            {/* "Legal Document" Content */}
                            <div className="flex-1 overflow-y-auto bg-sbi-dark-card p-8 md:p-12 font-old-standard">
                                <div className="bg-sbi-dark border border-sbi-dark-border shadow-2xl min-h-[1000px] p-16 max-w-3xl mx-auto flex flex-col relative text-gray-200">
                                    {/* Watermark / Brand */}
                                    <div className="absolute top-16 right-16 opacity-[0.03] pointer-events-none text-white">
                                        <FileText className="w-48 h-48" />
                                    </div>

                                    {/* Legal Header */}
                                    <div className="border-b border-white/20 pb-8 mb-12 flex justify-between items-end">
                                        <div className="space-y-4">
                                            <div className="text-4xl font-bold tracking-tight uppercase text-white">Confidential Report</div>
                                            <div className="text-sm uppercase tracking-[0.2em] text-sbi-muted font-sans">Sustainable Building Initiative • UT Austin</div>
                                        </div>
                                        <div className="text-right space-y-1 font-mono text-sm text-sbi-muted">
                                            <div>REF NO.</div>
                                            <div className="text-white">{selectedReport.id}-{selectedReport.numid}</div>
                                        </div>
                                    </div>

                                    {/* Document Body */}
                                    <div className="flex-1 space-y-10 text-lg leading-relaxed text-gray-300">
                                        <section>
                                            <h3 className="font-sans text-xs font-bold uppercase text-sbi-muted-dark tracking-widest mb-4">1.0 Executive Summary</h3>
                                            <p>
                                                This document serves as the formal record for <strong className="text-white">{selectedReport.title}</strong> (Project: {selectedReport.project || "N/A"}), initiated by <strong className="text-white">{selectedReport.name || "Unknown Sender"}</strong> ({selectedReport.email || "No Email Provided"}) within the {selectedReport.department} department on {selectedReport.date}.
                                                The scope of this report focuses on the strategic initiatives overseen by <strong className="text-white">{selectedReport.director}</strong>.
                                            </p>
                                            {selectedReport.customer_id && (
                                                <p className="mt-2 text-sm text-sbi-muted">Customer ID Reference: <span className="font-mono text-white">{selectedReport.customer_id}</span></p>
                                            )}
                                        </section>

                                        <section>
                                            <h3 className="font-sans text-xs font-bold uppercase text-sbi-muted-dark tracking-widest mb-4">2.0 Status & Deliverables</h3>
                                            <p>
                                                Current status is officially logged as:
                                                <span className={cn(
                                                    "inline-block px-3 py-1 mx-2 text-sm font-sans font-medium uppercase tracking-wider border rounded",
                                                    selectedReport.status === "Done" ? "border-green-500/30 text-green-400 bg-green-500/10" :
                                                        selectedReport.status === "Denied" ? "border-red-500/30 text-red-400 bg-red-500/10" :
                                                            selectedReport.status === "Pending" ? "border-amber-500/30 text-amber-400 bg-amber-500/10" :
                                                                "border-blue-500/30 text-blue-400 bg-blue-500/10"
                                                )}>
                                                    {selectedReport.status}
                                                </span>
                                            </p>
                                            <p className="mt-4">
                                                All associated milestones are under the direct supervision of the assigned Director. Any compliance issues must be flagged immediately.
                                            </p>
                                        </section>

                                        {selectedReport.message && (
                                            <section>
                                                <h3 className="font-sans text-xs font-bold uppercase text-sbi-muted-dark tracking-widest mb-4">3.0 Detailed Message</h3>
                                                <div className="bg-sbi-dark-card border border-sbi-dark-border p-6 rounded text-gray-300 font-sans text-sm whitespace-pre-wrap">
                                                    {selectedReport.message}
                                                </div>
                                            </section>
                                        )}

                                        <section>
                                            <h3 className="font-sans text-xs font-bold uppercase text-sbi-muted-dark tracking-widest mb-4">4.0 Database Record</h3>
                                            <div className="bg-sbi-dark border border-sbi-dark-border p-6 rounded font-mono text-sm grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                                                <div><span className="text-sbi-muted-dark">uuid:</span> <span className="text-gray-300 break-all">{selectedReport.uuid}</span></div>
                                                <div><span className="text-sbi-muted-dark">customer_id:</span> <span className="text-gray-300">{selectedReport.customer_id || "null"}</span></div>
                                                <div><span className="text-sbi-muted-dark">name:</span> <span className="text-gray-300">{selectedReport.name || "null"}</span></div>
                                                <div><span className="text-sbi-muted-dark">email:</span> <span className="text-gray-300">{selectedReport.email || "null"}</span></div>
                                                <div><span className="text-sbi-muted-dark">department:</span> <span className="text-gray-300">{selectedReport.department}</span></div>
                                                <div><span className="text-sbi-muted-dark">assign_to:</span> <span className="text-gray-300">{selectedReport.assign_to || "null"}</span></div>
                                                <div><span className="text-sbi-muted-dark">project:</span> <span className="text-gray-300">{selectedReport.project || "null"}</span></div>
                                                <div><span className="text-sbi-muted-dark">subject:</span> <span className="text-gray-300">{selectedReport.subject || "null"}</span></div>
                                                <div><span className="text-sbi-muted-dark">status:</span> <span className="text-gray-300">{selectedReport.status}</span></div>
                                                <div><span className="text-sbi-muted-dark">created_at:</span> <span className="text-gray-300">{selectedReport.created_at || "null"}</span></div>
                                                <div><span className="text-sbi-muted-dark">updated_at:</span> <span className="text-gray-300">{selectedReport.updated_at || "null"}</span></div>
                                                <div><span className="text-sbi-muted-dark">attachments:</span> <span className="text-gray-300">{selectedReport.attachments ? JSON.stringify(selectedReport.attachments) : "null"}</span></div>
                                                <div className="col-span-full"><span className="text-sbi-muted-dark">message:</span> <span className="text-gray-300 break-words">{selectedReport.message || "null"}</span></div>
                                            </div>
                                        </section>

                                        {selectedReport.updated_at && (
                                            <p className="text-xs text-sbi-muted text-right font-mono mt-8">
                                                Last Updated: {new Date(selectedReport.updated_at).toLocaleString()}
                                            </p>
                                        )}

                                        {/* Exhibits */}
                                        <section className="py-6">
                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="aspect-[4/3] bg-sbi-dark-card border border-sbi-dark-border flex flex-col items-center justify-center gap-3 text-sbi-muted p-4 text-center hover:border-sbi-green/30 transition-colors">
                                                    <FileText className="w-10 h-10 opacity-30" />
                                                    <span className="text-[10px] font-sans uppercase tracking-widest text-sbi-muted-dark">Exhibit A: Financials</span>
                                                </div>
                                                <div className="aspect-[4/3] bg-sbi-dark-card border border-sbi-dark-border flex flex-col items-center justify-center gap-3 text-sbi-muted p-4 text-center hover:border-sbi-green/30 transition-colors">
                                                    <FileText className="w-10 h-10 opacity-30" />
                                                    <span className="text-[10px] font-sans uppercase tracking-widest text-sbi-muted-dark">Exhibit B: Timeline</span>
                                                </div>
                                            </div>
                                        </section>
                                    </div>

                                    {/* Footer/Signature */}
                                    <div className="mt-20 pt-12 border-t border-white/20">
                                        <div className="grid grid-cols-2 gap-20">
                                            <div>
                                                <div className="h-px w-full bg-white/30 mb-3"></div>
                                                <div className="text-[10px] uppercase tracking-widest text-sbi-muted font-sans">Authorized By</div>
                                                <div className="font-serif text-xl italic mt-2 text-white">Director of {selectedReport.department}</div>
                                            </div>
                                            <div>
                                                <div className="h-px w-full bg-white/30 mb-3"></div>
                                                <div className="text-[10px] uppercase tracking-widest text-sbi-muted font-sans">Accepted By</div>
                                                <div className="font-serif text-xl italic mt-2 text-white">{selectedReport.director}</div>
                                            </div>
                                        </div>
                                        <div className="text-center mt-16 flex flex-col items-center gap-2 opacity-50">
                                            <div className="w-8 h-8 rounded-full border border-white/30 flex items-center justify-center text-white/50">
                                                <span className="font-serif italic font-bold">SBI</span>
                                            </div>
                                            <div className="text-[10px] tracking-widest font-sans uppercase text-sbi-muted-dark">Official Electronic Record</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer Actions */}
                            <div className="p-6 border-t border-sbi-dark-border bg-sbi-dark flex justify-between items-center z-20">
                                <span className="text-xs text-sbi-muted-dark font-mono">DOC_ID: {selectedReport.id}</span>
                                <div className="flex gap-3">
                                    <button className="px-5 py-2.5 text-sm font-medium text-sbi-muted hover:text-white hover:bg-sbi-dark-card rounded-lg transition-colors font-urbanist">
                                        Download PDF
                                    </button>
                                    <button className="px-5 py-2.5 text-sm font-medium text-sbi-dark-btn bg-sbi-green hover:bg-green-400 rounded-lg transition-colors font-urbanist shadow-lg shadow-sbi-green/20">
                                        Approve Report
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
