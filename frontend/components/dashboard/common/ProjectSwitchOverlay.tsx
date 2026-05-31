"use client";

import { useProject } from "@/lib/project/project-context";

/**
 * Renders a loading overlay over the main content area while a project switch
 * is re-running server components. Must be placed inside a `relative` ancestor
 * that wraps only the content area (not the sidebar or header).
 */
export function ProjectSwitchOverlay() {
  const { isSwitching } = useProject();
  if (!isSwitching) return null;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-sbi-dark/60 backdrop-blur-sm">
      <div className="flex items-center gap-3 rounded-md border border-sbi-dark-border/60 bg-sbi-dark-card/80 px-4 py-2.5">
        <span className="h-3 w-3 rounded-full border-2 border-sbi-green border-t-transparent animate-spin" />
        <span className="text-xs uppercase tracking-[0.18em] text-sbi-muted">
          Switching project…
        </span>
      </div>
    </div>
  );
}
