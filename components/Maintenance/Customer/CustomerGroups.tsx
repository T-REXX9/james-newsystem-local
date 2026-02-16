import React, { useState } from 'react';
import { GenericMaintenanceTable } from '../GenericMaintenanceTable';
import { CustomerGroup } from '../../../maintenance.types';
import { supabase } from '../../../lib/supabaseClient';
import { parseSupabaseError } from '../../../utils/errorHandler';
import { useToast } from '../../ToastProvider';

const CustomerGroupForm: React.FC<{
    initialData?: CustomerGroup | null;
    onClose: () => void;
    onSuccess: () => void;
}> = ({ initialData, onClose, onSuccess }) => {
    const { addToast } = useToast();
    const [formData, setFormData] = useState<Partial<CustomerGroup>>(
        initialData || { name: '', description: '', color: '#3b82f6' }
    );
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (initialData?.id) {
                const { error } = await supabase
                    .from('customer_groups' as any)
                    .update(formData)
                    .eq('id', initialData.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('customer_groups' as any).insert([formData]);
                if (error) throw error;
            }
            addToast({
                type: 'success',
                title: initialData?.id ? 'Customer group updated' : 'Customer group created',
                description: initialData?.id
                    ? 'Customer group has been updated successfully.'
                    : 'New customer group has been added to the database.',
                durationMs: 4000,
            });
            onSuccess();
        } catch (error) {
            console.error('Error saving group:', error);
            addToast({
                type: 'error',
                title: initialData?.id ? 'Unable to update customer group' : 'Unable to create customer group',
                description: parseSupabaseError(error, 'customer group'),
                durationMs: 6000,
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Group Name</label>
                <input
                    required
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 bg-white"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                <textarea
                    rows={3}
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 bg-white"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Color Tag</label>
                <input
                    type="color"
                    value={formData.color || '#3b82f6'}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="mt-1 block w-full h-10 p-1 rounded-md border-gray-300 dark:border-gray-600 cursor-pointer"
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

export default function CustomerGroups() {
    return (
        <GenericMaintenanceTable<CustomerGroup>
            tableName="customer_groups"
            title="Customer Groups"
            columns={[
                { key: 'name', label: 'Name' },
                {
                    key: 'color',
                    label: 'Color',
                    render: (group) => (
                        <div className="flex items-center gap-2">
                            <span
                                className="w-4 h-4 rounded-full border border-gray-300 dark:border-gray-600"
                                style={{ backgroundColor: group.color || '#ccc' }}
                            />
                            {group.color}
                        </div>
                    )
                },
                { key: 'description', label: 'Description' },
            ]}
            FormComponent={CustomerGroupForm}
        />
    );
}
