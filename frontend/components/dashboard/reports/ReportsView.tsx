"use client";

import { useState } from "react";
import type { ReportItem } from "@/app/api/reports/route";
import { useProject } from "@/lib/project/project-context";
import {
  DashboardShell,
  PageHeader,
  SectionLabel,
  btnPrimary,
} from "@/components/dashboard/common/ui";
import { ReportsOverviewStrip } from "./ReportsOverviewStrip";
import { ReportHistoryTable } from "./ReportHistoryTable";
import { ReportDetailModal } from "./ReportDetailModal";
import { NewReportModal } from "./NewReportModal";
import { useReports } from "./use-reports";

export function ReportsView({ initialReports }: { initialReports: ReportItem[] }) {
  const { activeProject, user } = useProject();
  const isDirector = user?.role === "director";

  const { reports, loading, addReport } = useReports(activeProject?.projectId);
  const allReports = reports.length === 0 && initialReports.length > 0 ? initialReports : reports;

  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [isCreatingModalOpen, setIsCreatingModalOpen] = useState(false);

  return (
    <DashboardShell>
      <PageHeader
        title="Reports"
        subtitle="Submitted reports and review status"
        action={
          isDirector ? (
            <button onClick={() => setIsCreatingModalOpen(true)} className={btnPrimary}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14" />
                <path d="M12 5v14" />
              </svg>
              New Report
            </button>
          ) : null
        }
      />

      <main className="flex-1 overflow-auto dashboard-scrollbar">
        <div className="flex flex-col gap-8">
          {loading ? (
            <div className="animate-pulse space-y-2">
              <div className="h-3 bg-white/5 rounded w-24" />
              <div className="h-4 bg-white/5 rounded w-2/3" />
              <div className="h-4 bg-white/5 rounded w-1/2" />
            </div>
          ) : (
            <ReportsOverviewStrip reports={allReports} />
          )}

          <div>
            <SectionLabel>Report History</SectionLabel>
            <ReportHistoryTable
              reports={allReports}
              isDirector={isDirector}
              onRowClick={setSelectedReport}
              onCreateClick={() => setIsCreatingModalOpen(true)}
            />
          </div>
        </div>
      </main>

      <ReportDetailModal report={selectedReport} onClose={() => setSelectedReport(null)} />
      <NewReportModal
        open={isCreatingModalOpen}
        onClose={() => setIsCreatingModalOpen(false)}
        onCreated={addReport}
      />
    </DashboardShell>
  );
}
