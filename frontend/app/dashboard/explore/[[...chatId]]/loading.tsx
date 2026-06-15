// Suspense fallback for the Explore portal. Mirrors the real centered layout —
// "Hello, X" hero (PortalHero) + the composer (PortalInput) + suggestion chips
// — instead of the generic dashboard skeleton, so entering Explore doesn't flash
// an unrelated panels layout. The fixed PortalHeader chrome is drawn by the
// portal itself; this only fills the content area.
export default function ExploreLoading() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4">
      <div className="flex w-full max-w-2xl flex-col items-center animate-pulse">
        {/* Greeting ("Hello, X") */}
        <div className="h-11 w-72 rounded-lg bg-white/5" />
        {/* Subtitle ("How can I help you?") */}
        <div className="mt-5 h-5 w-48 rounded bg-white/5" />
        {/* Decorative divider line */}
        <div className="mt-6 h-px w-24 bg-white/10" />

        {/* Composer box */}
        <div className="mt-10 h-28 w-full rounded-2xl border border-sbi-dark-border/50 bg-sbi-dark-card/30" />

        {/* Suggestion chips */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <div className="h-9 w-36 rounded-full bg-white/5" />
          <div className="h-9 w-36 rounded-full bg-white/5" />
          <div className="h-9 w-44 rounded-full bg-white/5" />
        </div>
      </div>
    </div>
  );
}
