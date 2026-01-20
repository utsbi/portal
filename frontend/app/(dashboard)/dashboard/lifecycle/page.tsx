// frontend/app/(dashboard)/dashboard/lifecycle/page.tsx

import { Project } from './types';
import { sortProjects } from './utils';
import ProjectCard from './components/ProjectCard';
import SearchBar from './components/SearchBar';

export default function LifecyclePage() {
  //TODO: fetch projects filtered by client ID with mock data (becaues team portal not integrated yet)
  const projects: Project[] = [];
  
  const handleSearch = (query: string) => {
    //TODO: filter projects by search query
    console.log('Search query:', query);
  };

  return (
    //css here is vibe coded
    <div className="container mx-auto p-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-light text-white mb-2 tracking-wide">Your Projects</h1>
        <p className="text-sbi-muted-dark font-light tracking-wide">
          View and manage all your active projects
        </p>
      </div>

      {/* Project Metrics Section - Blank for now */}
      <div className="mb-10">
        <h2 className="text-xl font-light text-white mb-4 tracking-wide">Project Metrics</h2>
        
        {/* Blank section for graphs - PM will add graph components here */}
        <div className="bg-sbi-dark-card border border-sbi-dark-border/30 rounded-lg p-8 min-h-[300px]">
          <div className="flex items-center justify-center h-full text-sbi-muted-dark font-light tracking-wide">
            Graph section - to be added by PM
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <SearchBar 
          placeholder="Search projects by name..."
          onSearch={handleSearch}
        />
      </div>

      {/* Projects Grid */}
      {projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        // Empty State
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="text-6xl mb-4">📁</div>
          <h3 className="text-xl font-semibold text-white mb-2">No Projects Yet</h3>
          <p className="text-sbi-muted-dark font-light tracking-wide">
            Projects will appear here once they're assigned to you.
          </p>
        </div>
      )}
    </div>
  );
}