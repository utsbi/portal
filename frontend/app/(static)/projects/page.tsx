"use client";

import { Minus, Plus } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useRef, useState } from "react";
import { BlueprintGrid } from "@/components/blueprint-grid";
import { MagneticButton } from "@/components/magnetic-button";
import { CameraControlsUI } from "@/components/projects/CameraControlsUI";
import type { Project3DViewerRef } from "@/components/projects/Project3DViewer";
import { ProjectDetails } from "@/components/projects/ProjectDetails";
import { ProjectHero } from "@/components/projects/ProjectHero";
import { ProjectInfoOverlay } from "@/components/projects/ProjectInfoOverlay";
import { ProjectSelector } from "@/components/projects/ProjectSelector";
import { type Project, projects } from "@/lib/data/projects";

export default function ProjectsPage() {
  const [activeProject, setActiveProject] = useState<Project>(projects[0]);
  const [activeCameraIndex, setActiveCameraIndex] = useState(-1);
  const viewerRef = useRef<Project3DViewerRef>(null);

  const handleProjectChange = useCallback((project: Project) => {
    setActiveProject(project);
    setActiveCameraIndex(-1);
  }, []);

  const handleCameraSelect = useCallback((index: number) => {
    setActiveCameraIndex(index);
    viewerRef.current?.setCamera(index);
  }, []);

  const handleCameraReset = useCallback(() => {
    setActiveCameraIndex(-1);
    viewerRef.current?.resetCamera();
  }, []);

  return (
    <div className="bg-sbi-dark text-white">
      <ProjectHero project={activeProject} viewerRef={viewerRef}>
        <ProjectSelector
          projects={projects}
          activeProject={activeProject}
          onProjectChange={handleProjectChange}
        />

        <ProjectInfoOverlay project={activeProject} />

        <CameraControlsUI
          presets={activeProject.cameraPresets}
          activeIndex={activeCameraIndex}
          onPresetSelect={handleCameraSelect}
          onReset={handleCameraReset}
        />

        <div className="absolute bottom-6 right-6 z-20">
          <div className="flex flex-col gap-1 bg-sbi-dark/60 backdrop-blur-md rounded-lg border border-sbi-dark-border p-1">
            <button
              type="button"
              onClick={() => viewerRef.current?.zoomIn()}
              className="p-2 hover:bg-white/10 rounded transition-colors text-white/80 hover:text-white"
              aria-label="Zoom in"
            >
              <Plus size={16} />
            </button>
            <button
              type="button"
              onClick={() => viewerRef.current?.zoomOut()}
              className="p-2 hover:bg-white/10 rounded transition-colors text-white/80 hover:text-white"
              aria-label="Zoom out"
            >
              <Minus size={16} />
            </button>
          </div>
        </div>
      </ProjectHero>

      <div id="project-details" />
      <ProjectDetails
        project={activeProject}
        projects={projects}
        onProjectChange={handleProjectChange}
      />

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
    </div>
  );
}
