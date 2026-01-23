"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useState } from "react";
import ex1 from "@/assets/images/project-one/exterior-concept/EXTERIOR-1.webp";
import ex2 from "@/assets/images/project-one/exterior-concept/EXTERIOR-2.webp";
import site1 from "@/assets/images/project-one/site-view/SITE-1.webp";
import pe1 from "@/assets/images/project-two/exterior-concept/1.webp";
import pe2 from "@/assets/images/project-two/exterior-concept/2.webp";
import pe3 from "@/assets/images/project-two/exterior-concept/3.webp";
import pe4 from "@/assets/images/project-two/exterior-concept/4.webp";
import { BlueprintGrid } from "@/components/blueprint-grid";
import { MagneticButton } from "@/components/magnetic-button";
import { PageHero } from "@/components/page-hero";
import { type Project, ProjectCard } from "@/components/project-card";

const projects: Project[] = [
  {
    slug: "sustainable-family-home",
    title: "Sustainable Family Home",
    description:
      "A modern farmhouse concept designed for sustainable family living. This 2-bedroom, 2-bathroom home features a spacious layout, including a large garage and patio, that thoughtfully integrates classic design with modern, eco-friendly efficiencies and materials.",
    status: "completed",
    tags: ["Residential", "Modern Farmhouse", "2BR/2BA", "Eco-Friendly"],
    coverImage: pe1,
  },
  {
    slug: "hobbie-farm",
    title: "Hobbie Farm Project",
    description:
      "A small, space-efficient housing concept designed as a foundation for sustainable living. This prototype serves as a starting point, with plans to integrate eco-friendly features and innovations during the building process.",
    status: "completed",
    tags: ["Prototype", "Space-Efficient", "Sustainable Tech"],
    coverImage: ex1,
  },
];

const galleryImages = {
  "sustainable-family-home": [pe1, pe2, pe3, pe4],
  "hobbie-farm": [ex1, ex2, site1],
};

export default function ProjectsPage() {
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const handleProjectClick = (slug: string) => {
    setSelectedProject(slug);
    setSelectedImageIndex(0);
  };

  const handleCloseModal = () => {
    setSelectedProject(null);
  };

  const currentGallery = selectedProject
    ? galleryImages[selectedProject as keyof typeof galleryImages]
    : [];

  return (
    <div className="bg-sbi-dark text-white">
      <PageHero
        label="Our Work"
        title="Projects"
        subtitle="Professional-grade sustainable building solutions designed and executed by our interdisciplinary team."
      />

      <section className="relative py-32 md:py-48 overflow-hidden">
        <BlueprintGrid />
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
                Featured
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight">
              Latest Project
            </h2>
          </motion.div>

          <ProjectCard
            project={projects[0]}
            index={0}
            featured
            onClick={() => handleProjectClick(projects[0].slug)}
          />
        </div>
      </section>

      <section className="relative py-32 md:py-48 overflow-hidden">
        <BlueprintGrid />
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
                Portfolio
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight">
              All Projects
            </h2>
            <p className="mt-4 text-sbi-muted max-w-xl">
              Explore our complete portfolio of sustainable building projects.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {projects.map((project, index) => (
              <ProjectCard
                key={project.slug}
                project={project}
                index={index}
                onClick={() => handleProjectClick(project.slug)}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-32 border-t border-sbi-dark-border">
        <BlueprintGrid />
        <div className="relative z-10 max-w-4xl mx-auto px-8 md:px-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            viewport={{ once: true }}
          >
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              viewport={{ once: true }}
              className="inline-block px-4 py-2 mb-8 text-xs tracking-[0.3em] uppercase text-sbi-green border border-sbi-green/30"
            >
              Collaborate
            </motion.span>

            <h2 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight mb-6">
              Have a Project in Mind?
            </h2>

            <p className="text-lg md:text-xl text-sbi-muted font-light mb-12 max-w-2xl mx-auto">
              We&apos;re always looking for new opportunities to apply
              sustainable building practices. Let&apos;s discuss how we can help
              bring your vision to life.
            </p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              viewport={{ once: true }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <MagneticButton href="/contact" variant="primary">
                Start a Conversation
              </MagneticButton>
              <MagneticButton href="/about" variant="secondary">
                Learn About Us
              </MagneticButton>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <AnimatePresence>
        {selectedProject && (
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
              className="relative max-w-5xl w-full max-h-[90vh] overflow-auto bg-sbi-dark-card border border-sbi-dark-border"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={handleCloseModal}
                className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center border border-sbi-dark-border hover:border-sbi-green/30 bg-sbi-dark transition-colors"
              >
                <span className="text-white text-xl">×</span>
              </button>

              <div className="aspect-[16/10] relative">
                <Image
                  src={currentGallery[selectedImageIndex]}
                  alt="Project image"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1280px) 100vw, 1280px"
                />
              </div>

              {currentGallery.length > 1 && (
                <div className="p-4 flex gap-2 overflow-x-auto">
                  {currentGallery.map((img, index) => (
                    <button
                      key={img.src}
                      type="button"
                      onClick={() => setSelectedImageIndex(index)}
                      className={`relative w-20 h-16 flex-shrink-0 overflow-hidden border-2 transition-colors ${
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

              <div className="p-6 border-t border-sbi-dark-border">
                <h3 className="text-2xl font-light text-white mb-2">
                  {projects.find((p) => p.slug === selectedProject)?.title}
                </h3>
                <p className="text-sbi-muted">
                  {
                    projects.find((p) => p.slug === selectedProject)
                      ?.description
                  }
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
