import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Gift, Plus, Search, Edit2, Trash2, X, Save,
    ToggleLeft, ToggleRight, Users, TrendingUp, DollarSign,
    ChevronDown, Calendar, Percent, Award
} from 'lucide-react';
import { UserProfile, LoyaltyDiscountRule, CreateLoyaltyDiscountRuleDTO } from '../types';
import * as loyaltyDiscountService from '../services/loyaltyDiscountService';
import { useToast } from './ToastProvider';

interface LoyaltyDiscountRulesViewProps {
    currentUser: UserProfile | null;
}

const LoyaltyDiscountRulesView: React.FC<LoyaltyDiscountRulesViewProps> = ({ currentUser }) => {
    const [rules, setRules] = useState<LoyaltyDiscountRule[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingRule, setEditingRule] = useState<LoyaltyDiscountRule | null>(null);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const { addToast } = useToast();

    // Form state
    const [form, setForm] = useState<CreateLoyaltyDiscountRuleDTO>({
        name: '',
        description: '',
        min_purchase_amount: 30000,
        discount_percentage: 5,
        evaluation_period: 'calendar_month',
        priority: 0,
    });

    const loadData = useCallback(async () => {
        try {
            const [rulesData, statsData] = await Promise.all([
                loyaltyDiscountService.getAllRules(true),
                loyaltyDiscountService.getLoyaltyDiscountStats(),
            ]);
            setRules(rulesData);
            setStats(statsData);
        } catch (error) {
            console.error('Error loading loyalty discount rules:', error);
            addToast('Failed to load discount rules', 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const filteredRules = useMemo(() => {
        return rules.filter(rule => {
            const matchesSearch = searchQuery.trim() === '' ||
                rule.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (rule.description?.toLowerCase().includes(searchQuery.toLowerCase()));
            return matchesSearch;
        });
    }, [rules, searchQuery]);

    const resetForm = () => {
        setForm({
            name: '',
            description: '',
            min_purchase_amount: 30000,
            discount_percentage: 5,
            evaluation_period: 'calendar_month',
            priority: 0,
        });
        setEditingRule(null);
    };

    const openCreateModal = () => {
        resetForm();
        setShowModal(true);
    };

    const openEditModal = (rule: LoyaltyDiscountRule) => {
        setEditingRule(rule);
        setForm({
            name: rule.name,
            description: rule.description || '',
            min_purchase_amount: rule.min_purchase_amount,
            discount_percentage: rule.discount_percentage,
            evaluation_period: rule.evaluation_period,
            priority: rule.priority,
        });
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        resetForm();
    };

    const handleSave = async () => {
        if (!form.name || form.min_purchase_amount <= 0 || form.discount_percentage <= 0) {
            addToast('Please fill in all required fields with valid values', 'error');
            return;
        }

        if (!currentUser) {
            addToast('User not authenticated', 'error');
            return;
        }

        setSaving(true);
        try {
            if (editingRule) {
                await loyaltyDiscountService.updateRule(editingRule.id, form);
                addToast('Discount rule updated successfully', 'success');
            } else {
                await loyaltyDiscountService.createRule(form, currentUser.id);
                addToast('Discount rule created successfully', 'success');
            }
            closeModal();
            loadData();
        } catch (error) {
            console.error('Error saving discount rule:', error);
            addToast('Failed to save discount rule', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this discount rule?')) return;

        setDeleting(id);
        try {
            await loyaltyDiscountService.deleteRule(id);
            addToast('Discount rule deleted', 'success');
            loadData();
        } catch (error) {
            console.error('Error deleting discount rule:', error);
            addToast('Failed to delete discount rule', 'error');
        } finally {
            setDeleting(null);
        }
    };

    const handleToggleActive = async (rule: LoyaltyDiscountRule) => {
        try {
            await loyaltyDiscountService.updateRule(rule.id, { is_active: !rule.is_active });
            addToast(`Rule ${rule.is_active ? 'disabled' : 'enabled'}`, 'success');
            loadData();
        } catch (error) {
            console.error('Error toggling rule status:', error);
            addToast('Failed to update status', 'error');
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency: 'PHP',
            minimumFractionDigits: 0,
        }).format(amount);
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
                    <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl shadow-lg">
                        <Gift className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Loyalty Discounts</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Manage regular buyer discount rules</p>
                    </div>
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 px-4 py-2.5 bg-brand-blue text-white rounded-xl hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/25"
                >
                    <Plus className="w-5 h-5" />
                    <span className="font-medium">Add Rule</span>
                </button>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                <Award className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Active Rules</p>
                                <p className="text-xl font-bold text-slate-800 dark:text-white">{stats.total_active_rules}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                                <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Eligible This Month</p>
                                <p className="text-xl font-bold text-slate-800 dark:text-white">{stats.clients_eligible_this_month}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
                                <DollarSign className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Discount Given</p>
                                <p className="text-xl font-bold text-slate-800 dark:text-white">{formatCurrency(stats.total_discount_given_this_month)}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                                <TrendingUp className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Top Qualifiers</p>
                                <p className="text-xl font-bold text-slate-800 dark:text-white">{stats.top_qualifying_clients?.length || 0}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                    type="text"
                    placeholder="Search discount rules..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none"
                />
            </div>

            {/* Rules List */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredRules.length === 0 ? (
                    <div className="col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
                        <Gift className="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                        <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-400 mb-2">No Discount Rules</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-500 mb-4">
                            Create your first loyalty discount rule to reward regular buyers.
                        </p>
                        <button
                            onClick={openCreateModal}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-blue text-white rounded-lg hover:bg-blue-600 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Create First Rule
                        </button>
                    </div>
                ) : (
                    filteredRules.map(rule => (
                        <div
                            key={rule.id}
                            className={`bg-white dark:bg-slate-900 rounded-2xl border ${rule.is_active ? 'border-slate-200 dark:border-slate-800' : 'border-slate-200 dark:border-slate-800 opacity-60'} p-5 shadow-sm hover:shadow-md transition-shadow`}
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <h3 className="font-semibold text-slate-800 dark:text-white">{rule.name}</h3>
                                    {rule.description && (
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{rule.description}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => handleToggleActive(rule)}
                                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                        title={rule.is_active ? 'Disable' : 'Enable'}
                                    >
                                        {rule.is_active ? (
                                            <ToggleRight className="w-5 h-5 text-emerald-500" />
                                        ) : (
                                            <ToggleLeft className="w-5 h-5 text-slate-400" />
                                        )}
                                    </button>
                                    <button
                                        onClick={() => openEditModal(rule)}
                                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                        title="Edit"
                                    >
                                        <Edit2 className="w-4 h-4 text-slate-500" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(rule.id)}
                                        disabled={deleting === rule.id}
                                        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        title="Delete"
                                    >
                                        <Trash2 className={`w-4 h-4 ${deleting === rule.id ? 'animate-spin text-red-300' : 'text-red-500'}`} />
                                    </button>
                                </div>
                            </div>

                            {/* Rule Details */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                                        <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500">Min. Purchase</p>
                                        <p className="font-semibold text-slate-800 dark:text-white">{formatCurrency(rule.min_purchase_amount)}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
                                        <Percent className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500">Discount</p>
                                        <p className="font-semibold text-slate-800 dark:text-white">{rule.discount_percentage}%</p>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs rounded-md">
                                    <Calendar className="w-3 h-3" />
                                    {rule.evaluation_period === 'calendar_month' ? 'Monthly' : 'Rolling 30 Days'}
                                </span>
                                {rule.priority > 0 && (
                                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                                        Priority: {rule.priority}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-hidden flex flex-col">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                                {editingRule ? 'Edit Discount Rule' : 'Create Discount Rule'}
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
                                    Rule Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="e.g., Gold Tier Discount"
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                    Description
                                </label>
                                <textarea
                                    value={form.description}
                                    onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Describe when this discount applies..."
                                    rows={2}
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none resize-none"
                                />
                            </div>

                            {/* Min Purchase and Discount */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                        Min. Purchase (₱) <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        value={form.min_purchase_amount}
                                        onChange={(e) => setForm(prev => ({ ...prev, min_purchase_amount: parseFloat(e.target.value) || 0 }))}
                                        min={0}
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                        Discount (%) <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        value={form.discount_percentage}
                                        onChange={(e) => setForm(prev => ({ ...prev, discount_percentage: parseFloat(e.target.value) || 0 }))}
                                        min={0.1}
                                        max={100}
                                        step={0.5}
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none"
                                    />
                                </div>
                            </div>

                            {/* Evaluation Period */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                    Evaluation Period
                                </label>
                                <div className="relative">
                                    <select
                                        value={form.evaluation_period}
                                        onChange={(e) => setForm(prev => ({ ...prev, evaluation_period: e.target.value as 'calendar_month' | 'rolling_30_days' }))}
                                        className="w-full appearance-none px-4 py-2.5 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm cursor-pointer focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none"
                                    >
                                        <option value="calendar_month">Calendar Month</option>
                                        <option value="rolling_30_days">Rolling 30 Days</option>
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>
                            </div>

                            {/* Priority */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                    Priority (Higher = Evaluated First)
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

                            {/* Info */}
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/50 rounded-lg">
                                <p className="text-xs text-blue-700 dark:text-blue-300">
                                    Clients who meet the minimum purchase threshold during the evaluation period will receive the discount on their next month's purchases.
                                </p>
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
                                {saving ? 'Saving...' : editingRule ? 'Update' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LoyaltyDiscountRulesView;
