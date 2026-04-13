"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X, FileText } from "lucide-react";
import type { ReportItem } from "@/app/api/reports/route";
import { cn } from "@/lib/utils";
import { ReportsOverview } from "./reports-overview";
import { DataTable, type ColumnDef, StatusPill } from "@/components/data-table";
import type { FilterDef } from "@/components/data-table";

const DIRECTORS = [
    { name: "Pedro Guzman",     title: "President",                         email: "pedro@utsbi.org" },
    { name: "Sam Moran",        title: "Vice President",                    email: "sam@utsbi.org" },
    { name: "Brendan Lyon",     title: "Director of Project Operations",    email: "brendan@utsbi.org" },
    { name: "Kabir Muzumdar",   title: "Director of Civil Engineering",     email: "kabir@utsbi.org" },
    { name: "Preston Vajdos",   title: "Director of Civil Engineering",     email: "vajdosp@utsbi.org" },
    { name: "Enoch Zhu",        title: "Director of External Technologies", email: "enoch@utsbi.org" },
    { name: "Daniel Lam",       title: "Director of Internal Technologies", email: "daniel@utsbi.org" },
    { name: "Dev Shroff",       title: "Director of Business",              email: "dev@utsbi.org" },
    { name: "Arianne Grace",    title: "Director of Public Relations",      email: "ariannegraceyude@utsbi.org" },
    { name: "Christian Butler", title: "Director of Architecture",          email: "christian.butler@utsbi.org" },
    { name: "Alim Makanov",     title: "Director of Legal",                 email: "alim.makanov@utsbi.org" },
];

const STATUS_FILTER: FilterDef = {
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


const DEPT_FILTER: FilterDef = {
    key: "department",
    label: "Department",
    defaultValue: "All Depts",
    width: "w-48",
    options: [
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
    ],
};

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
    {
        accessor: "director",
        header: "Assigned To",
        sortable: true,
    },
    {
        accessor: "department",
        header: "Department",
        sortable: true,
    },
    {
        accessor: "date",
        header: "Date",
        sortable: true,
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

export function ReportsClient({ initialReports }: { initialReports: ReportItem[] }) {
    const [reports, setReports] = useState<ReportItem[]>(initialReports);
    const [loading, setLoading] = useState(initialReports.length === 0);
    const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
    const [isCreatingModalOpen, setIsCreatingModalOpen] = useState(false);
    
    // New Report Form State
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCustomProject, setIsCustomProject] = useState(false);
    const [newReportForm, setNewReportForm] = useState({ title: "", department: "Engineering General", director: "", project: "", message: "" });

    // If no initial data (server didn't preload), fetch client-side for fast render
    useEffect(() => {
        if (initialReports.length > 0) return;
        fetch("/api/reports", { cache: "no-store" })
            .then((r) => r.json())
            .then((data) => { setReports(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, [initialReports.length]);

    return (
        <div className="flex h-[calc(100vh-4rem)] bg-sbi-dark font-urbanist text-sbi-muted overflow-hidden flex-col">
            <main className="flex-1 overflow-auto p-6 md:p-10 dashboard-scrollbar flex flex-col w-full gap-10">

                {/* Header */}
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-light text-white tracking-wide">
                        Reports
                    </h1>
                    <button 
                        onClick={() => setIsCreatingModalOpen(true)}
                        className="bg-sbi-green hover:bg-green-500 text-black font-semibold px-4 py-2 rounded-md flex items-center gap-2 text-sm transition-colors"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14" /><path d="M12 5v14" />
                        </svg>
                        New Report
                    </button>
                </div>

                {/* Analytics Overview */}
                {loading ? (
                    <div className="animate-pulse space-y-6">
                        <div className="h-8 bg-white/5 rounded w-48" />
                        <div className="grid grid-cols-4 gap-4">
                            {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-white/5 rounded-xl" />)}
                        </div>
                        <div className="grid grid-cols-3 gap-6">
                            <div className="col-span-2 h-64 bg-white/5 rounded-xl" />
                            <div className="h-64 bg-white/5 rounded-xl" />
                        </div>
                    </div>
                ) : (
                    <ReportsOverview reports={reports} />
                )}

                {/* Report History Table */}
                <div>
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-8 h-[2px] bg-sbi-green" />
                        <h2 className="text-[11px] tracking-[0.2em] uppercase text-sbi-muted font-bold">
                            Report History
                        </h2>
                    </div>

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
                        onRowClick={setSelectedReport}
                        columnToggle
                        toggleFilter={{
                            key: "status",
                            value: "Done",
                            label: "Hide Done",
                        }}
                    />
                </div>
            </main>

            {/* Detail View Modal */}
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

                            {/* Legal Document Content */}
                            <div className="flex-1 overflow-y-auto bg-sbi-dark-card p-8 md:p-12 font-old-standard">
                                <div className="bg-sbi-dark border border-sbi-dark-border shadow-2xl min-h-[1000px] p-16 max-w-3xl mx-auto flex flex-col relative text-gray-200">
                                    <div className="absolute top-16 right-16 opacity-[0.03] pointer-events-none text-white">
                                        <FileText className="w-48 h-48" />
                                    </div>

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
                                                <StatusPill status={selectedReport.status} className="mx-2 text-sm" />
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
                                                <div><span className="text-sbi-muted-dark">id:</span> <span className="text-gray-300 break-all">{selectedReport.id}</span></div>
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

                            {/* Modal Footer */}
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

            {/* New Report Modal */}
            <AnimatePresence>
                {isCreatingModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => !isSubmitting && setIsCreatingModalOpen(false)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="relative w-full max-w-2xl bg-sbi-dark shadow-2xl flex flex-col z-10 border border-sbi-dark-border rounded-xl overflow-hidden font-urbanist"
                        >
                            <div className="flex items-center justify-between p-6 border-b border-sbi-dark-border bg-sbi-dark">
                                <h2 className="text-xl font-bold text-white flex items-center gap-3">
                                    <FileText className="w-5 h-5 text-sbi-green" /> Create New Report
                                </h2>
                                <button
                                    onClick={() => setIsCreatingModalOpen(false)}
                                    disabled={isSubmitting}
                                    className="p-2 text-sbi-muted hover:text-white rounded-full hover:bg-sbi-dark-card transition-colors disabled:opacity-50"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            
                            <form 
                                onSubmit={async (e) => {
                                    e.preventDefault();
                                    setIsSubmitting(true);
                                    try {
                                        const res = await fetch("/api/reports", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify(newReportForm),
                                        });
                                        if (res.ok) {
                                            const newReport = await res.json();
                                            // unshift adds it to the top
                                            setReports(prev => [newReport, ...prev]);
                                            setIsCreatingModalOpen(false);
                                            setNewReportForm({ title: "", department: "Engineering General", director: "", project: "", message: "" });
                                        } else {
                                            alert("Failed to submit report. Please try again.");
                                        }
                                    } catch (err) {
                                        alert("An error occurred while submitting.");
                                    } finally {
                                        setIsSubmitting(false);
                                    }
                                }} 
                                className="p-6 space-y-6 bg-sbi-dark-card"
                            >
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[11px] uppercase tracking-widest text-sbi-muted-dark font-bold mb-2">Subject / Title *</label>
                                        <input 
                                            required 
                                            value={newReportForm.title}
                                            onChange={e => setNewReportForm(prev => ({ ...prev, title: e.target.value }))}
                                            disabled={isSubmitting}
                                            className="w-full bg-sbi-dark border border-sbi-dark-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-sbi-green/50 transition-colors placeholder:text-white/20 text-sm"
                                            placeholder="Quarterly Earnings Review" 
                                        />
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[11px] uppercase tracking-widest text-sbi-muted-dark font-bold mb-2">Department *</label>
                                            <select 
                                                required
                                                value={newReportForm.department}
                                                onChange={e => setNewReportForm(prev => ({ ...prev, department: e.target.value }))}
                                                disabled={isSubmitting}
                                                className="w-full bg-sbi-dark border border-sbi-dark-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-sbi-green/50 transition-colors text-sm appearance-none"
                                            >
                                                {DEPT_FILTER.options?.map(opt => {
                                                    if ('options' in opt && opt.options) {
                                                        return opt.options.map(sub => (
                                                            <option key={sub.value} value={sub.value}>{sub.label}</option>
                                                        ));
                                                    }
                                                    if (opt.value === "All Depts") return null;
                                                    return <option key={opt.value} value={opt.value}>{opt.label}</option>;
                                                })}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[11px] uppercase tracking-widest text-sbi-muted-dark font-bold mb-2">Assigned Director *</label>
                                            <select 
                                                required 
                                                value={newReportForm.director}
                                                onChange={e => setNewReportForm(prev => ({ ...prev, director: e.target.value }))}
                                                disabled={isSubmitting}
                                                className="w-full bg-sbi-dark border border-sbi-dark-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-sbi-green/50 transition-colors text-sm appearance-none"
                                            >
                                                <option value="" disabled>Select a director...</option>
                                                {DIRECTORS.map(d => (
                                                    <option key={d.email} value={d.name}>{d.name} — {d.title}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="block text-[11px] uppercase tracking-widest text-sbi-muted-dark font-bold">Project ID / Reference</label>
                                            {isCustomProject && (
                                                <button type="button" onClick={() => { setIsCustomProject(false); setNewReportForm(prev => ({ ...prev, project: "" })); }} className="text-[10px] text-sbi-green hover:underline">Select Existing</button>
                                            )}
                                        </div>
                                        {isCustomProject ? (
                                            <input
                                                required
                                                value={newReportForm.project}
                                                onChange={e => setNewReportForm(prev => ({ ...prev, project: e.target.value }))}
                                                disabled={isSubmitting}
                                                className="w-full bg-sbi-dark border border-sbi-dark-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-sbi-green/50 transition-colors placeholder:text-white/20 text-sm font-mono"
                                                placeholder="Enter new Project ID..."
                                                autoFocus
                                            />
                                        ) : (
                                            <select
                                                required
                                                value={newReportForm.project}
                                                onChange={e => {
                                                    if (e.target.value === "__NEW__") {
                                                        setIsCustomProject(true);
                                                        setNewReportForm(prev => ({ ...prev, project: "" }));
                                                    } else {
                                                        setNewReportForm(prev => ({ ...prev, project: e.target.value }));
                                                    }
                                                }}
                                                disabled={isSubmitting}
                                                className="w-full bg-sbi-dark border border-sbi-dark-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-sbi-green/50 transition-colors text-sm appearance-none font-mono"
                                            >
                                                <option value="" disabled>Select an existing project...</option>
                                                <option value="__NEW__" className="text-sbi-green font-bold bg-sbi-dark-card">+ Enter New Project ID</option>
                                                {Array.from(new Set(
                                                    reports.map(r => r.project).filter((p): p is string => Boolean(p))
                                                )).slice(0, 10).map(p => (
                                                    <option key={p} value={p}>{p}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-[11px] uppercase tracking-widest text-sbi-muted-dark font-bold mb-2">Report Message / Notes</label>
                                        <textarea 
                                            value={newReportForm.message}
                                            onChange={e => setNewReportForm(prev => ({ ...prev, message: e.target.value }))}
                                            disabled={isSubmitting}
                                            rows={4}
                                            className="w-full bg-sbi-dark border border-sbi-dark-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-sbi-green/50 transition-colors placeholder:text-white/20 text-sm resize-none"
                                            placeholder="Include any preliminary context regarding this record..." 
                                        />
                                    </div>
                                </div>
                                
                                <div className="border-t border-sbi-dark-border pt-6 flex justify-end gap-3 mt-4">
                                    <button 
                                        type="button"
                                        onClick={() => setIsCreatingModalOpen(false)}
                                        disabled={isSubmitting}
                                        className="px-5 py-2.5 text-sm font-medium text-sbi-muted hover:text-white hover:bg-sbi-dark rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="px-6 py-2.5 text-sm font-bold text-black bg-sbi-green hover:bg-green-400 rounded-lg transition-colors shadow-[0_0_15px_rgba(34,197,94,0.3)] hover:shadow-[0_0_20px_rgba(34,197,94,0.5)] disabled:opacity-50 disabled:shadow-none flex items-center gap-2"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                                Transmitting...
                                            </>
                                        ) : (
                                            "Submit Report"
                                        )}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
