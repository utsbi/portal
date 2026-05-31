"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { Task } from "../types";
import { countByStatus, STATUS_DISPLAY_ORDER, STATUS_HEX } from "./status-meta";

interface StatusDonutProps {
  tasks: Task[];
  /** Outer pixel size of the square donut. */
  size?: number;
  thickness?: number;
}

export function StatusDonut({
  tasks,
  size = 128,
  thickness = 14,
}: StatusDonutProps) {
  const { data, pct } = useMemo(() => {
    const counts = countByStatus(tasks);
    const total = tasks.length;
    const completed = counts.completed;
    const segments = STATUS_DISPLAY_ORDER.map((status) => ({
      status,
      value: counts[status],
    })).filter((s) => s.value > 0);
    return {
      data: segments,
      pct: total === 0 ? 0 : Math.round((completed / total) * 100),
    };
  }, [tasks]);

  const outer = size / 2;
  const inner = outer - thickness;
  const isEmpty = data.length === 0;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${pct}% complete`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={isEmpty ? [{ status: "empty", value: 1 }] : data}
            dataKey="value"
            nameKey="status"
            innerRadius={inner}
            outerRadius={outer}
            startAngle={90}
            endAngle={-270}
            paddingAngle={data.length > 1 ? 2 : 0}
            stroke="none"
            isAnimationActive={false}
          >
            {isEmpty ? (
              <Cell fill="#0e1a12" />
            ) : (
              data.map((d) => (
                <Cell key={d.status} fill={STATUS_HEX[d.status]} />
              ))
            )}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-light tabular-nums text-white leading-none">
          {pct}%
        </span>
        <span className="mt-1 text-[9px] uppercase tracking-[0.18em] text-sbi-muted-dark">
          Complete
        </span>
      </div>
    </div>
  );
}
