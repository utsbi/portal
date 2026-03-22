'use client';

import { getProjectById } from '../mockData';
import TaskCard from '../components/TaskCard';
import SearchBar from '../components/SearchBar';
import FilterDropdown from '../components/FilterDropdown';
import Link from 'next/link';
import { use, useState } from 'react';

export default function ProjectDetailPage({ 
  params 
}: { 
  params: Promise<{ projectId: string }> 
}) {
  const { projectId } = use(params);
  const project = getProjectById(projectId);
  const [searchQuery, setSearchQuery] = useState('');
  
  if (!project) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-white font-light tracking-wide">Project not found</div>
      </div>
    );
  }

  // Filter tasks based on search (searches both title and description)
  const filteredTasks = project.tasks.filter(task =>
    task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };
  
  return (
    <div className="container mx-auto p-6">
      {/* Back Button */}
      <Link 
        href="/client-test/dashboard/lifecycle" 
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

      {/* Task Status Pie Chart */}
      <div className="mb-8">
        <div className="bg-sbi-dark-card border border-sbi-dark-border/30 rounded-lg p-6 h-64">
          <p className="text-sm uppercase tracking-[0.15em] text-sbi-muted-dark mb-4 font-light">
            Task Status Overview
          </p>
          <div className="flex items-center justify-center h-full text-sbi-muted-dark font-light tracking-wide">
            Pie chart placeholder - PM will add graph component
          </div>
        </div>
      </div>
      
      {/* Search & Filter */}
      <div className="flex gap-4 mb-6">
        <SearchBar 
          placeholder="Search tasks..."
          onSearch={handleSearch}
        />
        <FilterDropdown 
          onFilterChange={(filters) => console.log('Filters:', filters)}
        />
      </div>
      
      {/* Task List */}
      <div className="bg-sbi-dark-card border border-sbi-dark-border/30 rounded-lg overflow-hidden scrollbar">
        {/* Task List Header */}
        <div className="flex items-center gap-4 p-4 border-b border-sbi-dark-border/30 text-xs uppercase tracking-[0.15em] text-sbi-muted-dark font-light">
          <div className="w-2"></div> {/* Priority dot space */}
          <div className="flex-1">Task</div>
          <div className="w-32 text-center">Status</div>
          <div className="w-32 text-center">Team</div>
          <div className="w-24 text-center">Due Date</div>
          <div className="w-6"></div> {/* Chevron space */}
        </div>
        
        {/* Task List Items */}
        {filteredTasks.length > 0 ? (
          <div>
            {filteredTasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <h3 className="text-lg font-light text-white mb-2">No Tasks Found</h3>
            <p className="text-sbi-muted-dark font-light tracking-wide">
              {searchQuery ? 'Try a different search term' : 'No tasks in this project'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}