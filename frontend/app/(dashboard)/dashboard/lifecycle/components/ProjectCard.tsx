
'use client';

import { Project } from '../types';
import Link from 'next/link';
import Image from 'next/image';

type ProjectCardProps = {
  project: Project;
};

export default function ProjectCard({ project }: ProjectCardProps) {
  // Circle progress calculation
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (project.progress_percent / 100) * circumference;

  return (
    <Link href={`/dashboard/lifecycle/${project.id}`}>
      <div className="group relative border border-sbi-dark-border/30 rounded-lg overflow-hidden 
                      bg-sbi-dark-card hover:border-sbi-green/40 
                      transition-all duration-300 cursor-pointer
                      hover:shadow-lg hover:shadow-sbi-green/5">
        
        {/* Project Image with Progress Circle Overlay */}
        <div className="relative h-48 bg-sbi-dark-border/10 overflow-hidden">
          {project.image ? (
            <Image
              src={project.image}
              alt={project.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
            />
          ) : (
            // Fallback folder icon
            <div className="flex items-center justify-center h-full">
              <div className="text-7xl opacity-20">📁</div>
            </div>
          )}
          
          {/* Progress Circle - Top Right */}
          <div className="absolute top-4 right-4 flex items-center justify-center">
            <svg className="w-28 h-28 transform -rotate-90">
              {/* Background circle */}
              <circle
                cx="56"
                cy="56"
                r={radius}
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-sbi-dark-border/40"
              />
              {/* Progress circle */}
              <circle
                cx="56"
                cy="56"
                r={radius}
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                className="text-sbi-green transition-all duration-500"
                strokeLinecap="round"
              />
            </svg>
            {/* Percentage text */}
            <div className="absolute text-white font-light text-lg">
              {project.progress_percent}%
            </div>
          </div>

          {/* Status indicator - Bottom Left */}
          <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full">
            <div className={`w-2 h-2 rounded-full ${project.completed ? 'bg-sbi-green' : 'bg-yellow-500'}`} />
            <span className="text-[10px] tracking-[0.15em] uppercase text-white/90 font-light">
              {project.completed ? 'Complete' : 'In Progress'}
            </span>
          </div>
        </div>

        {/* Card Content */}
        <div className="p-5">
          {/* Project Title */}
          <h3 className="text-xl font-light text-white mb-2 group-hover:text-sbi-green transition-colors tracking-wide">
            {project.title}
          </h3>
          
          {/* Task Count */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-sbi-muted-dark font-light tracking-wide">
              {project.tasks.length} {project.tasks.length === 1 ? 'Task' : 'Tasks'}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}