import React, { useState, useEffect, useMemo } from 'react';
import { Plus, CheckCircle, Trash2, X } from 'lucide-react';
import CustomLoadingSpinner from './CustomLoadingSpinner';
import AgentTasksList from './AgentTasksList';
import { fetchTasks, createTask, updateTask, deleteTask, fetchProfiles } from '../services/supabaseService';
import { Task, UserProfile } from '../types';
import { useRealtimeList } from '../hooks/useRealtimeList';
import { applyOptimisticUpdate, applyOptimisticDelete } from '../utils/optimisticUpdates';
import { parseSupabaseError } from '../utils/errorHandler';
import { useToast } from './ToastProvider';

interface TasksViewProps {
  currentUser: UserProfile | null;
  variant?: 'full' | 'embedded';
  maxVisibleTasks?: number;
  onTasksLoaded?: (tasks: Task[]) => void;
}

const TasksView: React.FC<TasksViewProps> = ({ currentUser, variant = 'full', maxVisibleTasks, onTasksLoaded }) => {
  const { addToast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filter, setFilter] = useState<'my' | 'all'>('my');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Todo' | 'In Progress' | 'Done'>('All');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTask, setNewTask] = useState<Partial<Task>>({
    title: '',
    description: '',
    assignedTo: currentUser?.full_name || '',
    priority: 'Medium',
    dueDate: new Date().toISOString().split('T')[0],
    status: 'Todo'
  });

  // Use real-time list hook for tasks
  const sortByCreatedAt = (a: Task, b: Task) => {
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  };

  const { data: tasks, isLoading, setData: setTasks } = useRealtimeList<Task>({
    tableName: 'tasks',
    initialFetchFn: fetchTasks,
    sortFn: sortByCreatedAt,
  });

  useEffect(() => {
    const loadUsers = async () => {
      const usersData = await fetchProfiles();
      setUsers(usersData);
    };
    loadUsers();
  }, []);

  useEffect(() => {
    const agentTasks = tasks.filter(task => task.assignedTo === currentUser?.full_name);
    onTasksLoaded?.(agentTasks);
  }, [tasks, currentUser?.full_name, onTasksLoaded]);

  const isOwner = currentUser?.role === 'Owner';
  const isEmbedded = variant === 'embedded';

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesUser = filter === 'all' ? true : task.assignedTo === currentUser?.full_name;
      const matchesStatus = statusFilter === 'All' ? true : task.status === statusFilter;
      return matchesUser && matchesStatus;
    });
  }, [tasks, filter, statusFilter, currentUser?.full_name]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title || !newTask.assignedTo) return;

    const assigneeProfile = users.find(u => u.full_name === newTask.assignedTo);

    const taskToCreate = {
      ...newTask,
      createdBy: currentUser?.full_name || 'Unknown',
      assigneeAvatar: assigneeProfile?.avatar_url || 'https://i.pravatar.cc/150',
      status: 'Todo'
    } as Omit<Task, 'id'>;

    try {
      await createTask(taskToCreate);
      addToast({
        type: 'success',
        title: 'Task created',
        description: 'Task has been created successfully.',
        durationMs: 4000,
      });
      setIsModalOpen(false);
      setNewTask({
          title: '',
          description: '',
          assignedTo: currentUser?.full_name || '',
          priority: 'Medium',
          dueDate: new Date().toISOString().split('T')[0],
          status: 'Todo'
      });
      // No need to reload - real-time subscription will update
    } catch (error) {
      console.error('Error creating task:', error);
      addToast({
        type: 'error',
        title: 'Unable to create task',
        description: parseSupabaseError(error, 'task'),
        durationMs: 6000,
      });
    }
  };

  const handleStatusChange = async (task: Task, newStatus: Task['status']) => {
    // Optimistic update
    setTasks(prev => applyOptimisticUpdate(prev, task.id, { status: newStatus }));

    try {
      await updateTask(task.id, { status: newStatus });
    } catch (error) {
      console.error('Error updating task status:', error);
      // Real-time subscription will correct the state
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this task?')) {
      // Optimistic delete
      setTasks(prev => applyOptimisticDelete(prev, id));

      try {
        await deleteTask(id);
      } catch (error) {
        console.error('Error deleting task:', error);
        // Real-time subscription will correct the state
      }
    }
  };

  if (isLoading) {
    return (
        <div className="flex items-center justify-center h-full">
            <CustomLoadingSpinner label="Loading" />
        </div>
    );
  }

  return (
    <div className={isEmbedded ? 'bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm' : 'flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-6 animate-fadeIn'}>
      <div className={`flex flex-col md:flex-row justify-between items-start md:items-center ${isEmbedded ? 'mb-4' : 'mb-6'} gap-4`}>
        <div>
          <h1 className={`font-bold text-slate-800 dark:text-white flex items-center gap-2 ${isEmbedded ? 'text-lg' : 'text-2xl'}`}>
            <CheckCircle className="w-6 h-6 text-brand-blue" />
            Task Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Assign and track team responsibilities.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-blue hover:bg-blue-700 text-white rounded-lg shadow-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> New Task
        </button>
      </div>

      <div className={`bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 mb-6 ${isEmbedded ? '' : 'sticky top-0 z-10'}`}>
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
          <button
            onClick={() => setFilter('my')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${filter === 'my' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            My Tasks
          </button>
          {isOwner && (
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${filter === 'all' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              All Tasks
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-slate-400 uppercase font-bold">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm rounded-lg px-3 py-1.5 outline-none focus:border-brand-blue dark:text-white"
          >
            <option value="All">All</option>
            <option value="Todo">Todo</option>
            <option value="In Progress">In Progress</option>
            <option value="Done">Done</option>
          </select>
        </div>
      </div>

      <div className={isEmbedded ? 'space-y-3' : 'flex-1 overflow-y-auto space-y-3 custom-scrollbar pb-10'}>
        <AgentTasksList
          tasks={filteredTasks}
          isOwner={isOwner}
          onStatusChange={handleStatusChange}
          onDelete={isOwner ? handleDelete : undefined}
          maxItems={maxVisibleTasks}
          emptyMessage="No tasks found."
        />
      </div>

      {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800 flex flex-col">
                  <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
                      <h2 className="text-lg font-bold text-slate-800 dark:text-white">Create New Task</h2>
                      <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  <form onSubmit={handleCreateTask} className="p-6 space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Title</label>
                          <input 
                            required 
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-800 dark:text-white"
                            value={newTask.title}
                            onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                            placeholder="e.g. Call client for feedback"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                          <textarea 
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-800 dark:text-white"
                            rows={3}
                            value={newTask.description}
                            onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                          />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assign To</label>
                              {isOwner ? (
                                  <select 
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-800 dark:text-white"
                                    value={newTask.assignedTo}
                                    onChange={(e) => setNewTask({...newTask, assignedTo: e.target.value})}
                                  >
                                      {users.map(u => (
                                          <option key={u.id} value={u.full_name}>{u.full_name}</option>
                                      ))}
                                  </select>
                              ) : (
                                  <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm text-slate-600 dark:text-slate-300">
                                      {currentUser?.full_name}
                                  </div>
                              )}
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Priority</label>
                              <select 
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-800 dark:text-white"
                                value={newTask.priority}
                                onChange={(e) => setNewTask({...newTask, priority: e.target.value as any})}
                              >
                                  <option value="Low">Low</option>
                                  <option value="Medium">Medium</option>
                                  <option value="High">High</option>
                              </select>
                          </div>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Due Date</label>
                          <input 
                            type="date"
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-800 dark:text-white"
                            value={newTask.dueDate}
                            onChange={(e) => setNewTask({...newTask, dueDate: e.target.value})}
                          />
                      </div>
                      <div className="pt-4 flex gap-3">
                          <button 
                            type="button" 
                            onClick={() => setIsModalOpen(false)}
                            className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-bold text-sm"
                          >
                              Cancel
                          </button>
                          <button 
                            type="submit" 
                            className="flex-1 px-4 py-2 bg-brand-blue text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2 hover:bg-blue-700"
                          >
                              Create Task
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default TasksView;
