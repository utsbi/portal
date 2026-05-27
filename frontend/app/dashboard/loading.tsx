export default function DashboardLoading() {
  return (
    <div className="h-[calc(100vh-4rem)] bg-sbi-dark flex flex-col p-6 md:p-8 overflow-hidden">
      <div className="max-w-7xl w-full mx-auto flex flex-col h-full min-h-0">
        {/* Title skeleton */}
        <div className="animate-pulse mb-2">
          <div className="h-8 md:h-9 w-48 bg-white/5 rounded" />
        </div>
        {/* Subtitle skeleton */}
        <div className="animate-pulse mb-8">
          <div className="h-4 w-72 bg-white/5 rounded" />
        </div>

        {/* Content skeleton — three stacked panels */}
        <div className="flex-1 min-h-0 grid gap-4">
          <div className="animate-pulse rounded-lg border border-sbi-dark-border/50 bg-sbi-dark-card/30 h-12" />
          <div className="animate-pulse rounded-lg border border-sbi-dark-border/50 bg-sbi-dark-card/30 flex-1 min-h-32" />
        </div>
      </div>
    </div>
  );
}
