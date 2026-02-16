import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    MessageSquare, Plus, Search, Edit2, Trash2, X, Save,
    ToggleLeft, ToggleRight, Tag, Languages, ChevronDown, Code
} from 'lucide-react';
import { UserProfile, AIMessageTemplate, CreateAIMessageTemplateDTO } from '../types';
import * as aiSalesAgentService from '../services/aiSalesAgentService';
import { useToast } from './ToastProvider';

interface AIMessageTemplatesViewProps {
    currentUser: UserProfile | null;
}

const TEMPLATE_TYPES = [
    'greeting',
    'promo_intro',
    'follow_up',
    'closing',
    'objection_handling',
    'pricing',
    'availability',
    'other'
];

const AIMessageTemplatesView: React.FC<AIMessageTemplatesViewProps> = ({ currentUser }) => {
    const [templates, setTemplates] = useState<AIMessageTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterLanguage, setFilterLanguage] = useState<'tagalog' | 'english' | ''>('');
    const [filterType, setFilterType] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<AIMessageTemplate | null>(null);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const { addToast } = useToast();

    // Form state
    const [form, setForm] = useState<CreateAIMessageTemplateDTO>({
        name: '',
        language: 'tagalog',
        template_type: '',
        content: '',
        variables: [],
    });
    const [variableInput, setVariableInput] = useState('');

    const loadData = useCallback(async () => {
        try {
            const data = await aiSalesAgentService.getMessageTemplates(
                filterLanguage || undefined
            );
            setTemplates(data);
        } catch (error) {
            console.error('Error loading message templates:', error);
            addToast('Failed to load templates', 'error');
        } finally {
            setLoading(false);
        }
    }, [filterLanguage, addToast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const filteredTemplates = useMemo(() => {
        return templates.filter(template => {
            const matchesSearch = searchQuery.trim() === '' ||
                template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                template.content.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesType = !filterType || template.template_type === filterType;
            return matchesSearch && matchesType;
        });
    }, [templates, searchQuery, filterType]);

    const resetForm = () => {
        setForm({
            name: '',
            language: 'tagalog',
            template_type: '',
            content: '',
            variables: [],
        });
        setVariableInput('');
        setEditingTemplate(null);
    };

    const openCreateModal = () => {
        resetForm();
        setShowModal(true);
    };

    const openEditModal = (template: AIMessageTemplate) => {
        setEditingTemplate(template);
        setForm({
            name: template.name,
            language: template.language,
            template_type: template.template_type,
            content: template.content,
            variables: template.variables,
        });
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        resetForm();
    };

    const handleAddVariable = () => {
        const varName = variableInput.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
        if (varName && !form.variables.includes(varName)) {
            setForm(prev => ({
                ...prev,
                variables: [...prev.variables, varName],
            }));
            setVariableInput('');
        }
    };

    const handleRemoveVariable = (variable: string) => {
        setForm(prev => ({
            ...prev,
            variables: prev.variables.filter(v => v !== variable),
        }));
    };

    const handleSave = async () => {
        if (!form.name || !form.template_type || !form.content) {
            addToast('Please fill in all required fields', 'error');
            return;
        }

        if (!currentUser) {
            addToast('User not authenticated', 'error');
            return;
        }

        setSaving(true);
        try {
            if (editingTemplate) {
                await aiSalesAgentService.updateMessageTemplate(editingTemplate.id, form);
                addToast('Template updated successfully', 'success');
            } else {
                await aiSalesAgentService.createMessageTemplate(form, currentUser.id);
                addToast('Template created successfully', 'success');
            }
            closeModal();
            loadData();
        } catch (error) {
            console.error('Error saving template:', error);
            addToast('Failed to save template', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this template?')) return;

        setDeleting(id);
        try {
            await aiSalesAgentService.deleteMessageTemplate(id);
            addToast('Template deleted', 'success');
            loadData();
        } catch (error) {
            console.error('Error deleting template:', error);
            addToast('Failed to delete template', 'error');
        } finally {
            setDeleting(null);
        }
    };

    const handleToggleActive = async (template: AIMessageTemplate) => {
        try {
            await aiSalesAgentService.updateMessageTemplate(template.id, { is_active: !template.is_active });
            addToast(`Template ${template.is_active ? 'disabled' : 'enabled'}`, 'success');
            loadData();
        } catch (error) {
            console.error('Error toggling template status:', error);
            addToast('Failed to update status', 'error');
        }
    };

    const getTypeColor = (type: string) => {
        const colors: Record<string, string> = {
            greeting: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
            promo_intro: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
            follow_up: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
            closing: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
            objection_handling: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
            pricing: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
            availability: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
        };
        return colors[type] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue"></div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
                        <MessageSquare className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">AI Message Templates</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Manage bilingual message templates</p>
                    </div>
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 px-4 py-2.5 bg-brand-blue text-white rounded-xl hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/25"
                >
                    <Plus className="w-5 h-5" />
                    <span className="font-medium">Add Template</span>
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[240px] max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search templates..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none"
                    />
                </div>

                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-1">
                    <button
                        onClick={() => setFilterLanguage('')}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${filterLanguage === '' ? 'bg-brand-blue text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setFilterLanguage('tagalog')}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1 ${filterLanguage === 'tagalog' ? 'bg-violet-500 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                        🇵🇭 Tagalog
                    </button>
                    <button
                        onClick={() => setFilterLanguage('english')}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1 ${filterLanguage === 'english' ? 'bg-blue-500 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                        🇺🇸 English
                    </button>
                </div>

                <div className="relative">
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="appearance-none pl-4 pr-10 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm cursor-pointer focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none"
                    >
                        <option value="">All Types</option>
                        {TEMPLATE_TYPES.map(type => (
                            <option key={type} value={type}>{type.replace('_', ' ')}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
            </div>

            {/* Results count */}
            <p className="text-sm text-slate-500 dark:text-slate-400">
                Showing {filteredTemplates.length} of {templates.length} templates
            </p>

            {/* Templates Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredTemplates.length === 0 ? (
                    <div className="col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
                        <MessageSquare className="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                        <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-400 mb-2">No Templates Found</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-500 mb-4">
                            {templates.length === 0 ? 'Start by adding your first message template.' : 'Try adjusting your search or filters.'}
                        </p>
                        {templates.length === 0 && (
                            <button
                                onClick={openCreateModal}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-blue text-white rounded-lg hover:bg-blue-600 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                Add First Template
                            </button>
                        )}
                    </div>
                ) : (
                    filteredTemplates.map(template => (
                        <div
                            key={template.id}
                            className={`bg-white dark:bg-slate-900 rounded-2xl border ${template.is_active ? 'border-slate-200 dark:border-slate-800' : 'border-slate-200 dark:border-slate-800 opacity-60'} p-5 shadow-sm hover:shadow-md transition-shadow`}
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${template.language === 'tagalog' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                                        <Languages className="w-3 h-3" />
                                        {template.language}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${getTypeColor(template.template_type)}`}>
                                        {template.template_type.replace('_', ' ')}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => handleToggleActive(template)}
                                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                        title={template.is_active ? 'Disable' : 'Enable'}
                                    >
                                        {template.is_active ? (
                                            <ToggleRight className="w-5 h-5 text-emerald-500" />
                                        ) : (
                                            <ToggleLeft className="w-5 h-5 text-slate-400" />
                                        )}
                                    </button>
                                    <button
                                        onClick={() => openEditModal(template)}
                                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                        title="Edit"
                                    >
                                        <Edit2 className="w-4 h-4 text-slate-500" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(template.id)}
                                        disabled={deleting === template.id}
                                        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        title="Delete"
                                    >
                                        <Trash2 className={`w-4 h-4 ${deleting === template.id ? 'animate-spin text-red-300' : 'text-red-500'}`} />
                                    </button>
                                </div>
                            </div>

                            {/* Name */}
                            <h3 className="font-semibold text-slate-800 dark:text-white mb-2">{template.name}</h3>

                            {/* Content */}
                            <div className="mb-3">
                                <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3">{template.content}</p>
                            </div>

                            {/* Variables */}
                            {template.variables.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                    {template.variables.map(variable => (
                                        <span key={variable} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs rounded-md font-mono">
                                            <Code className="w-3 h-3" />
                                            {`{${variable}}`}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-hidden flex flex-col">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                                {editingTemplate ? 'Edit Template' : 'Create Template'}
                            </h3>
                            <button onClick={closeModal} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
                            {/* Name */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                    Template Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="e.g., Tagalog Greeting"
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none"
                                />
                            </div>

                            {/* Language and Type */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                        Language <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={form.language}
                                            onChange={(e) => setForm(prev => ({ ...prev, language: e.target.value as 'tagalog' | 'english' }))}
                                            className="w-full appearance-none px-4 py-2.5 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm cursor-pointer focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none"
                                        >
                                            <option value="tagalog">🇵🇭 Tagalog</option>
                                            <option value="english">🇺🇸 English</option>
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                        Type <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={form.template_type}
                                            onChange={(e) => setForm(prev => ({ ...prev, template_type: e.target.value }))}
                                            className="w-full appearance-none px-4 py-2.5 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm cursor-pointer focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none"
                                        >
                                            <option value="">Select type...</option>
                                            {TEMPLATE_TYPES.map(type => (
                                                <option key={type} value={type}>{type.replace('_', ' ')}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>
                            </div>

                            {/* Content */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                    Message Content <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={form.content}
                                    onChange={(e) => setForm(prev => ({ ...prev, content: e.target.value }))}
                                    placeholder={form.language === 'tagalog' ? "E.g., Magandang araw po, {client_name}!" : "E.g., Good day, {client_name}!"}
                                    rows={5}
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none resize-none"
                                />
                                <p className="mt-1 text-xs text-slate-500">
                                    Use {'{variable_name}'} for dynamic content
                                </p>
                            </div>

                            {/* Variables */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                    Variables
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={variableInput}
                                        onChange={(e) => setVariableInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddVariable())}
                                        placeholder="Add variable name and press Enter"
                                        className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddVariable}
                                        className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                    >
                                        Add
                                    </button>
                                </div>
                                {form.variables.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {form.variables.map(variable => (
                                            <span key={variable} className="inline-flex items-center gap-1 px-2 py-1 bg-brand-blue/10 text-brand-blue text-sm rounded-lg">
                                                <Code className="w-3 h-3" />
                                                {`{${variable}}`}
                                                <button onClick={() => handleRemoveVariable(variable)} className="hover:text-red-500">
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 flex-shrink-0">
                            <button
                                onClick={closeModal}
                                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center gap-2 px-5 py-2 bg-brand-blue text-white rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Save className="w-4 h-4" />
                                {saving ? 'Saving...' : editingTemplate ? 'Update' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AIMessageTemplatesView;
