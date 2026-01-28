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
        <div className="flex flex-col gap-2">
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
                  "group relative flex items-center justify-end py-2 pl-6 pr-3 rounded-lg transition-all duration-300",
                  isActive
                    ? "bg-sbi-dark/80 backdrop-blur-md border border-sbi-dark-border shadow-lg translate-x-0"
                    : "bg-sbi-dark/30 backdrop-blur-sm border border-transparent hover:bg-sbi-dark/50 hover:border-white/10 translate-x-4 hover:translate-x-0",
                )}
              >
                <span
                  className={cn(
                    "text-sm font-medium mr-3 transition-colors duration-300 whitespace-nowrap",
                    isActive
                      ? "text-white"
                      : "text-white/60 group-hover:text-white",
                  )}
                >
                  {project.title}
                </span>

                <div
                  className={cn(
                    "w-2 h-2 rounded-full transition-all duration-300",
                    isActive
                      ? "bg-sbi-green shadow-[0_0_8px_rgba(34,197,94,0.8)] scale-125"
                      : "bg-white/30 group-hover:bg-white/60",
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
