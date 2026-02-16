import React, { useState } from 'react';
import { GenericMaintenanceTable } from '../GenericMaintenanceTable';
import { RemarkTemplate } from '../../../maintenance.types';
import { supabase } from '../../../lib/supabaseClient';
import { parseSupabaseError } from '../../../utils/errorHandler';
import { useToast } from '../../ToastProvider';

const RemarkTemplateForm: React.FC<{
    initialData?: RemarkTemplate | null;
    onClose: () => void;
    onSuccess: () => void;
}> = ({ initialData, onClose, onSuccess }) => {
    const { addToast } = useToast();
    const [formData, setFormData] = useState<Partial<RemarkTemplate>>(
        initialData || { title: '', content: '', type: 'invoice' }
    );
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (initialData?.id) {
                const { error } = await supabase
                    .from('remark_templates' as any)
                    .update(formData)
                    .eq('id', initialData.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('remark_templates' as any).insert([formData]);
                if (error) throw error;
            }
            addToast({
                type: 'success',
                title: initialData?.id ? 'Remark template updated' : 'Remark template created',
                description: initialData?.id
                    ? 'Remark template has been updated successfully.'
                    : 'New remark template has been added to the database.',
                durationMs: 4000,
            });
            onSuccess();
        } catch (error) {
            console.error('Error saving template:', error);
            addToast({
                type: 'error',
                title: initialData?.id ? 'Unable to update remark template' : 'Unable to create remark template',
                description: parseSupabaseError(error, 'remark template'),
                durationMs: 6000,
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
                <input
                    required
                    type="text"
                    value={formData.title || ''}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 bg-white"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Type</label>
                <select
                    value={formData.type || 'invoice'}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 bg-white"
                >
                    <option value="invoice">Invoice</option>
                    <option value="purchase_order">Purchase Order</option>
                    <option value="delivery">Delivery</option>
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Content</label>
                <textarea
                    required
                    rows={4}
                    value={formData.content || ''}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
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

export default function RemarkTemplates() {
    return (
        <GenericMaintenanceTable<RemarkTemplate>
            tableName="remark_templates"
            title="Remark Templates"
            columns={[
                { key: 'title', label: 'Title' },
                { key: 'type', label: 'Type' },
                { key: 'content', label: 'Content' },
            ]}
            FormComponent={RemarkTemplateForm}
        />
    );
}
