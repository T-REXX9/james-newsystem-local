import React, { useState, useEffect } from 'react';
import { GenericMaintenanceTable } from '../GenericMaintenanceTable';
import { Approver } from '../../../maintenance.types';
import { supabase } from '../../../lib/supabaseClient';
import { parseSupabaseError } from '../../../utils/errorHandler';
import { useToast } from '../../ToastProvider';

interface Profile {
    id: string;
    full_name: string;
    email: string;
}

const ApproverForm: React.FC<{
    initialData?: Approver | null;
    onClose: () => void;
    onSuccess: () => void;
}> = ({ initialData, onClose, onSuccess }) => {
    const { addToast } = useToast();
    const [formData, setFormData] = useState<Partial<Approver>>(
        initialData || { user_id: '', module: 'PO', level: 1 }
    );
    const [users, setUsers] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchUsers = async () => {
            const { data, error } = await supabase.from('profiles').select('id, full_name, email');
            if (!error && data) {
                setUsers(data as any[]);
            }
        };
        fetchUsers();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (initialData?.id) {
                const { error } = await supabase
                    .from('approvers' as any)
                    .update(formData)
                    .eq('id', initialData.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('approvers' as any).insert([formData]);
                if (error) throw error;
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
                description: parseSupabaseError(error, 'approver'),
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
                    onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) })}
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
    const [users, setUsers] = useState<Record<string, string>>({});

    // Prefetch users for display mapping
    useEffect(() => {
        const fetchUsers = async () => {
            const { data } = await supabase.from('profiles').select('id, full_name, email');
            if (data) {
                const userMap: Record<string, string> = {};
                data.forEach((u: any) => userMap[u.id] = u.full_name || u.email);
                setUsers(userMap);
            }
        };
        fetchUsers();
    }, []);

    return (
        <GenericMaintenanceTable<Approver>
            tableName="approvers"
            title="Approval Hierarchy"
            columns={[
                {
                    key: 'user_id',
                    label: 'Approver',
                    render: (item) => users[item.user_id] || item.user_id
                },
                { key: 'module', label: 'Module' },
                {
                    key: 'level',
                    label: 'Level',
                    render: (item) => (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                            Level {item.level}
                        </span>
                    )
                },
            ]}
            FormComponent={ApproverForm}
        />
    );
}
