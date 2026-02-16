import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { Plus, Search, Edit2, Trash2, X, Users, Building2, MapPin, Target } from 'lucide-react';
import { Customer, CustomerGroup } from '../../../maintenance.types';
import { ContactPersons } from './CustomerData/ContactPersons';

export function Pipeline() {
    const [prospects, setProspects] = useState<Customer[]>([]);
    const [groups, setGroups] = useState<CustomerGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProspect, setEditingProspect] = useState<Customer | null>(null);

    // Form states
    const [formData, setFormData] = useState<Partial<Customer>>({
        status: 'Prospect',
        is_customer: true
    });

    const fetchData = async () => {
        setLoading(true);
        // Fetch prospects (contacts with status 'Prospect')
        const { data: prospectsData, error: prospectsError } = await supabase
            .from('contacts' as any)
            .select(`
                *,
                customer_groups (
                    name,
                    color
                )
            `)
            .eq('is_customer', true)
            .eq('status', 'Prospect')
            .order('company', { ascending: true });

        if (prospectsError) {
            console.error('Error fetching prospects:', prospectsError);
        } else {
            setProspects((prospectsData as any) || []);
        }

        const { data: groupsData } = await supabase
            .from('customer_groups' as any)
            .select('*')
            .order('name');

        if (groupsData) {
            setGroups(groupsData as any);
        }

        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSave = async () => {
        try {
            const dataToSave = {
                ...formData,
                is_customer: true,
                status: 'Prospect' // Enforce status
            };

            if (editingProspect?.id) {
                const { error } = await supabase
                    .from('contacts' as any)
                    .update(dataToSave)
                    .eq('id', editingProspect.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('contacts' as any)
                    .insert([dataToSave]);
                if (error) throw error;
            }
            setIsModalOpen(false);
            fetchData();
        } catch (error) {
            console.error('Error saving prospect:', error);
            alert('Error saving prospect');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this prospect?')) return;
        const { error } = await supabase
            .from('contacts' as any)
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting:', error);
            alert('Error deleting prospect');
        } else {
            fetchData();
        }
    };

    const filteredProspects = prospects.filter(c =>
        c.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.tin?.includes(searchTerm)
    );

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Target className="text-blue-600" />
                        Prospect Pipeline
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Manage potential customers and leads</p>
                </div>
                <button
                    onClick={() => {
                        setEditingProspect(null);
                        setFormData({ status: 'Prospect', is_customer: true });
                        setIsModalOpen(true);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors"
                >
                    <Plus size={18} />
                    Add Prospect
                </button>
            </div>

            {/* List */}
            <div className="p-6 flex-1 overflow-hidden flex flex-col">
                <div className="mb-4 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search prospects..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pb-4">
                    {filteredProspects.map(prospect => (
                        <div key={prospect.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all group relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-l from-white dark:from-gray-800">
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => {
                                            setEditingProspect(prospect);
                                            setFormData(prospect);
                                            setIsModalOpen(true);
                                        }}
                                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-blue-600"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(prospect.id)}
                                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-red-600"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-start gap-3 mb-3">
                                <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold shrink-0">
                                    {prospect.company.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-semibold text-gray-900 dark:text-white truncate pr-6">{prospect.company}</h3>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 mt-1">
                                        Prospect
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                                {prospect.customer_groups && (
                                    <div className="flex items-center gap-2">
                                        <Users size={14} />
                                        <span
                                            className="text-xs px-2 py-0.5 rounded-full"
                                            style={{
                                                backgroundColor: `${prospect.customer_groups.color}20`,
                                                color: prospect.customer_groups.color
                                            }}
                                        >
                                            {prospect.customer_groups.name}
                                        </span>
                                    </div>
                                )}
                                {prospect.address && (
                                    <div className="flex items-center gap-2">
                                        <MapPin size={14} />
                                        <span className="truncate">{prospect.address}</span>
                                    </div>
                                )}
                                {prospect.tin && (
                                    <div className="flex items-center gap-2">
                                        <Building2 size={14} />
                                        <span>TIN: {prospect.tin}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Modal/Drawer */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-4xl h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50 rounded-t-xl">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {editingProspect ? 'Edit Prospect' : 'Add New Prospect'}
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                <div className="space-y-4">
                                    <h4 className="font-medium text-gray-900 dark:text-white border-b pb-2 dark:border-gray-700">Basic Info</h4>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company Name</label>
                                        <input
                                            type="text"
                                            value={formData.company || ''}
                                            onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                                            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Customer Group</label>
                                        <select
                                            value={formData.customer_group_id || ''}
                                            onChange={(e) => setFormData({ ...formData, customer_group_id: e.target.value })}
                                            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        >
                                            <option value="">Select Group...</option>
                                            {groups.map(g => (
                                                <option key={g.id} value={g.id}>{g.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {/* Status is hidden/fixed to 'Prospect' but we keep input in logic */}

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">TIN</label>
                                        <input
                                            type="text"
                                            value={formData.tin || ''}
                                            onChange={(e) => setFormData({ ...formData, tin: e.target.value })}
                                            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="font-medium text-gray-900 dark:text-white border-b pb-2 dark:border-gray-700">Financial & Address</h4>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
                                        <textarea
                                            value={formData.address || ''}
                                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-24"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Terms</label>
                                            <input
                                                type="text"
                                                value={formData.terms || ''}
                                                onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                                                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Credit Limit</label>
                                            <input
                                                type="number"
                                                value={formData.creditLimit || ''}
                                                onChange={(e) => setFormData({ ...formData, creditLimit: Number(e.target.value) })}
                                                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Reuse Contact Persons from Customer Data */}
                            {editingProspect?.id && (
                                <div className="mt-8">
                                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                        <Users size={20} />
                                        Contact Persons
                                    </h4>
                                    <ContactPersons customerId={editingProspect.id} />
                                </div>
                            )}

                            {!editingProspect?.id && (
                                <div className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 rounded-lg text-sm">
                                    Please save the prospect details first to add contact persons.
                                </div>
                            )}
                        </div>

                        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3 rounded-b-xl">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
