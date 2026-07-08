export default function DashboardLoading() {
  return (
    <div className="h-[calc(100vh-4rem)] bg-sbi-dark flex flex-col p-4 sm:p-6 md:p-8 overflow-hidden">
      <div className="max-w-7xl w-full mx-auto flex flex-col h-full min-h-0 animate-pulse">
        {/* PageHeader skeleton — title + subtitle */}
        <div className="mb-1">
          <div className="h-8 w-40 rounded bg-white/5" />
        </div>
        <div className="mb-6">
          <div className="h-3.5 w-56 rounded bg-white/5" />
        </div>

        {/* Neutral content area — subtle rows, no heavy borders */}
        <div className="flex-1 min-h-0 space-y-3">
          <div className="h-10 w-full rounded-md bg-white/5" />
          <div className="space-y-2 pt-2">
            <div className="h-4 w-3/4 rounded bg-white/[0.03]" />
            <div className="h-4 w-1/2 rounded bg-white/[0.03]" />
            <div className="h-4 w-2/3 rounded bg-white/[0.03]" />
            <div className="h-4 w-1/3 rounded bg-white/[0.03]" />
          </div>
        </div>
      </div>
    </div>
  );
}
