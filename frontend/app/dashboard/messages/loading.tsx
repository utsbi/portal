export default function MessagesLoading() {
  return (
    <div className="flex flex-1 min-h-0 h-full animate-pulse">
      {/* Conversation list column */}
      <div className="w-96 shrink-0 overflow-hidden border-r border-sbi-dark-border/40 p-4">
        <div className="mb-4 h-9 w-full rounded-md bg-white/5" />
        <div className="space-y-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-2 py-3">
              <div className="h-9 w-9 shrink-0 rounded-full bg-white/5" />
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 h-4 w-2/3 rounded bg-white/5" />
                <div className="h-3 w-4/5 rounded bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Thread column */}
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
        {/* Thread header */}
        <div className="flex items-center gap-3 border-b border-sbi-dark-border/40 px-6 py-4">
          <div className="h-10 w-10 rounded-full bg-white/5" />
          <div className="h-4 w-40 rounded bg-white/5" />
        </div>

        {/* Message bubbles */}
        <div className="flex-1 space-y-4 overflow-hidden p-6">
          <div className="h-16 w-3/5 rounded-2xl bg-white/5" />
          <div className="ml-auto h-12 w-2/5 rounded-2xl bg-white/5" />
          <div className="h-20 w-1/2 rounded-2xl bg-white/5" />
          <div className="ml-auto h-12 w-1/3 rounded-2xl bg-white/5" />
        </div>

        {/* Composer */}
        <div className="border-t border-sbi-dark-border/40 p-4">
          <div className="h-11 w-full rounded-md bg-white/5" />
        </div>
      </div>
    </div>
  );
}
