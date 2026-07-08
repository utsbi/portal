const SKELETON_ROWS = Array.from(
  { length: 6 },
  (_, i) => `conversation-skeleton-${i}`,
);

export default function MessagesLoading() {
  return (
    <div className="flex flex-1 min-h-0 h-full animate-pulse">
      {/* Conversation list column — matches DirectorMessages / MemberMessages / Messages */}
      <div className="w-full md:w-96 shrink-0 overflow-hidden md:border-r border-sbi-dark-border/40">
        {/* Header: title + compose action */}
        <div className="flex items-center justify-between px-4 py-4 shrink-0">
          <div className="h-5 w-24 rounded bg-white/5" />
          <div className="size-7 rounded bg-white/5" />
        </div>

        {/* Search field */}
        <div className="px-4 pb-3">
          <div className="h-9 w-full rounded-md bg-white/5" />
        </div>

        {/* Conversation rows: name + time, project, preview */}
        <div>
          {SKELETON_ROWS.map((key, i) => (
            <div
              key={key}
              className="px-4 py-3 border-b border-sbi-dark-border/30"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="h-4 w-28 rounded bg-white/5" />
                <div className="h-3 w-20 rounded bg-white/5" />
              </div>
              <div className="h-2.5 w-16 rounded bg-white/5 mb-1.5" />
              <div
                className={`h-3 rounded bg-white/5 ${i % 2 === 0 ? "w-4/5" : "w-3/5"}`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Detail column — thread layout matching DetailPane */}
      <div className="hidden md:flex flex-1 min-h-0 flex-col overflow-hidden">
        {/* Thread header */}
        <div className="shrink-0 px-6 py-4 border-b border-sbi-dark-border/40 bg-sbi-dark-card/30 flex items-center gap-3">
          <div className="size-9 shrink-0 rounded-full bg-white/5" />
          <div>
            <div className="h-4 w-36 rounded bg-white/5 mb-1.5" />
            <div className="h-2.5 w-20 rounded bg-white/5" />
          </div>
        </div>

        {/* Message bubbles */}
        <div className="flex-1 space-y-4 overflow-hidden p-6">
          <div className="h-14 w-3/5 rounded-2xl bg-white/5" />
          <div className="ml-auto h-10 w-2/5 rounded-2xl bg-white/5" />
          <div className="h-20 w-1/2 rounded-2xl bg-white/5" />
          <div className="ml-auto h-10 w-1/3 rounded-2xl bg-white/5" />
          <div className="h-14 w-2/5 rounded-2xl bg-white/5" />
        </div>

        {/* Composer */}
        <div className="shrink-0 border-t border-sbi-dark-border/40 p-4">
          <div className="h-11 w-full rounded-lg bg-white/5" />
        </div>
      </div>
    </div>
  );
}
