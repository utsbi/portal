"use client";

import { ArrowUpRight } from "lucide-react";
import { motion, useMotionTemplate, useMotionValue } from "motion/react";
import type { StaticImageData } from "next/image";
import Image from "next/image";
import { useRef, useState } from "react";

export interface Project {
  slug: string;
  title: string;
  description: string;
  status: "completed" | "in-progress" | "concept";
  tags: string[];
  coverImage: StaticImageData;
}

interface ProjectCardProps {
  project: Project;
  index: number;
  featured?: boolean;
  onClick?: () => void;
}

const statusLabels = {
  completed: "Completed",
  "in-progress": "In Progress",
  concept: "Concept",
};

const statusColors = {
  completed: "bg-sbi-green/20 text-sbi-green",
  "in-progress": "bg-amber-500/20 text-amber-400",
  concept: "bg-blue-500/20 text-blue-400",
};

export function ProjectCard({
  project,
  index,
  featured = false,
  onClick,
}: ProjectCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  };

  if (featured) {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 60 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{
          delay: index * 0.15,
          duration: 0.8,
          ease: [0.22, 1, 0.36, 1],
        }}
        viewport={{ once: true, margin: "-100px" }}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={onClick}
        className="group relative cursor-pointer"
      >
        <motion.div
          className="absolute -inset-px rounded-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{
            background: useMotionTemplate`
              radial-gradient(
                600px circle at ${mouseX}px ${mouseY}px,
                rgba(34, 197, 94, 0.08),
                transparent 70%
              )
            `,
          }}
        />

        <div className="relative bg-sbi-dark-card border border-sbi-dark-border hover:border-sbi-green/30 transition-colors duration-500 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="aspect-[4/3] lg:aspect-auto lg:h-full relative overflow-hidden">
              <Image
                src={project.coverImage}
                alt={project.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-700"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
              <div className="absolute inset-0 bg-linear-to-r from-transparent to-sbi-dark/80 hidden lg:block" />
              <div className="absolute inset-0 bg-linear-to-t from-sbi-dark via-transparent to-transparent lg:hidden" />
            </div>

            <div className="relative p-8 lg:p-12 flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-4">
                <span
                  className={`px-3 py-1 text-xs tracking-wider uppercase ${statusColors[project.status]}`}
                >
                  {statusLabels[project.status]}
                </span>
              </div>

              <h3 className="text-2xl md:text-3xl lg:text-4xl font-light text-white mb-4 tracking-tight">
                {project.title}
              </h3>

              <p className="text-sbi-muted leading-relaxed mb-6">
                {project.description}
              </p>

              <div className="flex flex-wrap gap-2 mb-8">
                {project.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 text-xs text-sbi-muted-dark border border-sbi-dark-border"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <motion.div
                className="inline-flex items-center gap-2 text-sbi-green text-sm tracking-wider uppercase"
                animate={{ x: isHovered ? 8 : 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <span>View Project</span>
                <ArrowUpRight className="w-4 h-4" />
              </motion.div>
            </div>
          </div>

          <motion.div
            className="absolute bottom-0 left-0 h-0.5 bg-sbi-green"
            initial={{ width: 0 }}
            whileInView={{ width: "100%" }}
            transition={{
              delay: 0.5,
              duration: 1,
              ease: [0.22, 1, 0.36, 1],
            }}
            viewport={{ once: true }}
          />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.15,
        duration: 0.8,
        ease: [0.22, 1, 0.36, 1],
      }}
      viewport={{ once: true, margin: "-50px" }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      className="group relative cursor-pointer"
    >
      <motion.div
        className="absolute -inset-px rounded-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: useMotionTemplate`
            radial-gradient(
              400px circle at ${mouseX}px ${mouseY}px,
              rgba(34, 197, 94, 0.08),
              transparent 70%
            )
          `,
        }}
      />

      <div className="relative h-full bg-sbi-dark-card border border-sbi-dark-border hover:border-sbi-green/30 transition-colors duration-500 overflow-hidden">
        <div className="aspect-[16/10] relative overflow-hidden">
          <Image
            src={project.coverImage}
            alt={project.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-700"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
          <div className="absolute inset-0 bg-linear-to-t from-sbi-dark via-sbi-dark/40 to-transparent" />

          <div className="absolute top-4 left-4">
            <span
              className={`px-3 py-1 text-xs tracking-wider uppercase ${statusColors[project.status]}`}
            >
              {statusLabels[project.status]}
            </span>
          </div>
        </div>

        <div className="p-6">
          <h3 className="text-xl font-light text-white mb-2 tracking-tight">
            {project.title}
          </h3>

          <p className="text-sm text-sbi-muted leading-relaxed mb-4 line-clamp-2">
            {project.description}
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
            {project.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 text-xs text-sbi-muted-dark border border-sbi-dark-border"
              >
                {tag}
              </span>
            ))}
          </div>

          <motion.div
            className="inline-flex items-center gap-2 text-sbi-green text-xs tracking-wider uppercase"
            animate={{ x: isHovered ? 4 : 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            <span>View Details</span>
            <ArrowUpRight className="w-3 h-3" />
          </motion.div>
        </div>

        <motion.div
          className="absolute bottom-0 left-0 h-0.5 bg-sbi-green"
          initial={{ width: 0 }}
          whileInView={{ width: "100%" }}
          transition={{
            delay: 0.3 + index * 0.1,
            duration: 0.8,
            ease: [0.22, 1, 0.36, 1],
          }}
          viewport={{ once: true }}
        />
      </div>
    </motion.div>
  );
}
