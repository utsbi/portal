import { DashboardShell, PageHeader, Panel, SectionLabel } from "@/components/dashboard/common/ui";

export default function FilesLoading() {
  return (
    <DashboardShell>
      <PageHeader
        title="Client Document Portal"
        subtitle="Browse and download files shared on your project."
      />

      <div className="flex flex-1 min-h-0 gap-6">
        {/* Folder tree sidebar */}
        <Panel className="w-64 shrink-0 overflow-hidden" padded>
          <SectionLabel className="mb-4">Folders</SectionLabel>
          <ul className="space-y-2 text-sm animate-pulse">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="flex items-center gap-2 px-2 py-1">
                <span className="w-4" />
                <div className="h-3 w-32 rounded bg-white/5" />
              </li>
            ))}
          </ul>
        </Panel>

        {/* Breadcrumb + file grid */}
        <main className="flex-1 min-w-0 flex flex-col">
          <div className="mb-6 h-5 w-48 shrink-0 animate-pulse rounded bg-white/5" />
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex min-h-[3.75rem] items-center gap-3 rounded-lg border border-sbi-dark-border/50 bg-sbi-dark-card/30 px-4 py-3 animate-pulse"
              >
                <div className="h-4 w-4 shrink-0 rounded bg-white/5" />
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 h-4 w-3/5 rounded bg-white/5" />
                  <div className="h-3 w-2/5 rounded bg-white/5" />
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </DashboardShell>
  );
}
