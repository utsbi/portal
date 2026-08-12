"use client";

import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isStaffRole } from "@/lib/auth/roles";
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

  const role = user?.role;
  const canSwitch = isStaffRole(role) || role === "member";

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
      <div className="ml-2 flex flex-col px-3 py-2 md:ml-4 md:px-4">
        {eyebrow}
        <span className="max-w-[140px] truncate text-xs font-light text-white sm:max-w-[200px]">
          {label}
        </span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Switch project"
          className="group relative ml-2 flex min-h-11 flex-col justify-center px-3 py-2 text-left md:ml-4 md:px-4"
        >
          {eyebrow}
          <span className="flex items-center gap-1.5 text-xs font-light text-white">
            <span className="max-w-[120px] truncate sm:max-w-[160px]">
              {label}
            </span>
            <ChevronDown
              className={cn(
                "size-3 shrink-0 text-sbi-muted transition-transform duration-300",
                "group-hover:text-sbi-green",
                "group-data-[state=open]:rotate-180 group-data-[state=open]:text-sbi-green",
              )}
              strokeWidth={1.5}
            />
          </span>

          {/* Hairline green underline on hover, mirroring StatusIndicator. */}
          <span
            className={cn(
              "absolute bottom-0 left-0 right-0 h-px transition-colors duration-300",
              "bg-sbi-green/0 group-hover:bg-sbi-green/30 group-data-[state=open]:bg-sbi-green/40",
            )}
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        alignOffset={8}
        sideOffset={6}
        className="w-60 rounded-xl border-sbi-dark-border bg-sbi-dark p-1.5 shadow-xl shadow-black/40"
      >
        <p className="px-2.5 pb-1.5 pt-1 text-[0.7rem] uppercase tracking-[0.2em] text-sbi-muted-dark">
          Switch project
        </p>
        {projects.map((project) => {
          const isActive = activeProject?.projectId === project.projectId;
          return (
            <DropdownMenuItem
              key={project.projectId}
              onClick={() => switchProject(project.projectId)}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors focus:bg-sbi-dark-card",
                isActive
                  ? "text-sbi-green focus:text-sbi-green"
                  : "text-sbi-muted focus:text-white",
              )}
            >
              <span className="truncate">{project.companyName}</span>
              {isActive && (
                <Check className="ml-auto size-3.5 shrink-0" strokeWidth={2} />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
