import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, X } from 'lucide-react';
import { useToast } from '../../ToastProvider';
import { useDebounce } from '../../../hooks/useDebounce';
import {
    fetchApprovers,
    createApprover,
    updateApprover,
    deleteApprover,
    fetchAvailableStaff,
    ApproverRecord,
    StaffOption,
    ApproverCreateInput,
    ApproverUpdateInput,
} from '../../../services/approverLocalApiService';

interface ApproverFormProps {
    initialData?: ApproverRecord | null;
    onClose: () => void;
    onSuccess: () => void;
}

const ApproverForm: React.FC<ApproverFormProps> = ({ initialData, onClose, onSuccess }) => {
    const { addToast } = useToast();
    const [formData, setFormData] = useState<ApproverCreateInput | ApproverUpdateInput>({
        user_id: initialData?.user_id || '',
        module: initialData?.module || 'PO',
        level: initialData?.level || 1,
    });
    const [users, setUsers] = useState<StaffOption[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const loadUsers = async () => {
            try {
                const staffList = await fetchAvailableStaff();
                setUsers(staffList);
            } catch (err) {
                console.error('Failed to load staff:', err);
            }
        };
        loadUsers();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.user_id) {
            addToast({
                type: 'warning',
                title: 'Validation Error',
                description: 'Please select a staff member.',
                durationMs: 4000,
            });
            return;
        }

        setLoading(true);
        try {
            if (initialData?.id) {
                await updateApprover(initialData.id, formData);
            } else {
                await createApprover(formData as ApproverCreateInput);
            }
            addToast({
                type: 'success',
                title: initialData?.id ? 'Approver updated' : 'Approver created',
                description: initialData?.id
                    ? 'Approver has been updated successfully.'
                    : 'New approver has been added to the database.',
                durationMs: 4000,
            });
            onSuccess();
        } catch (error) {
            console.error('Error saving approver:', error);
            addToast({
                type: 'error',
                title: initialData?.id ? 'Unable to update approver' : 'Unable to create approver',
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Staff Member</label>
                <select
                    required
                    value={formData.user_id || ''}
                    onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 bg-white"
                >
                    <option value="">Select a user</option>
                    {users.map((u) => (
                        <option key={u.id} value={u.id}>
                            {u.full_name || u.email}
                        </option>
                    ))}
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Module</label>
                <select
                    value={formData.module || 'PO'}
                    onChange={(e) => setFormData({ ...formData, module: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 bg-white"
                >
                    <option value="PO">Purchase Order</option>
                    <option value="PR">Purchase Request</option>
                    <option value="SO">Sales Order</option>
                    <option value="Credit">Credit Limit</option>
                    <option value="Collection">Collection</option>
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Approval Level</label>
                <input
                    required
                    type="number"
                    min={1}
                    max={10}
                    value={formData.level || 1}
                    onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) || 1 })}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 bg-white"
                />
                <p className="text-xs text-gray-500 mt-1">Lower number = Higher priority / Earlier in chain</p>
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

export default function Approvers() {
    const { addToast } = useToast();
    const [data, setData] = useState<ApproverRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearch = useDebounce(searchTerm, 300);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<ApproverRecord | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await fetchApprovers(debouncedSearch);
            setData(result.items || []);
        } catch (error) {
            console.error('Error fetching approvers:', error);
            addToast({
                type: 'error',
                title: 'Unable to load approvers',
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

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this approver?')) return;

        try {
            await deleteApprover(id);
            addToast({
                type: 'success',
                title: 'Approver deleted',
                description: 'Approver has been removed successfully.',
                durationMs: 4000,
            });
            loadData();
        } catch (error) {
            console.error('Error deleting approver:', error);
            addToast({
                type: 'error',
                title: 'Unable to delete approver',
                description: error instanceof Error ? error.message : 'An unexpected error occurred.',
                durationMs: 6000,
            });
        }
    };

    const getModuleLabel = (module: string) => {
        const labels: Record<string, string> = {
            PO: 'Purchase Order',
            PR: 'Purchase Request',
            SO: 'Sales Order',
            Credit: 'Credit Limit',
            Collection: 'Collection',
        };
        return labels[module] || module;
    };

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Approval Hierarchy</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Manage approval workflow and hierarchy</p>
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
                        placeholder="Search approvers..."
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
                                        Approver
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Module
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Level
                                    </th>
                                    <th className="px-6 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {loading ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                                            Loading...
                                        </td>
                                    </tr>
                                ) : data.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                                            No approvers found
                                        </td>
                                    </tr>
                                ) : (
                                    data.map((approver) => (
                                        <tr key={approver.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                                                <div>
                                                    <div className="font-medium">{approver.staff_name || 'Unknown'}</div>
                                                    {approver.staff_email && (
                                                        <div className="text-xs text-gray-500">{approver.staff_email}</div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                                                {getModuleLabel(approver.module)}
                                            </td>
                                            <td className="px-6 py-4 text-sm whitespace-nowrap">
                                                <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 rounded-full text-xs font-semibold">
                                                    Level {approver.level}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right text-sm font-medium">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setEditingItem(approver);
                                                            setIsModalOpen(true);
                                                        }}
                                                        className="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(approver.id)}
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
                                {editingItem ? 'Edit Approver' : 'Add New Approver'}
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6">
                            <ApproverForm
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
