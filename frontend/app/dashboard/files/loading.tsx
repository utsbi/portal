import {
  DashboardShell,
  PageHeader,
  Panel,
  SectionLabel,
} from "@/components/dashboard/common/ui";

export default function FilesLoading() {
  return (
    <DashboardShell>
      <PageHeader
        title="Client Document Portal"
        subtitle="Browse and download files shared on your project."
      />

      <div className="flex flex-1 min-h-0 gap-6">
        {/* Folder tree sidebar (hidden on phones, matching the loaded page) */}
        <Panel className="hidden w-64 shrink-0 overflow-hidden md:block" padded>
          <SectionLabel className="mb-4">Folders</SectionLabel>
          <ul className="space-y-2 text-sm animate-pulse">
            {Array.from({ length: 6 }, (_, i) => `folder-${i}`).map((key) => (
              <li key={key} className="flex items-center gap-2 px-2 py-1">
                <span className="w-4" />
                <div className="h-3 w-32 rounded bg-white/5" />
              </li>
            ))}
          </ul>
        </Panel>

        {/* Breadcrumb + toolbar + file grid (mirrors the loaded layout) */}
        <main className="flex-1 min-w-0 flex flex-col">
          <div className="mb-6 flex flex-col gap-3 shrink-0 animate-pulse sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex min-h-10 items-center">
              <div className="h-4 w-40 rounded bg-white/5" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-10 w-28 rounded-md border border-sbi-dark-border/50 bg-white/5" />
              <div className="h-10 w-32 rounded-md border border-sbi-dark-border/50 bg-white/5" />
            </div>
          </div>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
            {Array.from({ length: 8 }, (_, i) => `file-${i}`).map((key) => (
              <div
                key={key}
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
