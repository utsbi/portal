"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { useProject } from "@/lib/project/project-context";
import { cn } from "@/lib/utils";

/**
 * Active-project context for the dashboard header.
 *
 * Directors/members get a bordered pill (initial-mark + truncated name +
 * chevron) that opens a listbox dropdown mirroring SearchableDropdown's
 * ARIA/keyboard pattern (listbox/option roles, arrow/enter/escape, focus
 * return, search field when the project list is long). Clients get the same
 * pill, quiet and non-interactive. It lives in the top bar so the active
 * project stays visible regardless of the sidebar's collapsed state, and the
 * project-scoped nav + the AI assistant both follow what is selected.
 */
export function ProjectSwitcher() {
  const { user, activeProject, projects, switchProject } = useProject();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  // Horizontal offset (px, <= 0) keeping the panel inside the viewport on
  // phones: the pill sits ~64px from the left while the panel is nearly
  // viewport-wide, so it shifts left until it clears a 1rem right gutter.
  const [panelOffset, setPanelOffset] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const role = user?.role;
  const canSwitch = role === "director" || role === "member";
  const showSearch = projects.length > 5;

  const filteredProjects = search
    ? projects.filter((p) =>
        p.companyName.toLowerCase().includes(search.toLowerCase()),
      )
    : projects;

  // Close on outside click.
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // On open: clamp the panel inside the viewport, then move focus into it
  // (search field when present, first option otherwise). Clear search on close.
  useEffect(() => {
    if (isOpen) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const panelWidth = Math.min(320, window.innerWidth - 32);
        const desiredLeft = Math.min(
          rect.left,
          window.innerWidth - panelWidth - 16,
        );
        setPanelOffset(Math.min(0, Math.round(desiredLeft - rect.left)));
      }
      requestAnimationFrame(() => {
        if (showSearch) {
          searchInputRef.current?.focus();
        } else {
          containerRef.current
            ?.querySelector<HTMLElement>('[data-option-idx="0"]')
            ?.focus();
        }
      });
    } else {
      setSearch("");
    }
  }, [isOpen, showSearch]);

  // Nothing to show until the project context has resolved a project.
  if (!activeProject && !canSwitch) return null;

  const label = activeProject?.companyName ?? "Select project";
  const initial = label.trim().charAt(0).toUpperCase() || "?";

  // Small initial-mark glyph shared by both pill variants.
  const mark = (
    <span
      aria-hidden
      className="flex size-6 shrink-0 items-center justify-center rounded-full border border-sbi-green/20 bg-sbi-green/10 font-jetbrains-mono text-[11px] font-medium text-sbi-green"
    >
      {initial}
    </span>
  );

  // Clients: a static readout, no switching, no hover affordance.
  if (!canSwitch) {
    return (
      <div className="ml-2 flex h-10 items-center gap-2 rounded-full border border-sbi-dark-border/60 bg-sbi-dark-card/30 pl-1.5 pr-3.5 md:ml-4">
        {mark}
        <span className="max-w-[140px] truncate text-xs font-light text-white sm:max-w-[200px]">
          {label}
        </span>
      </div>
    );
  }

  const close = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const selectProject = (projectId: number) => {
    if (projectId !== activeProject?.projectId) {
      switchProject(projectId);
    }
    close();
  };

  const focusOption = (idx: number) => {
    containerRef.current
      ?.querySelector<HTMLElement>(`[data-option-idx="${idx}"]`)
      ?.focus();
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsOpen(true);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown" && filteredProjects.length > 0) {
      e.preventDefault();
      focusOption(0);
    }
  };

  const handleOptionKeyDown = (
    e: React.KeyboardEvent,
    idx: number,
    projectId: number,
  ) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      focusOption(Math.min(idx + 1, filteredProjects.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (idx === 0) {
        if (showSearch) {
          searchInputRef.current?.focus();
        }
      } else {
        focusOption(idx - 1);
      }
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectProject(projectId);
    }
  };

  return (
    <div ref={containerRef} className="relative ml-2 md:ml-4">
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Switch project"
        className={cn(
          "group flex h-10 items-center gap-2 rounded-full border bg-sbi-dark-card/40 pl-1.5 pr-2.5 text-left transition-colors duration-300",
          "hover:border-sbi-green/30 hover:bg-sbi-dark-card/70",
          "focus:outline-none focus-visible:border-sbi-green/50 focus-visible:ring-1 focus-visible:ring-sbi-green/30",
          isOpen
            ? "border-sbi-green/30 bg-sbi-dark-card/70"
            : "border-sbi-dark-border",
        )}
      >
        {mark}
        <span className="max-w-[110px] truncate text-xs font-light text-white sm:max-w-[160px]">
          {label}
        </span>
        <ChevronDown
          className={cn(
            "size-3 shrink-0 text-sbi-muted transition-transform duration-300 group-hover:text-sbi-green",
            isOpen && "rotate-180 text-sbi-green",
          )}
          strokeWidth={1.5}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            style={{ left: panelOffset }}
            className="absolute top-full z-50 mt-1.5 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-sbi-dark-border bg-sbi-dark-card p-1 shadow-xl shadow-black/40"
          >
            <p className="px-2.5 pb-1.5 pt-1.5 text-[0.7rem] uppercase tracking-[0.2em] text-sbi-muted-dark">
              Switch project
            </p>

            {/* Search input — only when the list is long enough to need it. */}
            {showSearch && (
              <div className="relative mb-1 px-2 py-1">
                <Search className="absolute left-4 top-1/2 h-3 w-3 -translate-y-1/2 text-sbi-muted-dark" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search projects..."
                  className="w-full rounded-lg border border-sbi-dark-border bg-sbi-dark py-1.5 pl-8 pr-2 text-xs text-white placeholder:text-sbi-muted-dark focus:border-sbi-green/50 focus:outline-none"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}

            <div
              role="listbox"
              id={listboxId}
              aria-label="Projects"
              className="max-h-60 overflow-y-auto px-1 scrollbar-thin scrollbar-thumb-sbi-dark-border scrollbar-track-transparent"
            >
              {filteredProjects.length === 0 ? (
                <div className="px-3 py-2 text-center text-xs text-sbi-muted-dark">
                  No results
                </div>
              ) : (
                filteredProjects.map((project, idx) => {
                  const isActive =
                    activeProject?.projectId === project.projectId;
                  return (
                    <button
                      key={project.projectId}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      tabIndex={-1}
                      data-option-idx={idx}
                      onClick={() => selectProject(project.projectId)}
                      onKeyDown={(e) =>
                        handleOptionKeyDown(e, idx, project.projectId)
                      }
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors focus:outline-none focus:bg-white/[0.06]",
                        isActive
                          ? "text-sbi-green"
                          : "text-sbi-muted hover:bg-white/[0.04] hover:text-white",
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
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
