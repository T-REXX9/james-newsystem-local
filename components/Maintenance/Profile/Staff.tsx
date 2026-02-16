import React, { useState, useEffect } from 'react';
import { GenericMaintenanceTable } from '../GenericMaintenanceTable';
import { supabase } from '../../../lib/supabaseClient';
import { parseSupabaseError } from '../../../utils/errorHandler';
import { useToast } from '../../ToastProvider';
import { ENTITY_TYPES, logActivity } from '../../../services/activityLogService';

interface Profile {
    id: string;
    full_name: string;
    email: string;
    role: string;
    mobile: string;
    team_id: string;
    created_at: string;
}

interface Team {
    id: string;
    name: string;
}

const StaffForm: React.FC<{
    initialData?: Profile | null;
    onClose: () => void;
    onSuccess: () => void;
}> = ({ initialData, onClose, onSuccess }) => {
    const { addToast } = useToast();
    const [formData, setFormData] = useState<Partial<Profile>>(
        initialData || { full_name: '', email: '', role: 'Sales Agent', mobile: '', team_id: '' }
    );
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchTeams = async () => {
            const { data } = await supabase.from('teams' as any).select('id, name');
            if (data) setTeams(data);
        };
        fetchTeams();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (initialData?.id) {
                const { error } = await supabase
                    .from('profiles')
                    .update(formData)
                    .eq('id', initialData.id);
                if (error) throw error;
                const updatedFields = Object.entries(formData).reduce<string[]>((acc, [key, value]) => {
                    const originalValue = initialData[key as keyof Profile];
                    if (value !== undefined && value !== originalValue) {
                        acc.push(key);
                    }
                    return acc;
                }, []);
                try {
                    await logActivity('UPDATE_STAFF', ENTITY_TYPES.USER_PROFILE, initialData.id, {
                        updated_fields: updatedFields,
                        role: formData.role || initialData.role,
                    });
                } catch (logError) {
                    console.error('Failed to log activity:', logError);
                }
                if (initialData.role && formData.role && initialData.role !== formData.role) {
                    try {
                        await logActivity('CHANGE_ROLE', ENTITY_TYPES.USER_PROFILE, initialData.id, {
                            old_role: initialData.role,
                            new_role: formData.role,
                        });
                    } catch (logError) {
                        console.error('Failed to log activity:', logError);
                    }
                }
            } else {
                // Note: Creating a profile usually happens via Auth Sign Up. 
                // Direct insert might fail if no auth user associated, but allowing for now or this could be "Edit Only" page.
                // For this system, we'll assume we can update existing profiles or maybe insert if RLS allows (unlikely for auth linked tables).
                // If this is strictly "Maintenance", it might be "Edit Only".
                // Let's assume Edit Only for safety, or warn user.
                alert("Creating new users should be done via Auth Sign Up. This form only updates profile details.");
                return;
            }
            addToast({
                type: 'success',
                title: 'Staff updated',
                description: 'Staff profile has been updated successfully.',
                durationMs: 4000,
            });
            onSuccess();
        } catch (error) {
            console.error('Error saving profile:', error);
            addToast({
                type: 'error',
                title: 'Unable to update staff',
                description: parseSupabaseError(error, 'staff profile'),
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
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 bg-white"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                <input
                    disabled // Email usually immutable linked to Auth
                    type="email"
                    value={formData.email || ''}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 bg-gray-100 dark:bg-gray-800 shadow-sm sm:text-sm p-2 cursor-not-allowed"
                />
            </div>
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
                        <option key={t.id} value={t.id}>{t.name}</option>
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

export default function Staff() {
    return (
        <GenericMaintenanceTable<Profile>
            tableName="profiles"
            title="Staff Management"
            allowAdd={false} // Disable add, as profiles are auth-linked
            columns={[
                { key: 'full_name', label: 'Name' },
                { key: 'email', label: 'Email' },
                {
                    key: 'role',
                    label: 'Role',
                    render: (p) => (
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${p.role === 'Administrator' ? 'bg-purple-100 text-purple-800' :
                            p.role === 'Manager' ? 'bg-indigo-100 text-indigo-800' :
                                'bg-gray-100 text-gray-800' // Default
                            }`}>
                            {p.role}
                        </span>
                    )
                },
                { key: 'mobile', label: 'Mobile' },
            ]}
            FormComponent={StaffForm}
        />
    );
}
