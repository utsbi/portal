import {
  DashboardShell,
  PageHeader,
  SectionLabel,
} from "@/components/dashboard/common/ui";

export default function LifecycleLoading() {
  return (
    <DashboardShell>
      <PageHeader
        title="Lifecycle"
        subtitle="Track progress across your active projects"
      />

      <main className="flex-1 overflow-hidden">
        <div className="flex flex-col gap-8 animate-pulse">
          {/* Current focus hero card */}
          <div>
            <SectionLabel>Current Focus</SectionLabel>
            <div className="h-40 rounded-2xl bg-white/5" />
          </div>

          {/* All projects grid */}
          <div>
            <SectionLabel>All Projects</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 3 }, (_, i) => `project-${i}`).map(
                (key) => (
                  <div key={key} className="h-56 rounded-xl bg-white/5" />
                ),
              )}
            </div>
          </div>
        </div>
      </main>
    </DashboardShell>
  );
}
