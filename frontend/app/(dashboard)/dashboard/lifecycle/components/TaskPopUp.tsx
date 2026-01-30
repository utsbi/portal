'use client';

import { Task, Priority } from '../types';
import { useState } from 'react';

type TaskPopUpProps = {
  task: Task;
  onClose: () => void;
};

export default function TaskPopUp({ task, onClose }: TaskPopUpProps) {
  const [priority, setPriority] = useState<Priority>(task.priority);

  const handlePriorityChange = (newPriority: Priority) => {
    setPriority(newPriority);
    // TODO: Update priority in backend/state
    console.log('Priority changed to:', newPriority);
  };

  // Priority badge color
  const getPriorityBadgeColor = (p: Priority) => {
    switch (p) {
      case 'Extremely High Priority':
        return 'bg-red-600 text-white';
      case 'High Priority':
        return 'bg-orange-500 text-white';
      case 'Medium Priority':
        return 'bg-yellow-500 text-white';
      case 'Low Priority':
        return 'bg-blue-400 text-white';
      case 'Stretch Feature':
        return 'bg-gray-400 text-white';
      default:
        return 'bg-gray-400 text-white';
    }
  };

  // Status color
  const getStatusColor = () => {
    switch (task.status) {
      case 'Not Started':
        return 'text-gray-300';
      case 'In Progress':
        return 'text-blue-300';
      case 'Pending Approval':
        return 'text-yellow-300';
      case 'Completed':
        return 'text-sbi-green';
      default:
        return 'text-gray-300';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-sbi-dark-card border border-sbi-dark-border/30 rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-sbi-dark-card border-b border-sbi-dark-border/30 p-6 flex justify-between items-start">
          <div className="flex-1">
            <h2 className="text-2xl font-light text-white tracking-wide mb-2">{task.title}</h2>
            <div className="flex items-center gap-3">
              <span className={`text-sm font-light tracking-wide ${getStatusColor()}`}>
                {task.status}
              </span>
              <span className="text-sbi-muted-dark">•</span>
              <span className="text-sm text-sbi-muted-dark font-light tracking-wide">
                {task.team}
              </span>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-sbi-muted-dark hover:text-white transition-colors text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Quick Info Grid */}
          <div className="grid grid-cols-2 gap-6">
            {/* Due Date */}
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-sbi-muted-dark mb-2 font-light">Due Date</p>
              <p className="text-white font-light tracking-wide">
                {task.due_date.toLocaleDateString('en-US', { 
                  month: 'long', 
                  day: 'numeric', 
                  year: 'numeric' 
                })}
                {task.tentative && <span className="text-yellow-500 ml-2">(Tentative)</span>}
              </p>
            </div>

            {/* Priority - Editable */}
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-sbi-muted-dark mb-2 font-light">
                Priority <span className="text-sbi-green text-[10px]">(Editable)</span>
              </p>
              <select
                value={priority}
                onChange={(e) => handlePriorityChange(e.target.value as Priority)}
                className={`w-full px-3 py-1.5 rounded text-sm font-light tracking-wide border-none 
                           focus:outline-none focus:ring-1 focus:ring-sbi-green/50 ${getPriorityBadgeColor(priority)}`}
              >
                <option value="Extremely High Priority">Extremely High Priority</option>
                <option value="High Priority">High Priority</option>
                <option value="Medium Priority">Medium Priority</option>
                <option value="Low Priority">Low Priority</option>
                <option value="Stretch Feature">Stretch Feature</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-sbi-muted-dark mb-3 font-light">Description</p>
            <p className="text-white/80 leading-relaxed font-light tracking-wide">
              {task.description}
            </p>
          </div>

          {/* Assigned Info */}
          <div className="grid grid-cols-2 gap-6 pt-4 border-t border-sbi-dark-border/30">
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-sbi-muted-dark mb-2 font-light">Assigned By</p>
              <p className="text-white font-light tracking-wide">{task.assigned_by}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-sbi-muted-dark mb-2 font-light">Assignees</p>
              <div className="space-y-1">
                {task.assignees.map((assignee, i) => (
                  <p key={i} className="text-white font-light tracking-wide">{assignee}</p>
                ))}
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="pt-4 border-t border-sbi-dark-border/30 flex items-center gap-6 text-xs text-sbi-muted-dark font-light tracking-wide">
            <span>Created: {task.created_at.toLocaleDateString()}</span>
            <span>•</span>
            <span>Last Updated: {task.last_updated.toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}