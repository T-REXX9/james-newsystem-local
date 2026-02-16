import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Plus, Search, Edit2, Trash2, X } from 'lucide-react';

interface Column<T> {
    key: keyof T | string;
    label: string;
    render?: (item: T) => React.ReactNode;
}

interface GenericMaintenanceTableProps<T> {
    tableName: string;
    title: string;
    columns: Column<T>[];
    fetchQuery?: any; // Optional custom query builder
    defaultSort?: { column: string; ascending: boolean };
    allowAdd?: boolean;
    allowEdit?: boolean;
    allowDelete?: boolean;
    FormComponent?: React.FC<{
        initialData?: T | null;
        onClose: () => void;
        onSuccess: () => void;
    }>;
}

export function GenericMaintenanceTable<T extends { id: string }>({
    tableName,
    title,
    columns,
    allowAdd = true,
    allowEdit = true,
    allowDelete = true,
    FormComponent,
}: GenericMaintenanceTableProps<T>) {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<T | null>(null);

    const fetchData = async () => {
        setLoading(true);
        let query = supabase.from(tableName as any).select('*');

        // Simple sort by created_at if exists, else id
        // We can make this robust later
        query = query.order('created_at', { ascending: false });

        const { data: result, error } = await query;
        if (error) {
            console.error('Error fetching data:', error);
            alert('Error fetching data');
        } else {
            setData(result as unknown as T[]);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, [tableName]);

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this item?')) return;

        const { error } = await supabase.from(tableName as any).delete().eq('id', id);
        if (error) {
            console.error('Error deleting:', error);
            alert('Error deleting item');
        } else {
            fetchData();
        }
    };

    const filteredData = data.filter((item) =>
        Object.values(item as any).some((val) =>
            String(val).toLowerCase().includes(searchTerm.toLowerCase())
        )
    );

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Manage your {title.toLowerCase()}</p>
                </div>
                {allowAdd && FormComponent && (
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
                )}
            </div>

            <div className="p-6 flex-1 overflow-hidden flex flex-col">
                <div className="mb-4 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search..."
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
                                    {columns.map((col, idx) => (
                                        <th
                                            key={idx}
                                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                                        >
                                            {col.label}
                                        </th>
                                    ))}
                                    {(allowEdit || allowDelete) && <th className="px-6 py-3 text-right">Actions</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {loading ? (
                                    <tr>
                                        <td colSpan={columns.length + 1} className="px-6 py-8 text-center text-gray-500">
                                            Loading...
                                        </td>
                                    </tr>
                                ) : filteredData.length === 0 ? (
                                    <tr>
                                        <td colSpan={columns.length + 1} className="px-6 py-8 text-center text-gray-500">
                                            No records found
                                        </td>
                                    </tr>
                                ) : (
                                    filteredData.map((item) => (
                                        <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                            {columns.map((col, idx) => (
                                                <td key={idx} className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                                                    {col.render ? col.render(item) : String((item as any)[col.key] || '-')}
                                                </td>
                                            ))}
                                            {(allowEdit || allowDelete) && (
                                                <td className="px-6 py-4 text-right text-sm font-medium">
                                                    <div className="flex justify-end gap-2">
                                                        {allowEdit && FormComponent && (
                                                            <button
                                                                onClick={() => {
                                                                    setEditingItem(item);
                                                                    setIsModalOpen(true);
                                                                }}
                                                                className="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                                                            >
                                                                <Edit2 size={16} />
                                                            </button>
                                                        )}
                                                        {allowDelete && (
                                                            <button
                                                                onClick={() => handleDelete(item.id)}
                                                                className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {isModalOpen && FormComponent && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {editingItem ? 'Edit Item' : 'Add New Item'}
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6">
                            <FormComponent
                                initialData={editingItem}
                                onClose={() => setIsModalOpen(false)}
                                onSuccess={() => {
                                    setIsModalOpen(false);
                                    fetchData();
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
