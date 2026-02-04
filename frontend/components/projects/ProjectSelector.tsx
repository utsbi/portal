import { motion } from "motion/react";
import type { Project } from "@/lib/data/projects";
import { cn } from "@/lib/utils";

interface ProjectSelectorProps {
  projects: Project[];
  activeProject: Project;
  onProjectChange: (project: Project) => void;
}

export function ProjectSelector({
  projects,
  activeProject,
  onProjectChange,
}: ProjectSelectorProps) {
  return (
    <div className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 z-30 pointer-events-none">
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="pointer-events-auto"
      >
        <div className="flex flex-col gap-3 md:gap-2 items-end">
          {projects.map((project, index) => {
            const isActive = project.slug === activeProject.slug;
            return (
              <motion.button
                key={project.slug}
                onClick={() => onProjectChange(project)}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + index * 0.1 }}
                className={cn(
                  "group relative flex items-center justify-end rounded-lg transition-all duration-300",
                  "p-3 md:py-2 md:pl-6 md:pr-3",
                  isActive
                    ? "md:bg-sbi-dark/80 md:backdrop-blur-md md:border md:border-sbi-dark-border md:shadow-lg"
                    : "md:bg-sbi-dark/30 md:backdrop-blur-sm md:border md:border-transparent md:hover:bg-sbi-dark/50 md:hover:border-white/10 md:translate-x-4 md:hover:translate-x-0",
                )}
              >
                <span
                  className={cn(
                    "text-sm font-medium mr-3 transition-colors duration-300 whitespace-nowrap hidden md:inline",
                    isActive
                      ? "text-white"
                      : "text-white/60 group-hover:text-white",
                  )}
                >
                  {project.title}
                </span>

                <div
                  className={cn(
                    "w-3 h-3 md:w-2 md:h-2 rounded-full transition-all duration-300",
                    isActive
                      ? "bg-sbi-green shadow-[0_0_8px_rgba(34,197,94,0.8)] scale-125"
                      : "bg-white/40 group-hover:bg-white/60",
                  )}
                />
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
