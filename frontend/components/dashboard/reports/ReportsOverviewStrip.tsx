"use client";

import { useMemo } from "react";
import type { ReportItem } from "@/app/api/reports/route";
import { SectionLabel } from "@/components/dashboard/common/ui";

function relativeFromNow(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = then - now;
  const day = 86_400_000;
  const fmt = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const days = Math.round(diffMs / day);
  if (Math.abs(days) >= 30) {
    const months = Math.round(diffMs / (30 * day));
    return fmt.format(months, "month");
  }
  if (Math.abs(days) >= 1) return fmt.format(days, "day");
  const hours = Math.round(diffMs / 3_600_000);
  if (hours !== 0) return fmt.format(hours, "hour");
  const minutes = Math.round(diffMs / 60_000);
  return fmt.format(minutes, "minute");
}

interface ReportsOverviewStripProps {
  reports: ReportItem[];
}

export function ReportsOverviewStrip({ reports }: ReportsOverviewStripProps) {
  const stats = useMemo(() => {
    const result = {
      total: reports.length,
      Done: 0,
      "In Progress": 0,
      Pending: 0,
      Denied: 0,
    };
    for (const r of reports) {
      if (r.status === "Done") result.Done += 1;
      else if (r.status === "In Progress") result["In Progress"] += 1;
      else if (r.status === "Pending") result.Pending += 1;
      else if (r.status === "Denied") result.Denied += 1;
    }
    return result;
  }, [reports]);

  const latest = useMemo(() => {
    if (reports.length === 0) return null;
    return [...reports].sort(
      (a, b) => new Date(b.created_at ?? b.date).getTime() - new Date(a.created_at ?? a.date).getTime(),
    )[0];
  }, [reports]);

  const countsLine = useMemo(() => {
    const parts = [`${stats.total} report${stats.total === 1 ? "" : "s"}`];
    parts.push(`${stats.Done} done`);
    parts.push(`${stats["In Progress"]} in progress`);
    parts.push(`${stats.Pending} pending`);
    if (stats.Denied > 0) parts.push(`${stats.Denied} denied`);
    return parts.join(" · ");
  }, [stats]);

  return (
    <section>
      <SectionLabel>Overview</SectionLabel>
      {reports.length === 0 ? (
        <p className="text-sm text-sbi-muted">No reports yet for this project.</p>
      ) : (
        <div className="space-y-1">
          <p className="text-sm text-white tabular-nums">{countsLine}</p>
          {latest && (
            <p className="text-sm text-sbi-muted">
              Latest {relativeFromNow(latest.created_at ?? latest.date)} by {latest.director || "—"}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
