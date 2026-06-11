"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useProject } from "@/lib/project/project-context";
import { cn } from "@/lib/utils";

/**
 * Active-project context for the dashboard header.
 *
 * Shares the visual language of the adjacent ProjectStatusBar StatusIndicators:
 * a tracked eyebrow label over a light value, no boxed chrome, a hairline green
 * underline on hover. Directors/members get a switcher (chevron + dropdown);
 * clients get the same readout without the control. It lives in the top bar so
 * the active project stays visible regardless of the sidebar's collapsed state,
 * and the project-scoped nav + the AI assistant both follow what is selected.
 */
export function ProjectSwitcher() {
  const { user, activeProject, projects, switchProject } = useProject();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const role = user?.role;
  const canSwitch = role === "director" || role === "member";

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Escape closes the menu and returns focus to the trigger.
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Nothing to show until the project context has resolved a project.
  if (!activeProject && !canSwitch) return null;

  const label = activeProject?.companyName ?? "Select project";

  // Stacked eyebrow + value, matching StatusIndicator's typography exactly
  // (no gap, natural line-height) so the project block reads as part of the bar.
  const eyebrow = (
    <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-sbi-muted-dark">
      Project
    </span>
  );

  // Clients: a static readout, no switching, no hover affordance.
  if (!canSwitch) {
    return (
      <div className="ml-4 flex flex-col px-4 py-2">
        {eyebrow}
        <span className="max-w-[200px] truncate text-xs font-light text-white">
          {label}
        </span>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative ml-4">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Switch project"
        className="group relative flex flex-col px-4 py-2 text-left"
      >
        {eyebrow}
        <span className="flex items-center gap-1.5 text-xs font-light text-white">
          <span className="max-w-[160px] truncate">{label}</span>
          <ChevronDown
            className={cn(
              "size-3 shrink-0 text-sbi-muted transition-transform duration-300",
              "group-hover:text-sbi-green",
              open && "rotate-180",
            )}
            strokeWidth={1.5}
          />
        </span>

        {/* Hairline green underline on hover, mirroring StatusIndicator. */}
        <span
          className={cn(
            "absolute bottom-0 left-0 right-0 h-px transition-colors duration-300",
            open
              ? "bg-sbi-green/40"
              : "bg-sbi-green/0 group-hover:bg-sbi-green/30",
          )}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Switch project"
          className="absolute left-2 top-full z-50 mt-1.5 w-60 rounded-xl border border-sbi-dark-border bg-sbi-dark p-1.5 shadow-xl shadow-black/40"
        >
          <p className="px-2.5 pb-1.5 pt-1 text-[0.7rem] uppercase tracking-[0.2em] text-sbi-muted-dark">
            Switch project
          </p>
          {projects.map((project) => {
            const isActive = activeProject?.projectId === project.projectId;
            return (
              <button
                key={project.projectId}
                type="button"
                role="menuitem"
                onClick={() => {
                  switchProject(project.projectId);
                  setOpen(false);
                  buttonRef.current?.focus();
                }}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                  isActive
                    ? "text-sbi-green"
                    : "text-sbi-muted hover:bg-sbi-dark-card hover:text-white",
                )}
              >
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full transition-colors",
                    isActive ? "bg-sbi-green" : "bg-sbi-muted-dark/40",
                  )}
                />
                <span className="truncate">{project.companyName}</span>
                {isActive && (
                  <Check
                    className="ml-auto size-3.5 shrink-0"
                    strokeWidth={2}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
