import {
  DashboardMain,
  DashboardShell,
  PageHeader,
  Panel,
} from "@/components/dashboard/common/ui";

const FORM_CARD_SKELETONS = Array.from(
  { length: 3 },
  (_, i) => `form-card-skeleton-${i}`,
);

export default function BuilderLoading() {
  return (
    <DashboardShell>
      <PageHeader title="Form Builder" subtitle="Loading…" />

      <DashboardMain>
        <div className="animate-pulse">
          {/* Template links row */}
          <div className="mb-6 flex items-center gap-2">
            <div className="h-2.5 w-28 rounded bg-white/5" />
            <div className="h-8 w-20 rounded-md bg-white/5" />
            <div className="h-8 w-24 rounded-md bg-white/5" />
            <div className="h-8 w-16 rounded-md bg-white/5" />
          </div>

          {/* Stat tiles */}
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 mb-8">
            {Array.from({ length: 3 }, (_, i) => (
              <Panel key={`stat-${i}`} className="flex flex-col gap-2 py-4">
                <div className="h-2.5 w-20 rounded bg-white/5" />
                <div className="h-7 w-10 rounded bg-white/5" />
                <div className="h-2.5 w-28 rounded bg-white/5" />
              </Panel>
            ))}
          </div>

          {/* Section label + form cards */}
          <div className="flex flex-col gap-3">
            <div className="h-3 w-20 rounded bg-white/5 mb-1" />
            {FORM_CARD_SKELETONS.map((key) => (
              <Panel
                key={key}
                className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="h-4 w-48 rounded bg-white/5 mb-2" />
                  <div className="h-3 w-32 rounded bg-white/5" />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="h-7 w-16 rounded-md bg-white/5" />
                  <div className="h-7 w-20 rounded-md bg-white/5" />
                </div>
              </Panel>
            ))}
          </div>
        </div>
      </DashboardMain>
    </DashboardShell>
  );
}
