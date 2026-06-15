import { DashboardShell, PageHeader, SectionLabel } from "@/components/dashboard/common/ui";

export default function ReportsLoading() {
  return (
    <DashboardShell>
      <PageHeader title="Reports" subtitle="Loading…" />

      <main className="flex-1 overflow-hidden">
        <div className="flex flex-col gap-8 animate-pulse">
          {/* Overview stat tiles — 4 across */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-white/5" />
            ))}
          </div>

          {/* Report history table */}
          <div>
            <SectionLabel>Report History</SectionLabel>
            <div className="rounded-xl border border-sbi-dark-border/50 bg-sbi-dark-card/30">
              <div className="h-11 border-b border-sbi-dark-border/50" />
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 border-b border-sbi-dark-border/30 last:border-b-0"
                />
              ))}
            </div>
          </div>
        </div>
      </main>
    </DashboardShell>
  );
}
