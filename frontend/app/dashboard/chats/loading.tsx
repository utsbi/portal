import { DashboardShell, PageHeader, Panel } from "@/components/dashboard/common/ui";

export default function ChatsLoading() {
  return (
    <DashboardShell className="max-w-3xl">
      <PageHeader title="Chats" subtitle="Loading…" />

      {/* Search field skeleton */}
      <div className="mb-4 shrink-0 animate-pulse">
        <div className="h-10 w-full rounded-md bg-white/5" />
      </div>

      {/* Conversation list skeleton — stacked rows */}
      <Panel className="flex-1 min-h-0 overflow-hidden">
        <div className="animate-pulse divide-y divide-sbi-dark-border/40">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-3.5">
              <div className="h-4 flex-1 rounded bg-white/5" />
              <div className="h-3 w-12 shrink-0 rounded bg-white/5" />
            </div>
          ))}
        </div>
      </Panel>
    </DashboardShell>
  );
}
