import React, { useState, useEffect, useCallback } from 'react';
import { Search, Edit2, Trash2, X, Plus } from 'lucide-react';
import { useToast } from '../../ToastProvider';
import { useDebounce } from '../../../hooks/useDebounce';
import {
    fetchStaff,
    createStaff,
    updateStaff,
    deleteStaff,
    StaffRecord,
    StaffUpdateInput,
} from '../../../services/staffLocalApiService';
import { fetchTeams, TeamRecord } from '../../../services/teamLocalApiService';
import { ROLE_DEFAULT_ACCESS_RIGHTS } from '../../../constants';
import HighLevelDeleteModal from '../../HighLevelDeleteModal';

interface StaffFormProps {
    initialData?: StaffRecord | null;
    onClose: () => void;
    onSuccess: () => void;
}

const StaffForm: React.FC<StaffFormProps> = ({ initialData, onClose, onSuccess }) => {
    const { addToast } = useToast();
    const [formData, setFormData] = useState<StaffUpdateInput>({
        full_name: initialData?.full_name || '',
        role: initialData?.role || 'Sales Agent',
        mobile: initialData?.mobile || '',
        team_id: initialData?.team_id || '',
    });
    const [teams, setTeams] = useState<TeamRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState(initialData?.email || '');
    const [password, setPassword] = useState('');
    const [birthday, setBirthday] = useState(initialData?.birthday || '');

    useEffect(() => {
        const loadTeams = async () => {
            try {
                const result = await fetchTeams();
                setTeams(result.items || []);
            } catch (err) {
                console.error('Failed to load teams:', err);
            }
        };
        loadTeams();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (initialData?.id) {
                await updateStaff(initialData.id, { ...formData, birthday });
            } else {
                const createdStaff = await createStaff({
                    full_name: String(formData.full_name || '').trim(),
                    email: email.trim(),
                    password,
                    role: String(formData.role || 'Sales Agent'),
                    birthday: birthday || undefined,
                    mobile: formData.mobile || undefined,
                    access_rights: ROLE_DEFAULT_ACCESS_RIGHTS[String(formData.role || 'Sales Agent')] || ['home'],
                });
                if (formData.team_id && createdStaff.id) {
                    await updateStaff(createdStaff.id, { team_id: formData.team_id });
                }
            }

            addToast({
                type: 'success',
                title: initialData ? 'Staff updated' : 'Staff account created',
                description: initialData
                    ? 'Staff profile has been updated successfully.'
                    : 'The new staff account is ready to use.',
                durationMs: 4000,
            });
            onSuccess();
        } catch (error) {
            console.error('Error saving profile:', error);
            addToast({
                type: 'error',
                title: initialData ? 'Unable to update staff' : 'Unable to create staff',
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
                <input
                    required
                    type="text"
                    value={formData.full_name || ''}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="e.g. Jane Doe"
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 bg-white"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email or Username</label>
                <input
                    disabled={Boolean(initialData)}
                    required
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address or username"
                    className={`mt-1 block w-full rounded-md border-gray-300 p-2 shadow-sm sm:text-sm dark:border-gray-600 dark:bg-gray-700 ${initialData ? 'cursor-not-allowed bg-gray-100 dark:bg-gray-800' : 'bg-white'}`}
                />
            </div>
            {!initialData && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Initial Password</label>
                    <input
                        required
                        minLength={8}
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimum 8 characters"
                        className="mt-1 block w-full rounded-md border-gray-300 bg-white p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:border-gray-600 dark:bg-gray-700"
                    />
                </div>
            )}
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
                <select
                    value={formData.role || 'Sales Agent'}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 bg-white"
                >
                    <option value="Administrator">Administrator</option>
                    <option value="Manager">Manager</option>
                    <option value="Sales Agent">Sales Agent</option>
                    <option value="Accounting">Accounting</option>
                    <option value="Warehouse">Warehouse</option>
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Team</label>
                <select
                    value={formData.team_id || ''}
                    onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 bg-white"
                >
                    <option value="">No Team</option>
                    {teams.map(t => (
                        <option key={t.id} value={String(t.id)}>{t.name}</option>
                    ))}
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Mobile</label>
                <input
                    type="text"
                    value={formData.mobile || ''}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 bg-white"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Birthday</label>
                <input
                    type="date"
                    value={birthday}
                    onChange={(e) => setBirthday(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 bg-white p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:border-gray-600 dark:bg-gray-700"
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
                    {loading ? 'Saving...' : initialData ? 'Save Changes' : 'Create Account'}
                </button>
            </div>
        </form>
    );
};

export default function Staff() {
    const { addToast } = useToast();
    const [data, setData] = useState<StaffRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearch = useDebounce(searchTerm, 300);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<StaffRecord | null>(null);
    const [deactivateTarget, setDeactivateTarget] = useState<StaffRecord | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await fetchStaff(debouncedSearch);
            setData(result.items || []);
        } catch (error) {
            console.error('Error fetching staff:', error);
            addToast({
                type: 'error',
                title: 'Unable to load staff',
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

    const handleDelete = async () => {
        if (!deactivateTarget) return;
        try {
            await deleteStaff(deactivateTarget.id);
            addToast({
                type: 'success',
                title: 'Staff deactivated',
                description: 'Staff member has been deactivated successfully.',
                durationMs: 4000,
            });
            setDeactivateTarget(null);
            loadData();
        } catch (error) {
            console.error('Error deactivating staff:', error);
            addToast({
                type: 'error',
                title: 'Unable to deactivate staff',
                description: error instanceof Error ? error.message : 'An unexpected error occurred.',
                durationMs: 6000,
            });
        }
    };

    const getRoleBadgeClass = (role: string) => {
        switch (role) {
            case 'Administrator':
                return 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300';
            case 'Manager':
                return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300';
            case 'Warehouse':
                return 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300';
            case 'Accounting':
                return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
            default:
                return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
        }
    };

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Staff Management</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Manage your staff members</p>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        setEditingItem(null);
                        setIsModalOpen(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                    <Plus size={18} /> Add Staff Account
                </button>
            </div>

            <div className="p-6 flex-1 overflow-hidden flex flex-col">
                <div className="mb-4 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search staff..."
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
                                        Email
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Role
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Team
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Mobile
                                    </th>
                                    <th className="px-6 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                            Loading...
                                        </td>
                                    </tr>
                                ) : data.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                            No staff members found
                                        </td>
                                    </tr>
                                ) : (
                                    data.map((staff) => (
                                        <tr key={staff.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                                                {staff.full_name}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                                                {staff.email}
                                            </td>
                                            <td className="px-6 py-4 text-sm whitespace-nowrap">
                                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getRoleBadgeClass(staff.role)}`}>
                                                    {staff.role}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                                                {staff.team_name || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                                                {staff.mobile || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right text-sm font-medium">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setEditingItem(staff);
                                                            setIsModalOpen(true);
                                                        }}
                                                        className="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => setDeactivateTarget(staff)}
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
                <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {editingItem ? 'Edit Staff' : 'Create Staff Account'}
                            </h3>
                            <button
                                aria-label="Close staff modal"
                                onClick={() => {
                                    setIsModalOpen(false);
                                    setEditingItem(null);
                                }}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6">
                            <StaffForm
                                initialData={editingItem}
                                onClose={() => {
                                    setIsModalOpen(false);
                                    setEditingItem(null);
                                }}
                                onSuccess={() => {
                                    setIsModalOpen(false);
                                    loadData();
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            <HighLevelDeleteModal
                isOpen={deactivateTarget !== null}
                onClose={() => setDeactivateTarget(null)}
                onConfirm={handleDelete}
                title="Deactivate Staff Member"
                message={`Deactivate ${deactivateTarget?.full_name || 'this staff member'}? They will no longer appear as an active staff account.`}
                confirmLabel="Deactivate"
                cancelLabel="Cancel"
            />
        </div>
    );
}
