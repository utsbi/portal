export default function TableComparisonLoading() {
  return (
    <div className="flex flex-col min-h-screen w-full bg-sbi-dark p-6 md:p-10 space-y-12 overflow-hidden">
      {/* Page header */}
      <div className="space-y-3 border-b border-sbi-dark-border pb-6 animate-pulse">
        <div className="h-8 w-72 rounded bg-white/5" />
        <div className="h-4 w-full max-w-2xl rounded bg-white/5" />
      </div>

      {/* Stacked design sections, each a labeled table card */}
      {Array.from({ length: 3 }, (_, i) => `section-${i}`).map((sectionKey) => (
        <section key={sectionKey} className="space-y-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 rounded-full bg-white/5" />
            <div className="space-y-2">
              <div className="h-5 w-44 rounded bg-white/5" />
              <div className="h-3 w-80 rounded bg-white/5" />
            </div>
          </div>
          <div className="rounded-xl border border-sbi-dark-border bg-sbi-dark-card/30 p-6">
            <div className="rounded-md border border-sbi-dark-border bg-sbi-dark-card/40">
              <div className="h-11 border-b border-sbi-dark-border" />
              {Array.from(
                { length: 5 },
                (_, r) => `${sectionKey}-row-${r}`,
              ).map((rowKey) => (
                <div
                  key={rowKey}
                  className="h-12 border-b border-sbi-dark-border/50 last:border-b-0"
                />
              ))}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
