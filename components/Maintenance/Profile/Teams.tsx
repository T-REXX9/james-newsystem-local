import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, X, Users } from 'lucide-react';
import { useToast } from '../../ToastProvider';
import { useDebounce } from '../../../hooks/useDebounce';
import {
    fetchTeams,
    createTeam,
    updateTeam,
    deleteTeam,
    TeamRecord,
} from '../../../services/teamLocalApiService';

const TeamForm: React.FC<{
    initialData?: TeamRecord | null;
    onClose: () => void;
    onSuccess: () => void;
}> = ({ initialData, onClose, onSuccess }) => {
    const { addToast } = useToast();
    const [name, setName] = useState(initialData?.name || '');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) return;

        setLoading(true);
        try {
            if (initialData?.id) {
                await updateTeam(initialData.id, trimmed);
            } else {
                await createTeam(trimmed);
            }
            addToast({
                type: 'success',
                title: initialData?.id ? 'Team updated' : 'Team created',
                description: initialData?.id
                    ? 'Team has been updated successfully.'
                    : 'New team has been added to the database.',
                durationMs: 4000,
            });
            onSuccess();
        } catch (error) {
            console.error('Error saving team:', error);
            addToast({
                type: 'error',
                title: initialData?.id ? 'Unable to update team' : 'Unable to create team',
                description: error instanceof Error ? error.message : 'An unexpected error occurred.',
                durationMs: 6000,
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Team Name</label>
                <input
                    required
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 bg-white"
                />
            </div>
            <div className="flex justify-end gap-3 pt-4">
                <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                    {loading ? 'Saving...' : 'Save'}
                </button>
            </div>
        </form>
    );
};

export default function Teams() {
    const { addToast } = useToast();
    const [data, setData] = useState<TeamRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearch = useDebounce(searchTerm, 300);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<TeamRecord | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await fetchTeams(debouncedSearch);
            setData(result.items || []);
        } catch (error) {
            console.error('Error fetching teams:', error);
            addToast({
                type: 'error',
                title: 'Unable to load teams',
                description: error instanceof Error ? error.message : 'An unexpected error occurred.',
                durationMs: 6000,
            });
        } finally {
            setLoading(false);
        }
    }, [debouncedSearch, addToast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this team?')) return;

        try {
            await deleteTeam(id);
            addToast({
                type: 'success',
                title: 'Team deleted',
                description: 'Team has been removed successfully.',
                durationMs: 4000,
            });
            loadData();
        } catch (error) {
            console.error('Error deleting team:', error);
            addToast({
                type: 'error',
                title: 'Unable to delete team',
                description: error instanceof Error ? error.message : 'An unexpected error occurred.',
                durationMs: 6000,
            });
        }
    };

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Team Management</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Manage your teams</p>
                </div>
                <button
                    onClick={() => {
                        setEditingItem(null);
                        setIsModalOpen(true);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors"
                >
                    <Plus size={18} />
                    Add New
                </button>
            </div>

            <div className="p-6 flex-1 overflow-hidden flex flex-col">
                <div className="mb-4 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search teams..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex-1 overflow-hidden flex flex-col">
                    <div className="overflow-x-auto overflow-y-auto flex-1">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Name
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Members
                                    </th>
                                    <th className="px-6 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {loading ? (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                                            Loading...
                                        </td>
                                    </tr>
                                ) : data.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                                            No records found
                                        </td>
                                    </tr>
                                ) : (
                                    data.map((team) => (
                                        <tr key={team.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                                                {team.name}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                                                <span className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-300">
                                                    <Users size={14} />
                                                    {team.member_count}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right text-sm font-medium">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setEditingItem(team);
                                                            setIsModalOpen(true);
                                                        }}
                                                        className="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(team.id)}
                                                        className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {editingItem ? 'Edit Team' : 'Add New Team'}
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6">
                            <TeamForm
                                initialData={editingItem}
                                onClose={() => setIsModalOpen(false)}
                                onSuccess={() => {
                                    setIsModalOpen(false);
                                    loadData();
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
