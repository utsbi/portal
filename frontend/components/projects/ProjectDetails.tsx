"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useEffect, useState } from "react";
import type { Project } from "@/lib/data/projects";

interface ProjectDetailsProps {
  project: Project;
  projects: Project[];
  onProjectChange: (project: Project) => void;
}

const statusLabels = {
  completed: "Completed",
  "in-progress": "In Progress",
  concept: "Concept",
};

export function ProjectDetails({
  project,
  projects,
  onProjectChange,
}: ProjectDetailsProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(
    null,
  );

  // Reset gallery selection when project changes
  useEffect(() => {
    setSelectedImageIndex(null);
  }, [project.slug]);

  // Handle escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedImageIndex(null);
      }
    };

    if (selectedImageIndex !== null) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [selectedImageIndex]);

  const handleCloseModal = () => setSelectedImageIndex(null);

  return (
    <section
      id="project-details"
      className="scroll-mt-20 relative py-20 md:py-32 overflow-hidden bg-sbi-dark border-t border-sbi-dark-border"
    >
      <div className="relative z-10 max-w-7xl mx-auto px-8 md:px-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ once: true }}
          className="mb-12"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-px bg-sbi-green" />
            <span className="text-xs tracking-[0.3em] uppercase text-sbi-green">
              Details
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight">
            {project.title}
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 md:gap-16">
          {/* Left Column: Description & Gallery */}
          <div className="lg:col-span-2 space-y-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              viewport={{ once: true }}
            >
              <h3 className="text-xl font-medium text-white mb-4">
                About This Project
              </h3>
              <p className="text-sbi-muted leading-relaxed text-lg">
                {project.description}
              </p>
            </motion.div>

            {/* Compact Gallery Grid */}
            {project.galleryImages && project.galleryImages.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.6 }}
                viewport={{ once: true }}
              >
                <h3 className="text-xl font-medium text-white mb-4">Gallery</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {project.galleryImages.map((image, index) => (
                    <motion.button
                      key={image.src}
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedImageIndex(index)}
                      className="relative aspect-square overflow-hidden rounded-sm group cursor-pointer w-full bg-sbi-dark-card border border-sbi-dark-border"
                    >
                      <Image
                        src={image}
                        alt={`Gallery image ${index + 1}`}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                        sizes="(max-width: 768px) 50vw, 25vw"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* Right Column: Metadata */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            viewport={{ once: true }}
            className="space-y-8 lg:border-l lg:border-sbi-dark-border lg:pl-12"
          >
            <div>
              <h4 className="text-sm text-sbi-muted uppercase tracking-wider mb-2">
                Status
              </h4>
              <span className="px-3 py-1 text-sm text-white border border-sbi-dark-border bg-sbi-dark-card inline-block">
                {statusLabels[project.status]}
              </span>
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

            <div>
              <h4 className="text-sm text-sbi-muted uppercase tracking-wider mb-3">
                Other Projects
              </h4>
              <div className="flex flex-col gap-2 max-w-xs lg:max-w-none">
                {projects
                  .filter((p) => p.slug !== project.slug)
                  .map((p) => (
                    <button
                      key={p.slug}
                      type="button"
                      onClick={() => {
                        onProjectChange(p);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="text-left px-3 py-3 rounded border border-sbi-dark-border hover:border-sbi-green/50 hover:bg-sbi-dark-card transition-colors"
                    >
                      <span className="text-white text-sm">{p.title}</span>
                    </button>
                  ))}
                <div className="px-3 py-3 text-sm text-sbi-muted italic text-center border border-dashed border-sbi-dark-border rounded">
                  More projects coming soon
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {selectedImageIndex !== null && project.galleryImages && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
            onClick={handleCloseModal}
          >
            <div className="absolute inset-0 bg-sbi-dark/95 backdrop-blur-sm" />

            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="relative max-w-6xl w-full h-[90vh] overflow-hidden bg-transparent flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                type="button"
                onClick={handleCloseModal}
                className="absolute top-0 right-0 z-50 w-12 h-12 flex items-center justify-center text-white hover:text-sbi-green transition-colors cursor-pointer"
              >
                <span className="text-4xl leading-none">&times;</span>
              </button>

              {/* Main image */}
              <div className="flex-1 relative min-h-0 h-full">
                <Image
                  src={project.galleryImages[selectedImageIndex]}
                  alt="Project image"
                  fill
                  className="object-contain"
                  sizes="100vw"
                  priority
                />
              </div>

              {/* Thumbnail strip */}
              {project.galleryImages.length > 1 && (
                <div className="mt-4 flex justify-center gap-2 overflow-x-auto py-2">
                  {project.galleryImages.map((img, index) => (
                    <button
                      key={img.src}
                      type="button"
                      onClick={() => setSelectedImageIndex(index)}
                      className={`relative w-16 h-12 flex-shrink-0 overflow-hidden border transition-all cursor-pointer rounded-sm ${
                        index === selectedImageIndex
                          ? "border-sbi-green opacity-100 scale-110"
                          : "border-transparent opacity-50 hover:opacity-100"
                      }`}
                    >
                      <Image
                        src={img}
                        alt={`Thumbnail ${index + 1}`}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
