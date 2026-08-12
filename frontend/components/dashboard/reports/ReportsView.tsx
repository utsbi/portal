"use client";

import { useState } from "react";
import type { ReportItem } from "@/app/api/reports/route";
import {
  btnPrimary,
  DashboardMain,
  DashboardShell,
  PageHeader,
  SectionLabel,
} from "@/components/dashboard/common/ui";
import { isStaffRole } from "@/lib/auth/roles";
import { useProject } from "@/lib/project/project-context";
import { NewReportModal } from "./NewReportModal";
import { ReportDetailModal } from "./ReportDetailModal";
import { ReportHistoryTable } from "./ReportHistoryTable";
import { ReportsOverview } from "./ReportsOverview";
import { useReports } from "./use-reports";

export function ReportsView() {
  const { activeProject, user } = useProject();
  const canCreate = isStaffRole(user?.role) || user?.role === "member";

  const { reports, loading, addReport, updateStatus } = useReports(
    activeProject?.projectId,
  );

  const pending = reports.filter((r) => r.status !== "Done").length;
  const subtitle = loading
    ? "Submitted reports and review status"
    : reports.length === 0
      ? "No reports submitted yet"
      : `${reports.length} ${reports.length === 1 ? "report" : "reports"} · ${pending} pending review`;

  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [isCreatingModalOpen, setIsCreatingModalOpen] = useState(false);

  return (
    <DashboardShell>
      <PageHeader
        title="Reports"
        subtitle={subtitle}
        action={
          canCreate ? (
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

      <DashboardMain>
        <div className="flex flex-col gap-8">
          {loading ? (
            <div className="animate-pulse space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {["a", "b", "c", "d"].map((k) => (
                  <div key={k} className="h-28 bg-white/5 rounded-xl" />
                ))}
              </div>
              <div className="h-[280px] bg-white/5 rounded-xl" />
            </div>
          ) : (
            <>
              <ReportsOverview reports={reports} />

              <div>
                <SectionLabel>Report History</SectionLabel>
                <ReportHistoryTable
                  reports={reports}
                  canCreate={canCreate}
                  onRowClick={setSelectedReport}
                  onCreateClick={() => setIsCreatingModalOpen(true)}
                />
              </div>
            </>
          )}
        </div>
      </DashboardMain>

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
