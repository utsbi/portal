"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  TrendingUp,
} from "lucide-react";
import { motion } from "motion/react";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import type { ReportItem } from "@/app/api/reports/route";
import { Panel, StatTile } from "@/components/dashboard/common/ui";

interface ReportsOverviewProps {
  reports: ReportItem[];
}

interface TrendTooltipProps {
  active?: boolean;
  label?: string;
  payload?: Array<{ value?: number | string }>;
}

function TrendTooltip({ active, payload, label }: TrendTooltipProps) {
  if (!active || !payload?.length) return null;
  const raw = payload[0]?.value ?? 0;
  const value = typeof raw === "number" ? raw : Number(raw) || 0;
  return (
    <div className="rounded-lg border border-sbi-dark-border/60 bg-sbi-dark-card/95 backdrop-blur px-3 py-2 shadow-lg shadow-black/40">
      <p className="text-[10px] uppercase tracking-[0.15em] text-sbi-muted-dark mb-0.5">
        {label}
      </p>
      <p className="text-sm text-white tabular-nums">
        {value} report{value === 1 ? "" : "s"}
      </p>
    </div>
  );
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
    const counts: Record<
      string,
      { date: string; count: number; sort: number }
    > = {};
    for (const r of reports) {
      const d = new Date(r.created_at ?? r.date);
      const key = d.toLocaleString("default", {
        month: "short",
        year: "2-digit",
      });
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

      <Panel>
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
        <div className="w-full">
          {timelineData.length === 0 ? (
            <div className="h-[180px] flex items-center justify-center">
              <p className="text-sm text-sbi-muted">No submissions yet.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart
                data={timelineData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="reportsTrendGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="var(--color-sbi-green)"
                      stopOpacity={0.25}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-sbi-green)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#ffffff05"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{
                    fill: "#8a9a93",
                    fontSize: 10,
                    letterSpacing: "0.05em",
                  }}
                  axisLine={false}
                  tickLine={false}
                  dy={10}
                />
                <Tooltip
                  content={<TrendTooltip />}
                  cursor={{ stroke: "#ffffff10", strokeWidth: 1 }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="var(--color-sbi-green)"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#reportsTrendGradient)"
                  dot={false}
                  activeDot={{
                    r: 6,
                    strokeWidth: 0,
                    fill: "var(--color-sbi-green)",
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Panel>
    </motion.div>
  );
}
