import React, { useState, useEffect, useCallback } from 'react';
import {
    AlertTriangle, User, Clock, CheckCircle, MessageSquare,
    Phone, ChevronDown, X, Send
} from 'lucide-react';
import { UserProfile, AIEscalationWithDetails, AIEscalationPriority, AIEscalationStatus } from '../types';
import {
    fetchPendingEscalations,
    fetchEscalations,
    assignEscalation,
    resolveEscalation,
    subscribeToEscalations,
} from '../services/aiEscalationService';
import { fetchProfiles } from '../services/supabaseService';
import { useToast } from './ToastProvider';

interface AIEscalationPanelProps {
    currentUser: UserProfile | null;
}

const AIEscalationPanel: React.FC<AIEscalationPanelProps> = ({ currentUser }) => {
    const [escalations, setEscalations] = useState<AIEscalationWithDetails[]>([]);
    const [agents, setAgents] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<AIEscalationStatus | 'all'>('pending');
    const [selectedEscalation, setSelectedEscalation] = useState<AIEscalationWithDetails | null>(null);
    const [showResolveModal, setShowResolveModal] = useState(false);
    const [resolutionNotes, setResolutionNotes] = useState('');
    const [processing, setProcessing] = useState<string | null>(null);
    const { addToast } = useToast();

    const loadData = useCallback(async () => {
        try {
            const [escalationsData, agentsData] = await Promise.all([
                statusFilter === 'pending' || statusFilter === 'in_progress'
                    ? fetchPendingEscalations()
                    : fetchEscalations(statusFilter === 'all' ? undefined : statusFilter),
                fetchProfiles(),
            ]);

            // Filter if not pending
            const filtered = statusFilter === 'all'
                ? escalationsData
                : escalationsData.filter(e => statusFilter === 'pending'
                    ? e.status === 'pending' || e.status === 'in_progress'
                    : e.status === statusFilter);

            setEscalations(filtered);
            setAgents(agentsData.filter(a => a.role === 'owner' || a.role === 'manager' || a.role === 'sales_agent'));
        } catch (error) {
            console.error('Error loading escalations:', error);
            addToast('Failed to load escalations', 'error');
        } finally {
            setLoading(false);
        }
    }, [statusFilter, addToast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        const unsub = subscribeToEscalations(() => loadData());
        return () => unsub();
    }, [loadData]);

    const handleAssign = async (escalationId: string, agentId: string) => {
        setProcessing(escalationId);
        try {
            await assignEscalation(escalationId, agentId);
            addToast('Escalation assigned successfully', 'success');
            loadData();
        } catch (error) {
            console.error('Error assigning escalation:', error);
            addToast('Failed to assign escalation', 'error');
        } finally {
            setProcessing(null);
        }
    };

    const handleResolve = async () => {
        if (!selectedEscalation) return;

        setProcessing(selectedEscalation.id);
        try {
            await resolveEscalation(selectedEscalation.id, resolutionNotes);
            addToast('Escalation resolved', 'success');
            setShowResolveModal(false);
            setSelectedEscalation(null);
            setResolutionNotes('');
            loadData();
        } catch (error) {
            console.error('Error resolving escalation:', error);
            addToast('Failed to resolve escalation', 'error');
        } finally {
            setProcessing(null);
        }
    };

    const openResolveModal = (escalation: AIEscalationWithDetails) => {
        setSelectedEscalation(escalation);
        setResolutionNotes('');
        setShowResolveModal(true);
    };

    const getPriorityColor = (priority: AIEscalationPriority) => {
        const colors: Record<AIEscalationPriority, string> = {
            urgent: 'bg-red-500 text-white',
            high: 'bg-orange-500 text-white',
            normal: 'bg-blue-500 text-white',
            low: 'bg-slate-400 text-white',
        };
        return colors[priority];
    };

    const getStatusColor = (status: AIEscalationStatus) => {
        const colors: Record<AIEscalationStatus, string> = {
            pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
            in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
            resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
        };
        return colors[status];
    };

    const getReasonLabel = (reason: string) => {
        const labels: Record<string, string> = {
            low_confidence: 'Low AI Confidence',
            customer_request: 'Customer Requested',
            complex_issue: 'Complex Issue',
            vip_customer: 'VIP Customer',
        };
        return labels[reason] || reason;
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        return date.toLocaleDateString();
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
                    <div className="p-2.5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg">
                        <AlertTriangle className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Escalation Queue</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">AI conversations requiring human attention</p>
                    </div>
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-1">
                    {(['pending', 'in_progress', 'resolved', 'all'] as const).map((status) => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${statusFilter === status
                                    ? 'bg-brand-blue text-white'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                        >
                            {status === 'in_progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                        {escalations.filter(e => e.status === 'pending').length}
                    </p>
                    <p className="text-sm text-amber-600 dark:text-amber-500">Pending</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                        {escalations.filter(e => e.status === 'in_progress').length}
                    </p>
                    <p className="text-sm text-blue-600 dark:text-blue-500">In Progress</p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                        {escalations.filter(e => e.status === 'resolved').length}
                    </p>
                    <p className="text-sm text-emerald-600 dark:text-emerald-500">Resolved Today</p>
                </div>
            </div>

            {/* Escalation List */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                {escalations.length === 0 ? (
                    <div className="p-12 text-center">
                        <CheckCircle className="w-16 h-16 mx-auto mb-4 text-emerald-500 opacity-50" />
                        <h3 className="text-lg font-semibold text-emerald-600 dark:text-emerald-400 mb-2">All Clear!</h3>
                        <p className="text-sm text-slate-500">No {statusFilter === 'all' ? '' : statusFilter} escalations</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {escalations.map((escalation) => (
                            <div key={escalation.id} className="p-5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <div className="flex items-start gap-4">
                                    {/* Priority Badge */}
                                    <div className={`px-2 py-1 rounded text-xs font-bold uppercase ${getPriorityColor(escalation.priority)}`}>
                                        {escalation.priority}
                                    </div>

                                    {/* Main Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Phone className="w-4 h-4 text-slate-400" />
                                            <span className="font-medium text-slate-800 dark:text-white">
                                                {escalation.conversation?.contact?.company || escalation.conversation?.phone_number || 'Unknown'}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(escalation.status)}`}>
                                                {escalation.status.replace('_', ' ')}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                                            Reason: <span className="font-medium">{getReasonLabel(escalation.reason)}</span>
                                        </p>

                                        {/* Assigned Agent */}
                                        {escalation.assigned_agent && (
                                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                                <User className="w-4 h-4" />
                                                <span>Assigned to: {escalation.assigned_agent.full_name}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Time */}
                                    <div className="text-right">
                                        <p className="text-xs text-slate-400 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {formatTime(escalation.created_at)}
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2">
                                        {escalation.status === 'pending' && (
                                            <div className="relative">
                                                <select
                                                    onChange={(e) => e.target.value && handleAssign(escalation.id, e.target.value)}
                                                    disabled={processing === escalation.id}
                                                    className="appearance-none pl-3 pr-8 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm cursor-pointer focus:ring-2 focus:ring-brand-blue/20 outline-none disabled:opacity-50"
                                                    defaultValue=""
                                                >
                                                    <option value="" disabled>Assign to...</option>
                                                    {agents.map(agent => (
                                                        <option key={agent.id} value={agent.id}>{agent.full_name}</option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                            </div>
                                        )}

                                        {(escalation.status === 'pending' || escalation.status === 'in_progress') && (
                                            <button
                                                onClick={() => openResolveModal(escalation)}
                                                disabled={processing === escalation.id}
                                                className="px-3 py-2 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
                                            >
                                                Resolve
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Resolve Modal */}
            {showResolveModal && selectedEscalation && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Resolve Escalation</h3>
                            <button onClick={() => setShowResolveModal(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        <div className="px-6 py-4">
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                                Resolving escalation for <span className="font-medium">{selectedEscalation.conversation?.contact?.company || 'Unknown Customer'}</span>
                            </p>

                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                Resolution Notes (Optional)
                            </label>
                            <textarea
                                value={resolutionNotes}
                                onChange={(e) => setResolutionNotes(e.target.value)}
                                placeholder="Describe how the issue was resolved..."
                                rows={4}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none resize-none"
                            />
                        </div>

                        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                            <button
                                onClick={() => setShowResolveModal(false)}
                                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleResolve}
                                disabled={processing === selectedEscalation.id}
                                className="flex items-center gap-2 px-5 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-50"
                            >
                                <CheckCircle className="w-4 h-4" />
                                {processing === selectedEscalation.id ? 'Resolving...' : 'Mark Resolved'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AIEscalationPanel;
