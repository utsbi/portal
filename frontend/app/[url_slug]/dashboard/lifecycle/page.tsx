'use client';

import { Project } from './types';
import { sortProjects } from './utils';
import ProjectCard from './components/ProjectCard';
import SearchBar from './components/SearchBar';
import { MOCK_PROJECTS } from './mockData';
import { useState } from 'react';

export default function LifecyclePage() {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filter projects based on search
  const filteredProjects = MOCK_PROJECTS.filter(project =>
    project.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    console.log('Search query:', query);
  };

  return (
    <div className="container mx-auto p-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-light text-white mb-2 tracking-wide">Your Projects</h1>
        <p className="text-sbi-muted-dark font-light tracking-wide">
          View and manage all your active projects
        </p>
      </div>

      {/* Main Content - Side by Side Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Left Side - Graphs */}
        <div>
          <h2 className="text-xl font-light text-white mb-4 tracking-wide">Project Metrics</h2>
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
            <div className="bg-sbi-dark-card border border-sbi-dark-border/30 rounded-lg p-6 h-64">
              <p className="text-sm uppercase tracking-[0.15em] text-sbi-muted-dark mb-4 font-light">
                Overall Progress
              </p>
              <div className="flex items-center justify-center h-full text-sbi-muted-dark font-light tracking-wide">
                Graph 1 placeholder
              </div>
            </div>
            
            <div className="bg-sbi-dark-card border border-sbi-dark-border/30 rounded-lg p-6 h-64">
              <p className="text-sm uppercase tracking-[0.15em] text-sbi-muted-dark mb-4 font-light">
                Task Distribution
              </p>
              <div className="flex items-center justify-center h-full text-sbi-muted-dark font-light tracking-wide">
                Graph 2 placeholder
              </div>
            </div>
            
            <div className="bg-sbi-dark-card border border-sbi-dark-border/30 rounded-lg p-6 h-64">
              <p className="text-sm uppercase tracking-[0.15em] text-sbi-muted-dark mb-4 font-light">
                Team Workload
              </p>
              <div className="flex items-center justify-center h-full text-sbi-muted-dark font-light tracking-wide">
                Graph 3 placeholder
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Projects */}
        <div>
          {/* Search Bar */}
          <div className="mb-6">
            <SearchBar 
              placeholder="Search projects by name..."
              onSearch={handleSearch}
            />
          </div>

          {/* Projects List - Scrollable */}
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
            {filteredProjects.length > 0 ? (
              filteredProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="text-6xl mb-4">📁</div>
                <h3 className="text-xl font-semibold text-white mb-2">No Projects Found</h3>
                <p className="text-sbi-muted-dark font-light tracking-wide">
                  {searchQuery ? 'Try a different search term' : 'Projects will appear here once assigned'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}