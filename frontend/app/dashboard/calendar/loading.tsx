import { DashboardShell, PageHeader } from "@/components/dashboard/common/ui";

export default function CalendarLoading() {
  return (
    <DashboardShell>
      <PageHeader title="Calendar" subtitle="Loading…" />

      {/* View toggle + search row (CalendarHeader) */}
      <div className="mb-4 flex items-center justify-between gap-4 shrink-0 animate-pulse">
        <div className="h-9 w-44 rounded-md bg-white/5" />
        <div className="h-9 w-56 rounded-md bg-white/5" />
      </div>

      {/* Month grid skeleton — weekday header + 5 rows of 7 day cells */}
      <div className="flex-1 min-h-0 flex flex-col animate-pulse">
        <div className="grid grid-cols-7 gap-px mb-px">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-6 rounded bg-white/5" />
          ))}
        </div>
        <div className="grid flex-1 grid-cols-7 grid-rows-5 gap-px">
          {Array.from({ length: 35 }).map((_, i) => (
            <div
              key={i}
              className="rounded border border-sbi-dark-border/50 bg-sbi-dark-card/30"
            />
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
