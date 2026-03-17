import React, { useCallback, useEffect, useState } from 'react';
import { Edit2, Plus, Search, StickyNote, Trash2, X } from 'lucide-react';
import { useToast } from '../../ToastProvider';
import { useDebounce } from '../../../hooks/useDebounce';
import {
    createRemarkTemplate,
    deleteRemarkTemplate,
    fetchRemarkTemplates,
    RemarkTemplateRecord,
    updateRemarkTemplate,
} from '../../../services/remarkTemplateLocalApiService';

const RemarkTemplateForm: React.FC<{
    initialData?: RemarkTemplateRecord | null;
    onClose: () => void;
    onSuccess: () => void;
}> = ({ initialData, onClose, onSuccess }) => {
    const { addToast } = useToast();
    const [name, setName] = useState(initialData?.name || '');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) {
            return;
        }

        setLoading(true);
        try {
            if (initialData?.id) {
                await updateRemarkTemplate(initialData.id, trimmed);
            } else {
                await createRemarkTemplate(trimmed);
            }
            addToast({
                type: 'success',
                title: initialData?.id ? 'Remark template updated' : 'Remark template created',
                description: initialData?.id
                    ? 'Remark template has been updated successfully.'
                    : 'New remark template has been added successfully.',
                durationMs: 4000,
            });
            onSuccess();
        } catch (error) {
            console.error('Error saving remark template:', error);
            addToast({
                type: 'error',
                title: initialData?.id ? 'Unable to update remark template' : 'Unable to create remark template',
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Remark</label>
                <input
                    required
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                    placeholder="Enter remark template"
                />
            </div>
            <div className="flex justify-end gap-3 pt-4">
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    className="rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                >
                    {loading ? 'Saving...' : 'Save'}
                </button>
            </div>
        </form>
    );
};

export default function RemarkTemplates() {
    const { addToast } = useToast();
    const [data, setData] = useState<RemarkTemplateRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearch = useDebounce(searchTerm, 300);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<RemarkTemplateRecord | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await fetchRemarkTemplates(debouncedSearch);
            setData(result.items || []);
        } catch (error) {
            console.error('Error fetching remark templates:', error);
            addToast({
                type: 'error',
                title: 'Unable to load remark templates',
                description: error instanceof Error ? error.message : 'An unexpected error occurred.',
                durationMs: 6000,
            });
        } finally {
            setLoading(false);
        }
    }, [addToast, debouncedSearch]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this remark template?')) return;

        try {
            await deleteRemarkTemplate(id);
            addToast({
                type: 'success',
                title: 'Remark template deleted',
                description: 'Remark template has been removed successfully.',
                durationMs: 4000,
            });
            loadData();
        } catch (error) {
            console.error('Error deleting remark template:', error);
            addToast({
                type: 'error',
                title: 'Unable to delete remark template',
                description: error instanceof Error ? error.message : 'An unexpected error occurred.',
                durationMs: 6000,
            });
        }
    };

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-800">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Remark Templates</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Manage reusable transaction remarks from the old-system master list.
                    </p>
                </div>
                <button
                    onClick={() => {
                        setEditingItem(null);
                        setIsModalOpen(true);
                    }}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
                >
                    <Plus size={18} />
                    Add New
                </button>
            </div>

            <div className="flex flex-1 flex-col overflow-hidden p-6">
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search remarks..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-4 outline-none transition-all focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800"
                    />
                </div>

                <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                    <div className="flex-1 overflow-x-auto overflow-y-auto">
                        <table className="w-full">
                            <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                        Remark
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {loading ? (
                                    <tr>
                                        <td colSpan={2} className="px-6 py-8 text-center text-gray-500">
                                            Loading...
                                        </td>
                                    </tr>
                                ) : data.length === 0 ? (
                                    <tr>
                                        <td colSpan={2} className="px-6 py-12 text-center text-gray-500">
                                            <div className="flex flex-col items-center gap-2">
                                                <StickyNote size={20} />
                                                <span>No remark templates found</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    data.map((remark) => (
                                        <tr key={remark.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                                                {remark.name}
                                            </td>
                                            <td className="px-6 py-4 text-right text-sm font-medium">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setEditingItem(remark);
                                                            setIsModalOpen(true);
                                                        }}
                                                        className="p-1 text-blue-600 transition-colors hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(remark.id)}
                                                        className="p-1 text-red-600 transition-colors hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl animate-in fade-in zoom-in duration-200 dark:bg-gray-800">
                        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-900/50">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {editingItem ? 'Edit Remark Template' : 'Add New Remark Template'}
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6">
                            <RemarkTemplateForm
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
