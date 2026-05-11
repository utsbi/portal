'use client';

import { Task, type TaskPriorityDB, TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, TEAM_NAME_LABELS } from '../types';
import { useState } from 'react';

type TaskPopUpProps = {
  task: Task;
  onClose: () => void;
};

const PRIORITY_BADGE_COLOR: Record<string, string> = {
  extreme: 'bg-red-600 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-white',
  low: 'bg-blue-400 text-white',
  stretch: 'bg-gray-400 text-white',
};

const STATUS_COLOR: Record<string, string> = {
  not_started: 'text-gray-300',
  in_progress: 'text-blue-300',
  pending_approval: 'text-yellow-300',
  completed: 'text-sbi-green',
};

const ALL_PRIORITIES: TaskPriorityDB[] = ['extreme', 'high', 'medium', 'low', 'stretch'];

export default function TaskPopUp({ task, onClose }: TaskPopUpProps) {
  const [priority, setPriority] = useState<TaskPriorityDB>(task.priority);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-sbi-dark-card border border-sbi-dark-border/30 rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-sbi-dark-card border-b border-sbi-dark-border/30 p-6 flex justify-between items-start">
          <div className="flex-1">
            <h2 className="text-2xl font-light text-white tracking-wide mb-2">{task.title}</h2>
            <div className="flex items-center gap-3">
              <span className={`text-sm font-light tracking-wide ${STATUS_COLOR[task.status] ?? 'text-gray-300'}`}>
                {TASK_STATUS_LABELS[task.status]}
              </span>
              <span className="text-sbi-muted-dark">•</span>
              <span className="text-sm text-sbi-muted-dark font-light tracking-wide">
                {TEAM_NAME_LABELS[task.team]}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-sbi-muted-dark hover:text-white transition-colors text-2xl leading-none">
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Due Date */}
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-sbi-muted-dark mb-2 font-light">Due Date</p>
              <p className="text-white font-light tracking-wide">
                {task.due_date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
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
                onChange={(e) => setPriority(e.target.value as TaskPriorityDB)}
                className="w-full px-3 py-2 rounded text-sm font-light tracking-wide border border-sbi-green/50
                 bg-sbi-dark-card text-white focus:outline-none focus:ring-1 focus:ring-sbi-green"
              >
                {ALL_PRIORITIES.map((p) => (
                  <option key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-sbi-muted-dark mb-3 font-light">Description</p>
            <p className="text-white/80 leading-relaxed font-light tracking-wide">{task.description}</p>
          </div>

          {/* Assigned Info */}
          <div className="grid grid-cols-2 gap-6 pt-4 border-t border-sbi-dark-border/30">
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-sbi-muted-dark mb-2 font-light">Assigned By</p>
              <p className="text-white font-light tracking-wide">{task.assigned_by || '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-sbi-muted-dark mb-2 font-light">Assignees</p>
              <div className="space-y-1">
                {task.assignees.length > 0 ? task.assignees.map((assignee, i) => (
                  <p key={i} className="text-white font-light tracking-wide">{assignee}</p>
                )) : <p className="text-sbi-muted-dark font-light">Unassigned</p>}
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="pt-4 border-t border-sbi-dark-border/30 flex items-center gap-6 text-xs text-sbi-muted-dark font-light tracking-wide">
            <span>Created: {task.created_at.toLocaleDateString()}</span>
            <span>•</span>
            <span>Last Updated: {task.updated_at.toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
