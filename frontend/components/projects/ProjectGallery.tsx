"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useEffect, useState } from "react";
import type { Project } from "@/lib/data/projects";

interface ProjectGalleryProps {
  project: Project;
}

export function ProjectGallery({ project }: ProjectGalleryProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(
    null,
  );

  // Handle escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedImageIndex(null);
      }
    };

    if (selectedImageIndex !== null) {
      window.addEventListener("keydown", handleKeyDown);
      // Prevent scrolling when modal is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [selectedImageIndex]);

  const handleCloseModal = () => setSelectedImageIndex(null);

  // If no gallery images, don't render the section
  if (!project.galleryImages || project.galleryImages.length === 0) {
    return null;
  }

  return (
    <section className="relative py-32 md:py-48 overflow-hidden bg-sbi-dark">
      <div className="relative z-10 max-w-7xl mx-auto px-8 md:px-16">
        {/* Section header */}
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
              Gallery
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight">
            Project Images
          </h2>
          <p className="mt-4 text-sbi-muted max-w-xl">
            {project.galleryImages.length} images
          </p>
        </motion.div>

        {/* Image grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {project.galleryImages.map((image, index) => (
            <motion.button
              key={image.src}
              type="button"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              viewport={{ once: true }}
              onClick={() => setSelectedImageIndex(index)}
              className="relative aspect-[4/3] overflow-hidden group cursor-pointer w-full"
            >
              <Image
                src={image}
                alt={`Gallery image ${index + 1}`}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
                sizes="(max-width: 768px) 50vw, 33vw"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
            </motion.button>
          ))}
        </div>
      </div>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {selectedImageIndex !== null && (
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
              className="relative max-w-5xl w-full max-h-[90vh] overflow-hidden bg-sbi-dark-card border border-sbi-dark-border flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                type="button"
                onClick={handleCloseModal}
                className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center border border-sbi-dark-border hover:border-sbi-green/30 bg-sbi-dark transition-colors cursor-pointer"
              >
                <span className="text-white text-xl">×</span>
              </button>

              {/* Main image */}
              <div className="flex-1 relative min-h-0">
                <div className="w-full h-full relative">
                  <Image
                    src={project.galleryImages[selectedImageIndex]}
                    alt="Project image"
                    fill
                    className="object-contain"
                    sizes="(max-width: 1280px) 100vw, 1280px"
                  />
                </div>
              </div>

              {/* Thumbnail strip */}
              {project.galleryImages.length > 1 && (
                <div className="p-4 flex gap-2 overflow-x-auto bg-sbi-dark-card border-t border-sbi-dark-border shrink-0">
                  {project.galleryImages.map((img, index) => (
                    <button
                      key={img.src}
                      type="button"
                      onClick={() => setSelectedImageIndex(index)}
                      className={`relative w-20 h-16 flex-shrink-0 overflow-hidden border-2 transition-colors cursor-pointer ${
                        index === selectedImageIndex
                          ? "border-sbi-green"
                          : "border-sbi-dark-border hover:border-sbi-green/50"
                      }`}
                    >
                      <Image
                        src={img}
                        alt={`Thumbnail ${index + 1}`}
                        fill
                        className="object-cover"
                        sizes="80px"
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
