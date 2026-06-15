import { DashboardShell, PageHeader } from "@/components/dashboard/common/ui";

export default function QuestionnaireLoading() {
  return (
    <DashboardShell>
      <PageHeader title="Questionnaire" subtitle="Loading…" />

      <main className="flex-1 overflow-hidden">
        <div className="flex flex-col gap-6 animate-pulse">
          {/* Toolbar — heading + filter control */}
          <div className="flex items-center justify-between">
            <div className="h-6 w-48 rounded bg-white/5" />
            <div className="h-5 w-36 rounded bg-white/5" />
          </div>

          {/* Form list table */}
          <div className="rounded-md border border-sbi-dark-border bg-sbi-dark-card/30">
            <div className="h-11 border-b border-sbi-dark-border" />
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-14 border-b border-sbi-dark-border/50 last:border-b-0"
              />
            ))}
          </div>
        </div>
      </main>
    </DashboardShell>
  );
}
