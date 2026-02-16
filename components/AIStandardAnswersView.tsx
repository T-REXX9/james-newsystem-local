import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Bot, Plus, Search, Filter, Edit2, Trash2, X, Save,
    ToggleLeft, ToggleRight, Tag, MessageSquare, ChevronDown
} from 'lucide-react';
import { UserProfile, AIStandardAnswer, CreateAIStandardAnswerInput, UpdateAIStandardAnswerInput } from '../types';
import {
    fetchStandardAnswers,
    fetchStandardAnswerCategories,
    createStandardAnswer,
    updateStandardAnswer,
    deleteStandardAnswer,
    toggleStandardAnswerActive,
} from '../services/aiStandardAnswerService';
import { useToast } from './ToastProvider';

interface AIStandardAnswersViewProps {
    currentUser: UserProfile | null;
}

const PREDEFINED_CATEGORIES = [
    'greeting',
    'inquiry',
    'pricing',
    'complaint',
    'delivery',
    'returns',
    'followup',
    'farewell',
    'other',
];

const AIStandardAnswersView: React.FC<AIStandardAnswersViewProps> = ({ currentUser }) => {
    const [answers, setAnswers] = useState<AIStandardAnswer[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('');
    const [filterActive, setFilterActive] = useState<boolean | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editingAnswer, setEditingAnswer] = useState<AIStandardAnswer | null>(null);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const { addToast } = useToast();

    // Form state
    const [form, setForm] = useState<CreateAIStandardAnswerInput>({
        category: '',
        trigger_keywords: [],
        question_template: '',
        answer_template: '',
        variables: {},
        priority: 0,
    });
    const [keywordInput, setKeywordInput] = useState('');

    const loadData = useCallback(async () => {
        try {
            const [answersData, categoriesData] = await Promise.all([
                fetchStandardAnswers(),
                fetchStandardAnswerCategories(),
            ]);
            setAnswers(answersData);
            setCategories([...new Set([...PREDEFINED_CATEGORIES, ...categoriesData])]);
        } catch (error) {
            console.error('Error loading standard answers:', error);
            addToast('Failed to load standard answers', 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const filteredAnswers = useMemo(() => {
        return answers.filter(answer => {
            const matchesSearch = searchQuery.trim() === '' ||
                answer.question_template.toLowerCase().includes(searchQuery.toLowerCase()) ||
                answer.answer_template.toLowerCase().includes(searchQuery.toLowerCase()) ||
                answer.trigger_keywords.some(kw => kw.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesCategory = !filterCategory || answer.category === filterCategory;
            const matchesActive = filterActive === null || answer.is_active === filterActive;

            return matchesSearch && matchesCategory && matchesActive;
        });
    }, [answers, searchQuery, filterCategory, filterActive]);

    const resetForm = () => {
        setForm({
            category: '',
            trigger_keywords: [],
            question_template: '',
            answer_template: '',
            variables: {},
            priority: 0,
        });
        setKeywordInput('');
        setEditingAnswer(null);
    };

    const openCreateModal = () => {
        resetForm();
        setShowModal(true);
    };

    const openEditModal = (answer: AIStandardAnswer) => {
        setEditingAnswer(answer);
        setForm({
            category: answer.category,
            trigger_keywords: answer.trigger_keywords,
            question_template: answer.question_template,
            answer_template: answer.answer_template,
            variables: answer.variables,
            priority: answer.priority,
        });
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        resetForm();
    };

    const handleAddKeyword = () => {
        if (keywordInput.trim() && !form.trigger_keywords.includes(keywordInput.trim().toLowerCase())) {
            setForm(prev => ({
                ...prev,
                trigger_keywords: [...prev.trigger_keywords, keywordInput.trim().toLowerCase()],
            }));
            setKeywordInput('');
        }
    };

    const handleRemoveKeyword = (keyword: string) => {
        setForm(prev => ({
            ...prev,
            trigger_keywords: prev.trigger_keywords.filter(kw => kw !== keyword),
        }));
    };

    const handleSave = async () => {
        if (!form.category || !form.question_template || !form.answer_template) {
            addToast('Please fill in all required fields', 'error');
            return;
        }

        if (!currentUser) {
            addToast('User not authenticated', 'error');
            return;
        }

        setSaving(true);
        try {
            if (editingAnswer) {
                const updates: UpdateAIStandardAnswerInput = {
                    category: form.category,
                    trigger_keywords: form.trigger_keywords,
                    question_template: form.question_template,
                    answer_template: form.answer_template,
                    variables: form.variables,
                    priority: form.priority,
                };
                await updateStandardAnswer(editingAnswer.id, updates);
                addToast('Standard answer updated successfully', 'success');
            } else {
                await createStandardAnswer(form, currentUser.id);
                addToast('Standard answer created successfully', 'success');
            }
            closeModal();
            loadData();
        } catch (error) {
            console.error('Error saving standard answer:', error);
            addToast('Failed to save standard answer', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this standard answer?')) return;

        setDeleting(id);
        try {
            await deleteStandardAnswer(id);
            addToast('Standard answer deleted', 'success');
            loadData();
        } catch (error) {
            console.error('Error deleting standard answer:', error);
            addToast('Failed to delete standard answer', 'error');
        } finally {
            setDeleting(null);
        }
    };

    const handleToggleActive = async (answer: AIStandardAnswer) => {
        try {
            await toggleStandardAnswerActive(answer.id, !answer.is_active);
            addToast(`Answer ${answer.is_active ? 'disabled' : 'enabled'}`, 'success');
            loadData();
        } catch (error) {
            console.error('Error toggling answer status:', error);
            addToast('Failed to update status', 'error');
        }
    };

    const getCategoryColor = (category: string) => {
        const colors: Record<string, string> = {
            greeting: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
            inquiry: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
            pricing: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
            complaint: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
            delivery: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
            returns: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
            followup: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
            farewell: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
        };
        return colors[category] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
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
                    <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg">
                        <MessageSquare className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Standard Answers</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Manage Tagalog Q&A responses for AI</p>
                    </div>
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 px-4 py-2.5 bg-brand-blue text-white rounded-xl hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/25"
                >
                    <Plus className="w-5 h-5" />
                    <span className="font-medium">Add Answer</span>
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[240px] max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search questions, answers, or keywords..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none"
                    />
                </div>

                <div className="relative">
                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="appearance-none pl-4 pr-10 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm cursor-pointer focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none"
                    >
                        <option value="">All Categories</option>
                        {categories.map(cat => (
                            <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>

                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-1">
                    <button
                        onClick={() => setFilterActive(null)}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${filterActive === null ? 'bg-brand-blue text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setFilterActive(true)}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${filterActive === true ? 'bg-emerald-500 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                        Active
                    </button>
                    <button
                        onClick={() => setFilterActive(false)}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${filterActive === false ? 'bg-slate-500 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                        Inactive
                    </button>
                </div>
            </div>

            {/* Results count */}
            <p className="text-sm text-slate-500 dark:text-slate-400">
                Showing {filteredAnswers.length} of {answers.length} answers
            </p>

            {/* Answers Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredAnswers.length === 0 ? (
                    <div className="col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
                        <Bot className="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                        <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-400 mb-2">No Answers Found</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-500 mb-4">
                            {answers.length === 0 ? 'Start by adding your first standard answer.' : 'Try adjusting your search or filters.'}
                        </p>
                        {answers.length === 0 && (
                            <button
                                onClick={openCreateModal}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-blue text-white rounded-lg hover:bg-blue-600 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                Add First Answer
                            </button>
                        )}
                    </div>
                ) : (
                    filteredAnswers.map(answer => (
                        <div
                            key={answer.id}
                            className={`bg-white dark:bg-slate-900 rounded-2xl border ${answer.is_active ? 'border-slate-200 dark:border-slate-800' : 'border-slate-200 dark:border-slate-800 opacity-60'} p-5 shadow-sm hover:shadow-md transition-shadow`}
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${getCategoryColor(answer.category)}`}>
                                        {answer.category}
                                    </span>
                                    {answer.priority > 0 && (
                                        <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs rounded">
                                            Priority: {answer.priority}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => handleToggleActive(answer)}
                                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                        title={answer.is_active ? 'Disable' : 'Enable'}
                                    >
                                        {answer.is_active ? (
                                            <ToggleRight className="w-5 h-5 text-emerald-500" />
                                        ) : (
                                            <ToggleLeft className="w-5 h-5 text-slate-400" />
                                        )}
                                    </button>
                                    <button
                                        onClick={() => openEditModal(answer)}
                                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                        title="Edit"
                                    >
                                        <Edit2 className="w-4 h-4 text-slate-500" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(answer.id)}
                                        disabled={deleting === answer.id}
                                        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        title="Delete"
                                    >
                                        <Trash2 className={`w-4 h-4 ${deleting === answer.id ? 'animate-spin text-red-300' : 'text-red-500'}`} />
                                    </button>
                                </div>
                            </div>

                            {/* Question */}
                            <div className="mb-3">
                                <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">QUESTION (Tagalog)</p>
                                <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">{answer.question_template}</p>
                            </div>

                            {/* Answer */}
                            <div className="mb-3">
                                <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">ANSWER (Tagalog)</p>
                                <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-3">{answer.answer_template}</p>
                            </div>

                            {/* Keywords */}
                            {answer.trigger_keywords.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                    {answer.trigger_keywords.slice(0, 5).map(kw => (
                                        <span key={kw} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs rounded-md">
                                            <Tag className="w-3 h-3" />
                                            {kw}
                                        </span>
                                    ))}
                                    {answer.trigger_keywords.length > 5 && (
                                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs rounded-md">
                                            +{answer.trigger_keywords.length - 5} more
                                        </span>
                                    )}
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
                                {editingAnswer ? 'Edit Standard Answer' : 'Create Standard Answer'}
                            </h3>
                            <button onClick={closeModal} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
                            {/* Category */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                    Category <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={form.category}
                                    onChange={(e) => setForm(prev => ({ ...prev, category: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none"
                                >
                                    <option value="">Select category...</option>
                                    {categories.map(cat => (
                                        <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Question Template */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                    Question Template (Tagalog) <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={form.question_template}
                                    onChange={(e) => setForm(prev => ({ ...prev, question_template: e.target.value }))}
                                    placeholder="E.g., Magkano po ang..."
                                    rows={2}
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none resize-none"
                                />
                            </div>

                            {/* Answer Template */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                    Answer Template (Tagalog) <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={form.answer_template}
                                    onChange={(e) => setForm(prev => ({ ...prev, answer_template: e.target.value }))}
                                    placeholder="E.g., Magandang araw po! Ang presyo ng {{product}} ay..."
                                    rows={4}
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none resize-none"
                                />
                                <p className="mt-1 text-xs text-slate-500">
                                    Use {'{{variable_name}}'} for dynamic content
                                </p>
                            </div>

                            {/* Trigger Keywords */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                    Trigger Keywords
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={keywordInput}
                                        onChange={(e) => setKeywordInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddKeyword())}
                                        placeholder="Add keyword and press Enter"
                                        className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddKeyword}
                                        className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                    >
                                        Add
                                    </button>
                                </div>
                                {form.trigger_keywords.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {form.trigger_keywords.map(kw => (
                                            <span key={kw} className="inline-flex items-center gap-1 px-2 py-1 bg-brand-blue/10 text-brand-blue text-sm rounded-lg">
                                                {kw}
                                                <button onClick={() => handleRemoveKeyword(kw)} className="hover:text-red-500">
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Priority */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                    Priority (Higher = Preferred)
                                </label>
                                <input
                                    type="number"
                                    value={form.priority}
                                    onChange={(e) => setForm(prev => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
                                    min={0}
                                    max={100}
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none"
                                />
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
                                {saving ? 'Saving...' : editingAnswer ? 'Update' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AIStandardAnswersView;
