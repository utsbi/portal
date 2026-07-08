import {
  DashboardShell,
  PageHeader,
  Panel,
} from "@/components/dashboard/common/ui";

const SKELETON_GROUPS = [
  { id: "a", count: 3 },
  { id: "b", count: 4 },
  { id: "c", count: 2 },
];

export default function ChatsLoading() {
  return (
    <DashboardShell className="max-w-3xl">
      <PageHeader title="Chats" subtitle="Loading…" />

      {/* Search field skeleton */}
      <div className="mb-3 shrink-0 animate-pulse">
        <div className="h-10 w-full rounded-md bg-white/5" />
      </div>

      {/* Filter chips skeleton */}
      <div className="flex gap-1.5 mb-4 shrink-0 animate-pulse">
        <div className="h-8 w-12 rounded-md bg-white/5" />
        <div className="h-8 w-16 rounded-md bg-white/5" />
        <div className="h-8 w-24 rounded-md bg-white/5" />
        <div className="h-8 w-20 rounded-md bg-white/5" />
      </div>

      {/* Date-bucketed list skeleton */}
      <Panel className="flex-1 min-h-0 overflow-hidden">
        <div className="animate-pulse">
          {SKELETON_GROUPS.map((group) => (
            <div key={group.id} className="mb-5">
              <div className="mb-2 h-2.5 w-20 rounded-sm bg-white/5" />
              <div className="divide-y divide-sbi-dark-border/40">
                {Array.from({ length: group.count }, (_, i) => (
                  <div
                    key={`${group.id}-${i}`}
                    className="flex items-center gap-3 py-3.5"
                  >
                    <div className="h-4 flex-1 rounded bg-white/5" />
                    <div className="h-3 w-16 shrink-0 rounded bg-white/5" />
                    <div className="h-3 w-10 shrink-0 rounded bg-white/5" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </DashboardShell>
  );
}
