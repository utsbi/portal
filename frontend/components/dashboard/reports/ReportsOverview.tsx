"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  TrendingUp,
} from "lucide-react";
import type { ReportItem } from "@/app/api/reports/route";
import { Panel, StatTile } from "@/components/dashboard/common/ui";

interface ReportsOverviewProps {
  reports: ReportItem[];
}

export function ReportsOverview({ reports }: ReportsOverviewProps) {
  const stats = useMemo(() => {
    let inProgress = 0;
    let done = 0;
    let pending = 0;
    let denied = 0;
    for (const r of reports) {
      if (r.status === "In Progress") inProgress += 1;
      else if (r.status === "Done") done += 1;
      else if (r.status === "Pending") pending += 1;
      else if (r.status === "Denied") denied += 1;
    }
    return { total: reports.length, inProgress, done, pending, denied };
  }, [reports]);

  const timelineData = useMemo(() => {
    const counts: Record<string, { date: string; count: number; sort: number }> = {};
    for (const r of reports) {
      const d = new Date(r.created_at ?? r.date);
      const key = d.toLocaleString("default", { month: "short", year: "2-digit" });
      const sort = d.getFullYear() * 12 + d.getMonth();
      if (!counts[key]) counts[key] = { date: key, count: 0, sort };
      counts[key].count += 1;
    }
    return Object.values(counts).sort((a, b) => a.sort - b.sort);
  }, [reports]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-6"
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile
          label="Total Reports"
          value={stats.total.toLocaleString()}
          sublabel="Across this project"
          icon={<FileText className="h-4 w-4" />}
        />
        <StatTile
          label="In Progress"
          value={stats.inProgress.toLocaleString()}
          sublabel="Currently active"
          icon={<Clock className="h-4 w-4" />}
        />
        <StatTile
          label="Done"
          value={stats.done.toLocaleString()}
          sublabel="Finalized deliverables"
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <StatTile
          label="Needs Attention"
          value={(stats.pending + stats.denied).toLocaleString()}
          sublabel="Pending or denied"
          icon={<AlertCircle className="h-4 w-4" />}
        />
      </div>

      <Panel className="flex flex-col h-[260px]">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xs tracking-[0.15em] uppercase text-sbi-muted font-medium flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-sbi-green" /> Submission Trend
            </h3>
            <p className="text-[10px] text-sbi-muted-dark uppercase tracking-[0.15em] font-medium">
              Reports submitted by month
            </p>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          {timelineData.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-sm text-sbi-muted">No submissions yet.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="reportsTrendGradient" x1="0" y1="0" x2="0" y2="1">
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
                  fill="url(#reportsTrendGradient)"
                  dot={false}
                  activeDot={{ r: 6, strokeWidth: 0, fill: "#22c55e" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Panel>
    </motion.div>
  );
}
