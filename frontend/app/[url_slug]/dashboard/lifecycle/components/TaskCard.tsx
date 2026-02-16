
'use client';

import { Task } from '../types';
import { useState } from 'react';
import TaskPopUp from './TaskPopUp';

type TaskCardProps = {
  task: Task;
};

export default function TaskCard({ task }: TaskCardProps) {
  const [isPopUpOpen, setIsPopUpOpen] = useState(false);

  // Priority dot color
  const getPriorityDotColor = () => {
    switch (task.priority) {
      case 'Extremely High Priority':
        return 'bg-red-500';
      case 'High Priority':
        return 'bg-orange-500';
      case 'Medium Priority':
        return 'bg-yellow-500';
      case 'Low Priority':
        return 'bg-blue-400';
      case 'Stretch Feature':
        return 'bg-gray-400';
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <>
      <div 
        onClick={() => setIsPopUpOpen(true)}
        className="group flex items-center gap-4 p-4 border-b border-sbi-dark-border/30 
                   hover:bg-sbi-dark-card/50 cursor-pointer transition-all"
      >
        {/* Priority Dot */}
        <div className={`w-2 h-2 rounded-full ${getPriorityDotColor()}`} />

        {/* Task Title */}
        <div className="flex-1">
          <h4 className="text-white font-light tracking-wide group-hover:text-sbi-green transition-colors">
            {task.title}
          </h4>
        </div>

        {/* Team Badge */}
        <div className="text-xs text-sbi-muted-dark font-light tracking-wide px-3 py-1 
                        bg-sbi-dark-border/20 rounded-full">
          {task.team.split(' ')[0]} {/* Just show first word like "Technology" */}
        </div>

        {/* Due Date */}
        <div className="text-sm text-sbi-muted-dark font-light tracking-wide min-w-[100px] text-right">
          {task.tentative && <span className="text-yellow-500 mr-1">~</span>}
          {task.due_date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </div>

        {/* Chevron */}
        <div className="text-sbi-muted-dark group-hover:text-sbi-green transition-colors">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-5 w-5" 
            viewBox="0 0 20 20" 
            fill="currentColor"
          >
            <path 
              fillRule="evenodd" 
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" 
              clipRule="evenodd" 
            />
          </svg>
        </div>
      </div>

      {isPopUpOpen && (
        <TaskPopUp 
          task={task} 
          onClose={() => setIsPopUpOpen(false)}
        />
      )}
    </>
  );
}