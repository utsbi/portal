"use client";

import { ChevronDown } from "lucide-react";
import { motion } from "motion/react";
import type { Project } from "@/lib/data/projects";

const statusLabels = {
  completed: "Completed",
  "in-progress": "In Progress",
  concept: "Concept",
};

const statusColors = {
  completed: "bg-sbi-green/20 text-sbi-green border-sbi-green/30",
  "in-progress": "bg-amber-500/20 text-amber-400 border-amber-500/30",
  concept: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

interface ProjectInfoOverlayProps {
  project: Project;
}

export function ProjectInfoOverlay({ project }: ProjectInfoOverlayProps) {
  const handleScrollToDetails = () => {
    document
      .getElementById("project-details")
      ?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="absolute bottom-16 xl:bottom-0 left-0 p-4 xl:p-8 z-20">
      <motion.div
        key={project.slug}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="bg-sbi-dark/80 backdrop-blur-md rounded-lg border border-sbi-dark-border overflow-hidden xl:max-w-sm"
      >
        <div className="px-4 py-3 xl:px-5 xl:py-4">
          <div className="flex items-center gap-2 xl:gap-3 xl:mb-2">
            <h3 className="text-base xl:text-2xl font-light text-white tracking-tight">
              {project.title}
            </h3>
            <span
              className={`hidden xl:inline-block px-3 py-1 text-xs tracking-wider uppercase border whitespace-nowrap ${statusColors[project.status]}`}
            >
              {statusLabels[project.status]}
            </span>
          </div>

          <p className="hidden xl:block text-sm text-sbi-muted leading-relaxed line-clamp-2 max-w-md">
            {project.description}
          </p>
        </div>

        <button
          type="button"
          onClick={handleScrollToDetails}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 xl:px-5 xl:py-3 border-t border-sbi-dark-border text-white/70 hover:text-sbi-green hover:bg-white/5 transition-colors text-xs xl:text-sm tracking-wide"
        >
          <span>View Details</span>
          <motion.span
            animate={{ y: [0, 3, 0] }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="flex items-center"
          >
            <ChevronDown size={14} />
          </motion.span>
        </button>
      </motion.div>
    </div>
  );
}
