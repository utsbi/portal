'use client';

import { Project } from './types';
import ProjectCard from './components/ProjectCard';
import { MOCK_PROJECTS } from './mockData';
import { useState } from 'react';

export default function LifecyclePage() {
  const [currentGraphIndex, setCurrentGraphIndex] = useState(0);
  const [currentProjectIndex, setCurrentProjectIndex] = useState(0);

  const graphs = [
    {
      title: 'Overall Progress',
      content: 'Graph 1 placeholder'
    },
    {
      title: 'Task Distribution',
      content: 'Graph 2 placeholder'
    },
    {
      title: 'Team Workload',
      content: 'Graph 3 placeholder'
    }
  ];

  const nextGraph = () => {
    setCurrentGraphIndex((prev) => (prev + 1) % graphs.length);
  };

  const prevGraph = () => {
    setCurrentGraphIndex((prev) => (prev - 1 + graphs.length) % graphs.length);
  };

  const nextProject = () => {
    setCurrentProjectIndex((prev) => (prev + 1) % MOCK_PROJECTS.length);
  };

  const prevProject = () => {
    setCurrentProjectIndex((prev) => (prev - 1 + MOCK_PROJECTS.length) % MOCK_PROJECTS.length);
  };

  return (
    <div className="container mx-auto p-6">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-light text-white mb-2 tracking-wide">Your Projects</h1>
        <p className="text-sbi-muted-dark font-light tracking-wide">
          View and manage all your active projects
        </p>
      </div>

      {/* Main Content - Side by Side Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Side - Graphs Carousel */}
        <div className="flex flex-col">
          <h2 className="text-xl font-light text-white mb-4 tracking-wide">Project Metrics</h2>
          
          {/* Graph Carousel - Fixed Height */}
          <div className="relative flex items-center h-80">
            {/* Previous Button */}
            <button
              onClick={prevGraph}
              className="absolute left-0 z-10 p-2 bg-sbi-dark-card/80 border border-sbi-dark-border/30 
                         rounded-full text-sbi-green hover:bg-sbi-dark-card hover:border-sbi-green/50 
                         transition-all"
              aria-label="Previous graph"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-6 w-6" 
                viewBox="0 0 20 20" 
                fill="currentColor"
              >
                <path 
                  fillRule="evenodd" 
                  d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" 
                  clipRule="evenodd" 
                />
              </svg>
            </button>

            {/* Graph Card */}
            <div className="flex-1 px-12 h-full">
              <div className="bg-sbi-dark-card border border-sbi-dark-border/30 rounded-lg p-6 h-full flex flex-col">
                <p className="text-sm uppercase tracking-[0.15em] text-sbi-muted-dark mb-4 font-light">
                  {graphs[currentGraphIndex].title}
                </p>
                <div className="flex items-center justify-center flex-1 text-sbi-muted-dark font-light tracking-wide">
                  {graphs[currentGraphIndex].content}
                </div>
              </div>
            </div>

            {/* Next Button */}
            <button
              onClick={nextGraph}
              className="absolute right-0 z-10 p-2 bg-sbi-dark-card/80 border border-sbi-dark-border/30 
                         rounded-full text-sbi-green hover:bg-sbi-dark-card hover:border-sbi-green/50 
                         transition-all"
              aria-label="Next graph"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-6 w-6" 
                viewBox="0 0 20 20" 
                fill="currentColor"
              >
                <path 
                  fillRule="evenodd" 
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" 
                  clipRule="evenodd" 
                />
              </svg>
            </button>
          </div>

          {/* Graph Indicators */}
          <div className="flex justify-center gap-2 mt-4">
            {graphs.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentGraphIndex(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentGraphIndex 
                    ? 'bg-sbi-green w-6' 
                    : 'bg-sbi-dark-border/50 hover:bg-sbi-dark-border'
                }`}
                aria-label={`Go to graph ${index + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Right Side - Projects Carousel */}
        <div className="flex flex-col">
          <h2 className="text-xl font-light text-white mb-4 tracking-wide">Your Projects</h2>
          
          {/* Project Carousel - Fixed Height matching graphs */}
          <div className="relative flex items-center h-80">
            {/* Previous Button */}
            <button
              onClick={prevProject}
              className="absolute left-0 z-10 p-2 bg-sbi-dark-card/80 border border-sbi-dark-border/30 
                         rounded-full text-sbi-green hover:bg-sbi-dark-card hover:border-sbi-green/50 
                         transition-all"
              aria-label="Previous project"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-6 w-6" 
                viewBox="0 0 20 20" 
                fill="currentColor"
              >
                <path 
                  fillRule="evenodd" 
                  d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" 
                  clipRule="evenodd" 
                />
              </svg>
            </button>

            {/* Project Card */}
            <div className="flex-1 px-12 h-full flex items-center">
              <div className="w-full">
                <ProjectCard project={MOCK_PROJECTS[currentProjectIndex]} />
              </div>
            </div>

            {/* Next Button */}
            <button
              onClick={nextProject}
              className="absolute right-0 z-10 p-2 bg-sbi-dark-card/80 border border-sbi-dark-border/30 
                         rounded-full text-sbi-green hover:bg-sbi-dark-card hover:border-sbi-green/50 
                         transition-all"
              aria-label="Next project"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-6 w-6" 
                viewBox="0 0 20 20" 
                fill="currentColor"
              >
                <path 
                  fillRule="evenodd" 
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" 
                  clipRule="evenodd" 
                />
              </svg>
            </button>
          </div>

          {/* Project Indicators */}
          <div className="flex justify-center gap-2 mt-4">
            {MOCK_PROJECTS.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentProjectIndex(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentProjectIndex 
                    ? 'bg-sbi-green w-6' 
                    : 'bg-sbi-dark-border/50 hover:bg-sbi-dark-border'
                }`}
                aria-label={`Go to project ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}