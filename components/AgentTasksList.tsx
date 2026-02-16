import React from 'react';
import { Calendar, CheckCircle, Loader2, Trash2 } from 'lucide-react';
import { Task } from '../types';

interface AgentTasksListProps {
  tasks: Task[];
  isOwner?: boolean;
  onStatusChange?: (task: Task, newStatus: Task['status']) => void | Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
  maxItems?: number;
  updatingTaskId?: string | null;
  emptyMessage?: string;
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'High':
      return 'text-rose-600 bg-rose-50 border-rose-100 dark:bg-rose-900/30 dark:border-rose-900 dark:text-rose-400';
    case 'Medium':
      return 'text-amber-600 bg-amber-50 border-amber-100 dark:bg-amber-900/30 dark:border-amber-900 dark:text-amber-400';
    case 'Low':
      return 'text-blue-600 bg-blue-50 border-blue-100 dark:bg-blue-900/30 dark:border-blue-900 dark:text-blue-400';
    default:
      return 'text-slate-600 bg-slate-50 border-slate-100';
  }
};

const AgentTasksList: React.FC<AgentTasksListProps> = ({
  tasks,
  isOwner,
  onStatusChange,
  onDelete,
  maxItems,
  updatingTaskId,
  emptyMessage
}) => {
  const visibleTasks = maxItems ? tasks.slice(0, maxItems) : tasks;

  if (!visibleTasks.length) {
    return (
      <div className="text-center p-10 text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 border-dashed">
        <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-20" />
        <p>{emptyMessage || 'No tasks found.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {visibleTasks.map((task) => {
        const isUpdating = updatingTaskId === task.id;

        return (
          <div
            key={task.id}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
              <button
                onClick={() => onStatusChange?.(task, task.status === 'Done' ? 'Todo' : 'Done')}
                className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                  task.status === 'Done'
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'border-slate-300 dark:border-slate-600 hover:border-brand-blue'
                }`}
                disabled={isUpdating}
                title="Toggle task status"
              >
                {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : task.status === 'Done' && <CheckCircle className="w-4 h-4" />}
              </button>

              <div className="flex-1 min-w-0">
                <h3
                  className={`font-bold text-slate-800 dark:text-white ${
                    task.status === 'Done' ? 'line-through text-slate-400 dark:text-slate-500' : ''
                  }`}
                >
                  {task.title}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{task.description}</p>
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded border font-bold uppercase ${getPriorityColor(task.priority)}`}>
                    {task.priority}
                  </span>
                  <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-100 dark:border-slate-700">
                    <Calendar className="w-3 h-3" /> {task.dueDate}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                    <span>Assigned to:</span>
                    <div className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                      <img src={task.assigneeAvatar} className="w-4 h-4 rounded-full" alt="" />
                      {task.assignedTo}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={task.status}
                  onChange={(e) => onStatusChange?.(task, e.target.value as Task['status'])}
                  className={`text-xs font-bold uppercase rounded px-2 py-1 border outline-none cursor-pointer ${
                    task.status === 'Done'
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-900'
                      : task.status === 'In Progress'
                        ? 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:border-blue-900'
                        : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
                  }`}
                  disabled={isUpdating}
                >
                  <option value="Todo">Todo</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Done">Done</option>
                </select>

                {isOwner && onDelete && (
                  <button
                    onClick={() => onDelete(task.id)}
                    className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded transition-colors"
                    title="Delete task"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AgentTasksList;
