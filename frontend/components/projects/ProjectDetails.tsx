import { motion } from "motion/react";
import type { Project } from "@/lib/data/projects";

interface ProjectDetailsProps {
  project: Project;
}

const statusLabels = {
  completed: "Completed",
  "in-progress": "In Progress",
  concept: "Concept",
};

export function ProjectDetails({ project }: ProjectDetailsProps) {
  return (
    <section className="relative py-32 md:py-48 overflow-hidden bg-sbi-dark border-t border-sbi-dark-border">
      <div className="relative z-10 max-w-7xl mx-auto px-8 md:px-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-px bg-sbi-green" />
            <span className="text-xs tracking-[0.3em] uppercase text-sbi-green">
              Details
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight">
            Project Information
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h3 className="text-xl font-medium text-white mb-4">
              About This Project
            </h3>
            <p className="text-sbi-muted leading-relaxed">
              {project.description}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            viewport={{ once: true }}
            className="space-y-6"
          >
            <div>
              <h4 className="text-sm text-sbi-muted uppercase tracking-wider mb-2">
                Status
              </h4>
              <p className="text-white">{statusLabels[project.status]}</p>
            </div>

            <div>
              <h4 className="text-sm text-sbi-muted uppercase tracking-wider mb-3">
                Categories
              </h4>
              <div className="flex flex-wrap gap-2">
                {project.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 text-sm text-white border border-sbi-dark-border bg-sbi-dark-card"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {project.has3D && (
              <div>
                <h4 className="text-sm text-sbi-muted uppercase tracking-wider mb-2">
                  3D Model
                </h4>
                <p className="text-sbi-green">Interactive 3D model available</p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
