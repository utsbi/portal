"use client";

import { TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { Panel } from "@/components/dashboard/common/ui";

interface SpendChartProps {
  totalBudget: number;
  cumulativeByDate: Array<{ date: string; cumulative: number }>;
  formatCurrency: (n: number) => string;
}

interface ChartTooltipProps {
  active?: boolean;
  label?: string;
  payload?: Array<{ value?: number | string }>;
  totalBudget: number;
  formatCurrency: (n: number) => string;
}

function ChartTooltip({
  active,
  payload,
  label,
  totalBudget,
  formatCurrency,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const raw = payload[0]?.value ?? 0;
  const value = typeof raw === "number" ? raw : Number(raw) || 0;
  const pct = totalBudget > 0 ? Math.round((value / totalBudget) * 100) : 0;
  return (
    <div className="rounded-lg border border-sbi-dark-border/60 bg-sbi-dark-card/95 backdrop-blur px-3 py-2 shadow-lg shadow-black/40">
      <p className="text-[10px] uppercase tracking-[0.15em] text-sbi-muted-dark mb-0.5">
        {label}
      </p>
      <p className="text-sm text-white tabular-nums">
        {formatCurrency(value)}{" "}
        <span className="text-sbi-muted-dark">
          / {formatCurrency(totalBudget)} ({pct}%)
        </span>
      </p>
    </div>
  );
}

export function SpendChart({
  totalBudget,
  cumulativeByDate,
  formatCurrency,
}: SpendChartProps) {
  const isOver =
    cumulativeByDate.length > 0 &&
    cumulativeByDate[cumulativeByDate.length - 1].cumulative > totalBudget;
  const lineColor = isOver ? "#f59e0b" : "#22c55e";

  return (
    <Panel className="flex flex-col h-[260px]">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xs tracking-[0.15em] uppercase text-sbi-muted font-medium flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-sbi-green" /> Cumulative Spend
          </h3>
          <p className="text-[10px] text-sbi-muted-dark uppercase tracking-[0.15em] font-medium">
            Against budget cap of {formatCurrency(totalBudget)}
          </p>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        {cumulativeByDate.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-sbi-muted">No spend recorded yet.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={cumulativeByDate}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={lineColor} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
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
              <ReferenceLine
                y={totalBudget}
                stroke="#8a9a93"
                strokeDasharray="4 4"
                label={{
                  value: "Budget cap",
                  fill: "#8a9a93",
                  fontSize: 10,
                  position: "insideTopRight",
                }}
              />
              <Tooltip
                content={
                  <ChartTooltip
                    totalBudget={totalBudget}
                    formatCurrency={formatCurrency}
                  />
                }
                cursor={{ stroke: "#ffffff10", strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke={lineColor}
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#spendGradient)"
                dot={false}
                activeDot={{ r: 6, strokeWidth: 0, fill: lineColor }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Panel>
  );
}
