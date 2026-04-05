"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import type { ReportItem } from "@/app/api/reports/route";
import { SearchableDropdown } from "@/components/data-table/searchable-dropdown";
import {
    BarChart,
    Bar,
    XAxis,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    CartesianGrid,
} from "recharts";
import {
    FileText,
    CheckCircle2,
    Clock,
    AlertCircle,
    TrendingUp,
    PieChart as PieChartIcon,
    BarChart2 as BarChart2Icon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Pure-SVG donut gauge — avoids recharts clipping
function SvgGauge({ segments, total }: { segments: { value: number; color: string }[]; total: number }) {
    const R = 40;
    const C = 2 * Math.PI * R; // circumference ≈ 251.3
    const GAP = total > 1 ? 4 : 0; // px gap between segments

    // Build arcs
    const arcs: { offset: number; dash: number; color: string }[] = [];
    let used = 0;
    const totalGap = GAP * (segments.length > 1 ? segments.length : 0);
    const available = C - totalGap;

    segments.forEach((seg) => {
        const dash = (seg.value / Math.max(total, 1)) * available;
        arcs.push({ offset: used, dash, color: seg.color });
        used += dash + GAP;
    });

    return (
        <svg viewBox="-8 -8 116 116" className="w-full h-full">
            {/* Background track */}
            <circle
                cx="50" cy="50" r={R}
                fill="none"
                stroke="rgba(255,255,255,0.07)"
                strokeWidth="7"
            />
            {/* Colored segments */}
            {arcs.map((arc, i) => (
                <circle
                    key={i}
                    cx="50" cy="50" r={R}
                    fill="none"
                    stroke={arc.color}
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray={`${arc.dash} ${C - arc.dash}`}
                    strokeDashoffset={-(arc.offset) + C / 4 /* start at top */}
                    style={{ transition: "stroke-dasharray 0.6s ease" }}
                />
            ))}
            {/* Center label */}
            <text x="50" y="46" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="26" fontWeight="700">
                {total}
            </text>
            <text x="50" y="64" textAnchor="middle" dominantBaseline="middle" fill="#6b7c73" fontSize="9" letterSpacing="1.5">
                REPORTS
            </text>
        </svg>
    );
}

interface ReportsOverviewProps {
    reports: ReportItem[];
}

const DEPARTMENTS = [
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
];

const TIMEFRAME_OPTIONS = [
    { value: "All Time", label: "All Time" },
    { value: "This Week", label: "This Week" },
    { value: "This Month", label: "This Month" },
    { value: "Last Month", label: "Last Month" },
];

export function ReportsOverview({ reports }: ReportsOverviewProps) {
    const [filterDept, setFilterDept] = useState("All Depts");
    const [filterTime, setFilterTime] = useState("All Time");

    const filteredReports = useMemo(() => {
        return reports.filter((r) => {
            const matchesDept =
                filterDept === "All Depts" || r.department === filterDept;

            let matchesTime = true;
            if (filterTime !== "All Time") {
                const date = new Date(r.date);
                const now = new Date();
                const startOfToday = new Date(
                    now.getFullYear(),
                    now.getMonth(),
                    now.getDate(),
                );
                if (filterTime === "This Week") {
                    const startOfWeek = new Date(startOfToday);
                    startOfWeek.setDate(
                        startOfToday.getDate() - startOfToday.getDay(),
                    );
                    matchesTime = date >= startOfWeek;
                } else if (filterTime === "This Month") {
                    const startOfMonth = new Date(
                        now.getFullYear(),
                        now.getMonth(),
                        1,
                    );
                    matchesTime = date >= startOfMonth;
                } else if (filterTime === "Last Month") {
                    const startOfLastMonth = new Date(
                        now.getFullYear(),
                        now.getMonth() - 1,
                        1,
                    );
                    const startOfThisMonth = new Date(
                        now.getFullYear(),
                        now.getMonth(),
                        1,
                    );
                    matchesTime =
                        date >= startOfLastMonth && date < startOfThisMonth;
                }
            }
            return matchesDept && matchesTime;
        });
    }, [reports, filterDept, filterTime]);

    const stats = useMemo(() => {
        const total = filteredReports.length;
        const normalize = (s: string) => s?.toLowerCase().replace(/[\s_-]+/g, "");
        const inProgress = filteredReports.filter(
            (r) => normalize(r.status) === "inprogress" || normalize(r.status) === "inprocess",
        ).length;
        const done = filteredReports.filter(
            (r) => normalize(r.status) === "done" || normalize(r.status) === "complete" || normalize(r.status) === "completed",
        ).length;
        const denied = filteredReports.filter(
            (r) => normalize(r.status) === "denied" || normalize(r.status) === "rejected",
        ).length;
        const pending = filteredReports.filter(
            (r) => normalize(r.status) === "pending",
        ).length;
        return { total, inProgress, done, denied, pending };
    }, [filteredReports]);

    const statusData = useMemo(
        () =>
            [
                { name: "Done", value: stats.done, color: "#22c55e" },
                { name: "In Progress", value: stats.inProgress, color: "#60a5fa" },
                { name: "Pending", value: stats.pending, color: "#fbbf24" },
                { name: "Denied", value: stats.denied, color: "#f87171" },
            ].filter((d) => d.value > 0),
        [stats],
    );

    const departmentData = useMemo(() => {
        const counts: Record<string, number> = {};
        filteredReports.forEach((r) => {
            const dept = r.department?.trim();
            if (!dept || dept === "n/a" || dept === "null") return;
            counts[dept] = (counts[dept] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    }, [filteredReports]);

    const timelineData = useMemo(() => {
        const counts: Record<string, number> = {};
        filteredReports.forEach((r) => {
            const date = new Date(r.date);
            const key = date.toLocaleString("default", {
                month: "short",
                year: "2-digit",
            });
            counts[key] = (counts[key] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([date, count]) => ({ date, count }))
            .reverse();
    }, [filteredReports]);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center justify-between pb-4 border-b border-white/5">
                <div className="flex items-center gap-4">
                    <div className="w-8 h-[2px] bg-sbi-green" />
                    <h2 className="text-[11px] tracking-[0.2em] uppercase text-sbi-muted font-bold">
                        Analytics Overview
                    </h2>
                </div>
                <div className="flex gap-4 items-center">
                    <div className="flex bg-white/5 p-1 rounded-lg">
                        {TIMEFRAME_OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => setFilterTime(opt.value)}
                                className={cn(
                                    "px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all",
                                    filterTime === opt.value
                                        ? "bg-sbi-green text-black"
                                        : "text-sbi-muted-dark hover:text-white"
                                )}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    <SearchableDropdown
                        value={filterDept}
                        onChange={setFilterDept}
                        options={DEPARTMENTS}
                        className="w-44"
                    />
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryCard
                    title="Total Reports"
                    value={stats.total}
                    icon={FileText}
                    color="text-white"
                    bg="bg-white/5"
                    trend="+12.5%"
                    trendUp={true}
                    description="Trending up this month"
                    subtitle="Reports for the last 6 months"
                />
                <SummaryCard
                    title="In Progress"
                    value={stats.inProgress}
                    icon={Clock}
                    color="text-sbi-yellow"
                    bg="bg-sbi-yellow/10"
                    trend="+5.2%"
                    trendUp={true}
                    description="Steady progress maintained"
                    subtitle="Currently active tasks"
                />
                <SummaryCard
                    title="Done"
                    value={stats.done}
                    icon={CheckCircle2}
                    color="text-sbi-green"
                    bg="bg-sbi-green/10"
                    trend="+18.3%"
                    trendUp={true}
                    description="Completion rate increased"
                    subtitle="Finalized deliverables"
                />
                <SummaryCard
                    title="Needs Attention"
                    value={stats.denied + stats.pending}
                    icon={AlertCircle}
                    color="text-sbi-yellow"
                    bg="bg-sbi-yellow/10"
                    trend="-2.4%"
                    trendUp={false}
                    description="Review required for 5 items"
                    subtitle="Flagged or pending items"
                />
            </div>

            {/* Bento Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Submission Trend - Large Bento Box (2/3) */}
                <div className="lg:col-span-2 bento-card p-6 flex flex-col h-[400px]">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h3 className="metric-label flex items-center gap-2 mb-1">
                                <TrendingUp className="w-4 h-4 text-sbi-green" /> Submission Trend
                            </h3>
                            <p className="text-[10px] text-sbi-muted-dark uppercase tracking-widest font-medium">
                                Growth tracking for the selected period
                            </p>
                        </div>
                        <div className="text-right">
                            <span className="text-[20px] font-bold text-white block leading-none">{stats.total}</span>
                            <span className="text-[8px] uppercase tracking-[0.2em] text-sbi-green font-bold">Total Reports</span>
                        </div>
                    </div>
                    <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    tick={{ fill: "#8a9a93", fontSize: 10, letterSpacing: "0.05em" }}
                                    axisLine={false}
                                    tickLine={false}
                                    dy={10}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "#0A0A0A",
                                        border: "0.5px solid rgba(34, 197, 94, 0.3)",
                                        borderRadius: "12px",
                                        boxShadow: "0 10px 20px rgba(0,0,0,0.5)",
                                    }}
                                    itemStyle={{ color: "#fff" }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="count"
                                    stroke="#22c55e"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#trendGradient)"
                                    dot={false}
                                    activeDot={{ r: 6, strokeWidth: 0, fill: '#22c55e' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="count"
                                    stroke="transparent"
                                    fillOpacity={0.1}
                                    fill="#22c55e"
                                    baseLine={8}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Right Column Bento Boxes (1/3 each) */}
                <div className="flex flex-col gap-6 h-[520px]">
                    {/* Status Breakdown - Mini Bento */}
                    <div className="flex-1 bento-card p-6 flex flex-col min-h-0">
                        <h3 className="metric-label mb-4 flex items-center gap-2 shrink-0">
                            <PieChartIcon className="w-4 h-4 text-sbi-yellow" /> Status Gauge
                        </h3>
                        <div className="flex-1 flex items-center justify-center">
                            <div className="w-44 h-44">
                                <SvgGauge
                                    segments={statusData.length > 0 ? statusData : [{ value: 1, color: "#333" }]}
                                    total={stats.total}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Top Departments - Mini Bento */}
                    <div className="flex-1 bento-card p-6 flex flex-col">
                        <h3 className="metric-label mb-4 flex items-center gap-2">
                            <BarChart2Icon className="w-4 h-4 text-sbi-green" /> Key Metrics
                        </h3>
                        <div className="flex-1 flex flex-col justify-center gap-4">
                            {departmentData.slice(0, 3).map((dept, i) => (
                                <div key={dept.name} className="space-y-1.5">
                                    <div className="flex justify-between text-[10px] uppercase tracking-wider text-sbi-muted-dark px-0.5">
                                        <span>{dept.name}</span>
                                        <span className="text-white font-medium">{dept.count}</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(dept.count / stats.total) * 100}%` }}
                                            className="h-full rounded-full"
                                            style={{
                                                background: 'linear-gradient(90deg, #22c55e 0%, #16301d 100%)'
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function SummaryCard({
    title,
    value,
    icon: Icon,
    color,
    bg,
    trend,
    trendUp,
    description,
    subtitle,
}: {
    title: string;
    value: number;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bg: string;
    trend?: string;
    trendUp?: boolean;
    description?: string;
    subtitle?: string;
}) {
    return (
        <div className="bento-card p-6 flex flex-col gap-4 group h-full">
            <div className="flex justify-between items-start">
                <span className="metric-label opacity-70">{title}</span>
                {trend && (
                    <div className={cn(
                        "flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full",
                        trendUp ? "text-sbi-green bg-sbi-green/10" : "text-sbi-yellow bg-sbi-yellow/10"
                    )}>
                        {trendUp ? "↑" : "↓"} {trend}
                    </div>
                )}
            </div>

            <div>
                <div className="metric-value text-3xl text-white">
                    {typeof value === 'number' && title.includes('Total Reports') ? value.toLocaleString() : value}
                </div>
            </div>

            <div className="space-y-1 mt-auto">
                {description && (
                    <div className="flex items-center gap-2 text-[10px] text-white/90">
                        {description}
                        <TrendingUp className="w-3 h-3 text-sbi-green" />
                    </div>
                )}
                {subtitle && (
                    <div className="text-[10px] text-sbi-muted-dark font-medium uppercase tracking-wider">
                        {subtitle}
                    </div>
                )}
            </div>
        </div>
    );
}

