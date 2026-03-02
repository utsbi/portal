"use client";

import { useMemo, useState } from "react";
import type { ReportItem } from "@/app/api/reports/route";
import { SearchableDropdown } from "@/components/data-table/searchable-dropdown";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    AreaChart,
    Area,
} from "recharts";
import {
    FileText,
    CheckCircle2,
    Clock,
    AlertCircle,
    TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
        const inProgress = filteredReports.filter(
            (r) => r.status === "In Progress",
        ).length;
        const done = filteredReports.filter((r) => r.status === "Done").length;
        const denied = filteredReports.filter(
            (r) => r.status === "Denied",
        ).length;
        const pending = filteredReports.filter(
            (r) => r.status === "Pending",
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
            counts[r.department] = (counts[r.department] || 0) + 1;
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
                <div className="flex gap-2">
                    <SearchableDropdown
                        value={filterTime}
                        onChange={setFilterTime}
                        options={TIMEFRAME_OPTIONS}
                        className="w-32"
                    />
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
                />
                <SummaryCard
                    title="In Progress"
                    value={stats.inProgress}
                    icon={Clock}
                    color="text-blue-400"
                    bg="bg-blue-400/10"
                />
                <SummaryCard
                    title="Done"
                    value={stats.done}
                    icon={CheckCircle2}
                    color="text-sbi-green"
                    bg="bg-sbi-green/10"
                />
                <SummaryCard
                    title="Needs Attention"
                    value={stats.denied + stats.pending}
                    icon={AlertCircle}
                    color="text-amber-400"
                    bg="bg-amber-400/10"
                />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-80">
                {/* Status Distribution */}
                <div className="bg-sbi-dark-card border border-sbi-dark-border rounded-xl p-5 flex flex-col">
                    <h3 className="text-[11px] tracking-[0.2em] uppercase text-sbi-muted font-bold mb-4 flex items-center gap-2">
                        <PieChartIcon className="w-4 h-4" /> Status Breakdown
                    </h3>
                    <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={statusData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {statusData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={entry.color}
                                            stroke="none"
                                        />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "#1a1a1a",
                                        border: "1px solid #333",
                                        borderRadius: "8px",
                                    }}
                                    itemStyle={{ color: "#fff" }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Department Activity */}
                <div className="bg-sbi-dark-card border border-sbi-dark-border rounded-xl p-5 flex flex-col">
                    <h3 className="text-[11px] tracking-[0.2em] uppercase text-sbi-muted font-bold mb-4 flex items-center gap-2">
                        <BarChart2Icon className="w-4 h-4" /> Top Departments
                    </h3>
                    <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={departmentData}
                                layout="vertical"
                                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                            >
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="#333"
                                    horizontal={false}
                                />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    width={100}
                                    tick={{
                                        fill: "#a3a3a3",
                                        fontSize: 10,
                                        fontFamily: "Urbanist, sans-serif",
                                        letterSpacing: "0.1em",
                                    }}
                                />
                                <Tooltip
                                    cursor={{ fill: "transparent" }}
                                    contentStyle={{
                                        backgroundColor: "#1a1a1a",
                                        border: "1px solid #333",
                                        borderRadius: "8px",
                                    }}
                                    itemStyle={{ color: "#fff" }}
                                />
                                <Bar
                                    dataKey="count"
                                    fill="#22c55e"
                                    radius={[0, 4, 4, 0]}
                                    barSize={20}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Timeline */}
                <div className="bg-sbi-dark-card border border-sbi-dark-border rounded-xl p-5 flex flex-col">
                    <h3 className="text-[11px] tracking-[0.2em] uppercase text-sbi-muted font-bold mb-4 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" /> Submission Trend
                    </h3>
                    <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={timelineData}>
                                <defs>
                                    <linearGradient
                                        id="colorCount"
                                        x1="0"
                                        y1="0"
                                        x2="0"
                                        y2="1"
                                    >
                                        <stop
                                            offset="5%"
                                            stopColor="#22c55e"
                                            stopOpacity={0.3}
                                        />
                                        <stop
                                            offset="95%"
                                            stopColor="#22c55e"
                                            stopOpacity={0}
                                        />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="#333"
                                    vertical={false}
                                />
                                <XAxis
                                    dataKey="date"
                                    tick={{
                                        fill: "#a3a3a3",
                                        fontSize: 10,
                                        fontFamily: "Urbanist, sans-serif",
                                        letterSpacing: "0.1em",
                                    }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "#1a1a1a",
                                        border: "1px solid #333",
                                        borderRadius: "8px",
                                    }}
                                    itemStyle={{ color: "#fff" }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="count"
                                    stroke="#22c55e"
                                    fillOpacity={1}
                                    fill="url(#colorCount)"
                                    strokeWidth={2}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
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
}: {
    title: string;
    value: number;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bg: string;
}) {
    return (
        <div className="bg-sbi-dark-card border border-sbi-dark-border rounded-xl p-4 flex items-center gap-4">
            <div
                className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                    bg,
                    color,
                )}
            >
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <p className="text-[11px] tracking-[0.2em] uppercase text-sbi-muted font-bold">
                    {title}
                </p>
                <p className="text-2xl tracking-[0.1em] font-bold text-white font-urbanist">
                    {value}
                </p>
            </div>
        </div>
    );
}

function PieChartIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
            <path d="M22 12A10 10 0 0 0 12 2v10z" />
        </svg>
    );
}

function BarChart2Icon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <line x1="18" x2="18" y1="20" y2="10" />
            <line x1="12" x2="12" y1="20" y2="4" />
            <line x1="6" x2="6" y1="20" y2="14" />
        </svg>
    );
}
