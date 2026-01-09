
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
            <div className="flex items-c