//project detail page or task list
import { Project, Task } from '../types';
import TaskCard from '../components/TaskCard';
import SearchBar from '../components/SearchBar';
import FilterDropdown from '../components/FilterDropdown';
import Link from 'next/link';

export default function ProjectDetailPage({ 
  params 
}: { 
  params: { projectId: string } 
}) {
  //TODO: fetch project by ID using params.projectId
  const project: Project | null = null;
  //css is vibecode here again
  if (!project) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-white font-light tracking-wide">Project not found</div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-6">
      {/* Back Button */}
      <Link 
        href="/dashboard/lifecycle" 
        className="inline-flex items-center gap-2 text-sbi-green hover:text-sbi-green/80 
                   transition-colors mb-6 font-light tracking-wide"
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="h-5 w-5" 
          viewBox="0 0 20 20" 
          fill="currentColor"
        >
          <path 
            fillRule="evenodd" 
            d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" 
            clipRule="evenodd" 
          />
        </svg>
        Back to Projects
      </Link>
      
      {/* Project Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-light text-white mb-2 tracking-wide">{project.title}</h1>
        <p className="text-sbi-muted-dark font-light tracking-wide">
          {project.progress_percent}% Complete • {project.tasks.length} Tasks
        </p>
      </div>

      {/* Task Status Pie Chart - Blank section */}
      <div className="mb-8">
        <div className="bg-sbi-dark-card border border-sbi-dark-border/30 rounded-lg p-6 h-64">
          <p className="text-sm uppercase tracking-[0.15em] text-sbi-muted-dark mb-4 font-light">
            Task Status Overview
          </p>
          {/* TODO: Add pie chart showing completed/in progress/not started tasks */}
          <div className="flex items-center justify-center h-full text-sbi-muted-dark font-light tracking-wide">
            Pie chart placeholder - PM will add graph component
          </div>
        </div>
      </div>
      
      {/* Search & Filter */}
      <div className="flex gap-4 mb-6">
        <SearchBar 
          placeholder="Search tasks..."
          onSearch={(query) => console.log('Search:', query)}
        />
        <FilterDropdown 
          onFilterChange={(filters) => console.log('Filters:', filters)}
        />
      </div>
      
      {/* Task List */}
      <div className="bg-sbi-dark-card border border-sbi-dark-border/30 rounded-lg overflow-hidden">
        {/* Task List Header */}
        <div className="flex items-center gap-4 p-4 border-b border-sbi-dark-border/30 text-xs uppercase tracking-[0.15em] text-sbi-muted-dark font-light">
          <div className="w-2"></div> {/* Priority dot space */}
          <div className="flex-1">Task</div>
          <div className="w-32">Team</div>
          <div className="w-24 text-right">Due Date</div>
          <div className="w-6"></div> {/* Chevron space */}
        </div>
        
        {/* Task List Items */}
        {project.tasks.length > 0 ? (
          <div>
            {project.tasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        ) : (
          // Empty state
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-4xl mb-3">📋</div>
            <h3 className="text-lg font-light text-white mb-2">No Tasks Yet</h3>
            <p className="text-sbi-muted-dark font-light tracking-wide">
              Tasks will appear here when they're created.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}