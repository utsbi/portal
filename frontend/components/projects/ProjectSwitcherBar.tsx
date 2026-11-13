"use client";

import { ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useEffect, useState } from "react";
import type { Project } from "@/lib/data/projects";
import { cn } from "@/lib/utils";
import { formatProjectNumber } from "./ProjectIndex";

interface ProjectSwitcherBarProps {
  projects: Project[];
  activeIndex: number;
  visible: boolean;
  onSelect: (project: Project) => void;
}

/**
 * Thumb-reach project switcher for phones and tablets. It appears once the
 * project index has scrolled out of view, so switching projects never
 * requires scrolling back to the top of the page.
 */
export function ProjectSwitcherBar({
  projects,
  activeIndex,
  visible,
  onSelect,
}: ProjectSwitcherBarProps) {
  const [open, setOpen] = useState(false);
  const total = projects.length;
  const active = projects[activeIndex];

  useEffect(() => {
    if (!visible) setOpen(false);
  }, [visible]);

  const step = (delta: number) => {
    setOpen(false);
    onSelect(projects[(activeIndex + delta + total) % total]);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-md lg:hidden"
        >
          {open && (
            <button
              type="button"
              aria-label="Close project list"
              tabIndex={-1}
              onClick={() => setOpen(false)}
              className="fixed inset-0 -z-10 cursor-default"
            />
          )}

          <AnimatePresence>
            {open && (
              <motion.ul
                id="project-switcher-list"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-x-0 bottom-full mb-2 overflow-hidden rounded-lg border border-sbi-dark-border bg-sbi-dark/95 p-1 shadow-2xl backdrop-blur-md"
              >
                {projects.map((project, index) => {
                  const isActive = index === activeIndex;
                  return (
                    <li key={project.slug}>
                      <button
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          onSelect(project);
                        }}
                        aria-current={isActive ? "true" : undefined}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors",
                          isActive ? "bg-sbi-green/10" : "active:bg-white/5",
                        )}
                      >
                        <span className="relative h-10 w-14 shrink-0 overflow-hidden rounded-sm bg-sbi-dark-card">
                          <Image
                            src={project.coverImage}
                            alt=""
                            fill
                            sizes="56px"
                            className="object-cover"
                          />
                        </span>
                        <span
                          className={cn(
                            "font-mono text-[11px] tracking-widest",
                            isActive ? "text-sbi-green" : "text-sbi-muted",
                          )}
                        >
                          {formatProjectNumber(index)}
                        </span>
                        <span
                          className={cn(
                            "min-w-0 flex-1 truncate text-sm",
                            isActive ? "text-white" : "text-white/80",
                          )}
                        >
                          {project.title}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </motion.ul>
            )}
          </AnimatePresence>

          <div className="flex items-stretch overflow-hidden rounded-lg border border-sbi-dark-border bg-sbi-dark/90 shadow-2xl backdrop-blur-md">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous project"
              className="flex w-12 shrink-0 items-center justify-center text-white/70 transition-colors active:bg-white/10 active:text-white"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-controls="project-switcher-list"
              className="flex min-w-0 flex-1 items-center justify-center gap-2 border-x border-sbi-dark-border px-3 py-2.5 text-left"
            >
              <span className="min-w-0">
                <span className="block font-mono text-[10px] tracking-widest text-sbi-green">
                  PROJECT {formatProjectNumber(activeIndex)} /{" "}
                  {formatProjectNumber(total - 1)}
                </span>
                <span className="block truncate text-sm text-white">
                  {active.title}
                </span>
              </span>
              <ChevronUp
                size={16}
                className={cn(
                  "shrink-0 text-white/60 transition-transform",
                  open && "rotate-180",
                )}
              />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next project"
              className="flex w-12 shrink-0 items-center justify-center text-white/70 transition-colors active:bg-white/10 active:text-white"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
