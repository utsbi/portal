"use client";

import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BlueprintGrid } from "@/components/blueprint-grid";
import { MagneticButton } from "@/components/magnetic-button";
import { ProjectDetails } from "@/components/projects/ProjectDetails";
import {
  formatProjectNumber,
  ProjectIndex,
} from "@/components/projects/ProjectIndex";
import { ProjectStage } from "@/components/projects/ProjectStage";
import { ProjectSwitcherBar } from "@/components/projects/ProjectSwitcherBar";
import { type Project, projects } from "@/lib/data/projects";

// Clearance kept above the project when scrolling it into view; matches the
// `scroll-mt-28` on the showcase so the fixed navbar never covers the title.
const NAVBAR_CLEARANCE_PX = 112;
const INDEX_PEEK_PX = 160;

export default function ProjectsPage() {
  const [activeSlug, setActiveSlug] = useState(projects[0].slug);
  const [indexInView, setIndexInView] = useState(true);
  const [showcaseInView, setShowcaseInView] = useState(false);
  const indexRef = useRef<HTMLElement>(null);
  const showcaseRef = useRef<HTMLDivElement>(null);

  const total = projects.length;
  const activeIndex = Math.max(
    0,
    projects.findIndex((project) => project.slug === activeSlug),
  );
  const activeProject = projects[activeIndex];

  // Open the project named in a shared link (/projects?project=<slug>).
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("project");
    if (slug && projects.some((project) => project.slug === slug)) {
      setActiveSlug(slug);
    }
  }, []);

  // The floating switcher shows only while the visitor is inside a project
  // and the full index is off screen.
  useEffect(() => {
    const index = indexRef.current;
    const showcase = showcaseRef.current;
    if (!index || !showcase) return;

    // Shrink the index's viewport from the top so a sliver of it peeking out
    // under the navbar does not count as "in view".
    const indexObserver = new IntersectionObserver(
      ([entry]) => setIndexInView(entry.isIntersecting),
      { rootMargin: `-${INDEX_PEEK_PX}px 0px 0px 0px` },
    );
    const showcaseObserver = new IntersectionObserver(([entry]) =>
      setShowcaseInView(entry.isIntersecting),
    );
    indexObserver.observe(index);
    showcaseObserver.observe(showcase);
    return () => {
      indexObserver.disconnect();
      showcaseObserver.disconnect();
    };
  }, []);

  const handleSelect = useCallback((project: Project) => {
    setActiveSlug(project.slug);

    const url = new URL(window.location.href);
    url.searchParams.set("project", project.slug);
    window.history.replaceState(window.history.state, "", url);

    // Bring the project into view when it is off screen — below the index on
    // phones, or scrolled past on any device.
    const showcase = showcaseRef.current;
    if (!showcase) return;
    const top = showcase.getBoundingClientRect().top;
    if (top < NAVBAR_CLEARANCE_PX || top > window.innerHeight * 0.5) {
      showcase.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  return (
    <div className="bg-sbi-dark text-white">
      <header className="relative overflow-hidden border-b border-sbi-dark-border">
        <BlueprintGrid />
        <div className="absolute inset-0 bg-linear-to-b from-sbi-dark/50 via-transparent to-sbi-dark" />
        <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-6 px-6 pb-8 pt-28 md:flex-row md:items-end md:justify-between md:px-16 md:pb-12 md:pt-36">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.1,
                duration: 0.8,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="mb-5 flex items-center gap-4"
            >
              <div className="h-px w-16 bg-sbi-green" />
              <span className="text-xs uppercase tracking-[0.3em] text-sbi-green">
                Our Work
              </span>
            </motion.div>
            <div className="overflow-hidden pb-2">
              <motion.h1
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={{
                  delay: 0.2,
                  duration: 1,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="text-5xl font-extralight leading-[1.1] tracking-tighter sm:text-6xl md:text-7xl"
              >
                Projects
              </motion.h1>
            </div>
          </div>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-md text-base font-light leading-relaxed text-sbi-muted md:text-right md:text-lg"
          >
            Sustainable building solutions designed by our interdisciplinary
            student team. Pick a project to explore its 3D model, renders, and
            video.
          </motion.p>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-8 md:px-16 md:py-12 lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside
          ref={indexRef}
          className="custom-scrollbar mb-10 lg:sticky lg:top-28 lg:mb-0 lg:max-h-[calc(100dvh-8rem)] lg:self-start lg:overflow-y-auto"
        >
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-xs uppercase tracking-[0.3em] text-sbi-muted">
              All Projects
            </h2>
            <span className="font-mono text-xs tracking-widest text-sbi-muted">
              {formatProjectNumber(total - 1)}
            </span>
          </div>
          <ProjectIndex
            projects={projects}
            activeSlug={activeProject.slug}
            onSelect={handleSelect}
          />
        </aside>

        <div ref={showcaseRef} className="min-w-0 scroll-mt-28">
          <ProjectStage
            project={activeProject}
            index={activeIndex}
            total={total}
          />
          <ProjectDetails
            project={activeProject}
            previous={projects[(activeIndex - 1 + total) % total]}
            next={projects[(activeIndex + 1) % total]}
            onSelect={handleSelect}
          />
        </div>
      </section>

      <ProjectSwitcherBar
        projects={projects}
        activeIndex={activeIndex}
        visible={!indexInView && showcaseInView}
        onSelect={handleSelect}
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
