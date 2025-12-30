
import { Task, Project, TaskStatus, Priority, TeamName, TASK_STATUS_ORDER, PRIORITY_ORDER } from './types';

//sorting/filtering options with given weights and following functions, except date is auto
export type SortOption = 
    | 'dueDate-asc' 
    | 'dueDate-desc' 
    | 'status-asc' 
    | 'status-desc'
    | 'priority-asc'
    | 'priority-desc';


export function sortTasks(tasks: Task[], sortOption: SortOption): Task[] {
    const sorted = [...tasks];
    switch (sortOption) {
        case 'dueDate-asc':
            return sorted.sort((a, b) => a.due_date.getTime() - b.due_date.getTime());
        
        case 'dueDate-desc':
            return sorted.sort((a, b) => b.due_date.getTime() - a.due_date.getTime());
        
        case 'status-asc':
            return sorted.sort((a, b) => TASK_STATUS_ORDER[a.status] - TASK_STATUS_ORDER[b.status]);
        
        case 'status-desc':
            return sorted.sort((a, b) => TASK_STATUS_ORDER[b.status] - TASK_STATUS_ORDER[a.status]);
        
        case 'priority-asc':
            return sorted.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
        
        case 'priority-desc':
            return sorted.sort((a, b) => PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority]);
        
        default:
            return sorted;
    }
}

//only way to sort projects rn is by progress
export function sortProjects(projects: Project[], order: 'asc' | 'desc' = 'asc'): Project[] {
    const sorted = [...projects];
    
    sorted.sort((a, b) => a.progress_percent - b.progress_percent);
    
    return order === 'desc' ? sorted.reverse() : sorted;
}