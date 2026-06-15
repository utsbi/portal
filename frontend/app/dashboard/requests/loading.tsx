import { DashboardShell, PageHeader } from "@/components/dashboard/common/ui";

export default function RequestsLoading() {
  return (
    <DashboardShell>
      <PageHeader title="Requests" subtitle="Loading…" />

      <main className="flex-1 overflow-hidden">
        <div className="flex flex-col gap-6 animate-pulse">
          {/* Section label + search/filter row */}
          <div className="flex items-center justify-between gap-3">
            <div className="h-4 w-40 rounded bg-white/5" />
            <div className="flex items-center gap-2">
              <div className="h-8 w-44 rounded bg-white/5" />
              <div className="h-8 w-28 rounded bg-white/5" />
            </div>
          </div>

          {/* Request history rows */}
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-16 rounded border border-sbi-dark-border/50 bg-sbi-dark-card/30"
              />
            ))}
          </div>
        </div>
      </main>
    </DashboardShell>
  );
}
