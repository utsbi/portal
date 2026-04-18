'use client';

import { useState } from 'react';
import { TaskStatus, Priority, TeamName } from '../types';

type FilterOptions = {
  status: TaskStatus[];
  priority: Priority[];
  team: TeamName[];
  includeTentative: boolean;
};

type FilterDropdownProps = {
  onFilterChange: (filters: FilterOptions) => void;
};

export default function FilterDropdown({ onFilterChange }: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    status: [],
    priority: [],
    team: [],
    includeTentative: true,
  });

  const handleCheckbox = (category: keyof Omit<FilterOptions, 'includeTentative'>, value: string) => {
    const updated = { ...filters };
    const currentArray = updated[category] as string[];
    
    if (currentArray.includes(value)) {
      updated[category] = currentArray.filter(item => item !== value) as any;
    } else {
      updated[category] = [...currentArray, value] as any;
    }
    
    setFilters(updated);
    onFilterChange(updated);
  };

  const handleTentativeToggle = () => {
    const updated = { ...filters, includeTentative: !filters.includeTentative };
    setFilters(updated);
    onFilterChange(updated);
  };

  const clearFilters = () => {
    const cleared: FilterOptions = {
      status: [],
      priority: [],
      team: [],
      includeTentative: true,
    };
    setFilters(cleared);
    onFilterChange(cleared);
  };

  const activeFilterCount = filters.status.length + filters.priority.length + filters.team.length;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-3 bg-sbi-dark-card border border-sbi-dark-border/30 rounded-lg 
                   text-white font-light tracking-wide hover:border-sbi-green/50 
                   transition-all flex items-center gap-2"
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="h-5 w-5" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" 
          />
        </svg>
        Filter
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown - Wide horizontal layout, opens to LEFT */}
          <div className="absolute left-0 mt-2 w-[720px] bg-sbi-dark-card border border-sbi-dark-border/30 
                          rounded-lg shadow-xl z-50 overflow-hidden">
            {/* ↑ Changed from right-0 to left-0 */}
            
            {/* Header - Fixed */}
            <div className="flex items-center justify-between p-4 border-b border-sbi-dark-border/30 bg-sbi-dark-card">
              <h3 className="text-sm uppercase tracking-[0.15em] text-white font-light">Filters</h3>
              {activeFilterCount > 0 && (
                <button 
                  onClick={clearFilters}
                  className="text-xs text-sbi-green hover:text-sbi-green/80 transition-colors font-light tracking-wide"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Scrollable content */}
            <div className="max-h-[400px] overflow-y-auto scrollbar">
              {/* Table grid - 3 columns */}
              <div className="grid grid-cols-3 gap-6 p-6">
                
                {/* Status Column */}
                <div>
                  <p className="text-xs uppercase tracking-[0.15em] text-sbi-muted-dark mb-3 font-light">
                    Status
                  </p>
                  <div className="space-y-2">
                    {Object.values(TaskStatus).map((status) => (
                      <label key={status} className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={filters.status.includes(status)}
                          onChange={() => handleCheckbox('status', status)}
                          className="w-4 h-4 rounded border-sbi-dark-border/30 text-sbi-green 
                                     focus:ring-sbi-green/50 focus:ring-offset-0 bg-sbi-dark cursor-pointer"
                        />
                        <span className="text-sm text-white/80 group-hover:text-white font-light tracking-wide">
                          {status}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Priority Column */}
                <div>
                  <p className="text-xs uppercase tracking-[0.15em] text-sbi-muted-dark mb-3 font-light">
                    Priority
                  </p>
                  <div className="space-y-2">
                    {Object.values(Priority).map((priority) => (
                      <label key={priority} className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={filters.priority.includes(priority)}
                          onChange={() => handleCheckbox('priority', priority)}
                          className="w-4 h-4 rounded border-sbi-dark-border/30 text-sbi-green 
                                     focus:ring-sbi-green/50 focus:ring-offset-0 bg-sbi-dark cursor-pointer"
                        />
                        <span className="text-sm text-white/80 group-hover:text-white font-light tracking-wide">
                          {priority}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Team Column */}
                <div>
                  <p className="text-xs uppercase tracking-[0.15em] text-sbi-muted-dark mb-3 font-light">
                    Team
                  </p>
                  <div className="space-y-2">
                    {Object.values(TeamName).map((team) => (
                      <label key={team} className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={filters.team.includes(team)}
                          onChange={() => handleCheckbox('team', team)}
                          className="w-4 h-4 rounded border-sbi-dark-border/30 text-sbi-green 
                                     focus:ring-sbi-green/50 focus:ring-offset-0 bg-sbi-dark cursor-pointer"
                        />
                        <span className="text-sm text-white/80 group-hover:text-white font-light tracking-wide">
                          {team.replace(' Team', '')}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tentative Toggle - Full width at bottom */}
              <div className="px-6 pb-6 pt-2 border-t border-sbi-dark-border/30 bg-sbi-dark-card">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filters.includeTentative}
                    onChange={handleTentativeToggle}
                    className="w-4 h-4 rounded border-sbi-dark-border/30 text-sbi-green 
                               focus:ring-sbi-green/50 focus:ring-offset-0 bg-sbi-dark cursor-pointer"
                  />
                  <span className="text-sm text-white/80 group-hover:text-white font-light tracking-wide">
                    Include Tentative Dates
                  </span>
                </label>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}