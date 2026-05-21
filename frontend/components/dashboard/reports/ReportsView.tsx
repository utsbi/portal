"use client";

import { useState } from "react";
import type { ReportItem } from "@/app/api/reports/route";
import {
  btnPrimary,
  DashboardShell,
  PageHeader,
  SectionLabel,
} from "@/components/dashboard/common/ui";
import { useProject } from "@/lib/project/project-context";
import { NewReportModal } from "./NewReportModal";
import { ReportDetailModal } from "./ReportDetailModal";
import { ReportHistoryTable } from "./ReportHistoryTable";
import { ReportsOverview } from "./ReportsOverview";
import { useReports } from "./use-reports";

export function ReportsView({
  initialReports,
}: {
  initialReports: ReportItem[];
}) {
  const { activeProject, user } = useProject();
  const isDirector = user?.role === "director";

  const { reports, loading, addReport, updateStatus } = useReports(
    activeProject?.projectId,
  );
  const allReports =
    reports.length === 0 && initialReports.length > 0
      ? initialReports
      : reports;

  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [isCreatingModalOpen, setIsCreatingModalOpen] = useState(false);

  return (
    <DashboardShell>
      <PageHeader
        title="Reports"
        subtitle="Submitted reports and review status"
        action={
          isDirector ? (
            <button
              type="button"
              onClick={() => setIsCreatingModalOpen(true)}
              className={btnPrimary}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                focusable="false"
              >
                <title>Plus</title>
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
            <div className="animate-pulse space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {["a", "b", "c", "d"].map((k) => (
                  <div key={k} className="h-28 bg-white/5 rounded-xl" />
                ))}
              </div>
              <div className="h-[260px] bg-white/5 rounded-xl" />
            </div>
          ) : (
            <ReportsOverview reports={allReports} />
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

      <ReportDetailModal
        report={selectedReport}
        onClose={() => setSelectedReport(null)}
        onAcknowledge={async (id) => {
          const ok = await updateStatus(id, "Done");
          if (ok && selectedReport && selectedReport.id === id) {
            setSelectedReport({ ...selectedReport, status: "Done" });
          }
          return ok;
        }}
      />
      <NewReportModal
        open={isCreatingModalOpen}
        onClose={() => setIsCreatingModalOpen(false)}
        onCreated={addReport}
      />
    </DashboardShell>
  );
}
