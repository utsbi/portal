import {
  DashboardShell,
  PageHeader,
  SectionLabel,
} from "@/components/dashboard/common/ui";

export default function FinancesLoading() {
  return (
    <DashboardShell>
      <PageHeader title="Finances" subtitle="Loading…" />

      <main className="flex-1 overflow-hidden">
        <div className="flex flex-col gap-8 animate-pulse">
          {/* Overview stat tiles — 4 across */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }, (_, i) => `stat-${i}`).map((key) => (
              <div
                key={key}
                className="h-28 rounded-xl border border-sbi-dark-border/50 bg-sbi-dark-card/30"
              />
            ))}
          </div>

          {/* Spend chart */}
          <div className="h-64 rounded-xl border border-sbi-dark-border/50 bg-sbi-dark-card/30" />

          {/* Category grid */}
          <div>
            <SectionLabel>Spending by Category</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }, (_, i) => `category-${i}`).map(
                (key) => (
                  <div
                    key={key}
                    className="h-32 rounded-xl border border-sbi-dark-border/50 bg-sbi-dark-card/30"
                  />
                ),
              )}
            </div>
          </div>

          {/* Recent transactions table */}
          <div>
            <SectionLabel>Recent Transactions</SectionLabel>
            <div className="rounded-xl border border-sbi-dark-border/50 bg-sbi-dark-card/30">
              <div className="h-10 border-b border-sbi-dark-border/50" />
              {Array.from({ length: 5 }, (_, i) => `txn-${i}`).map((key) => (
                <div
                  key={key}
                  className="h-12 border-b border-sbi-dark-border/30 last:border-b-0"
                />
              ))}
            </div>
          </div>
        </div>
      </main>
    </DashboardShell>
  );
}
