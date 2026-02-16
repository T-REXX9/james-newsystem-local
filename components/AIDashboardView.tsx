import React, { useState, useEffect, useCallback } from 'react';
import {
    Bot, MessageSquare, AlertTriangle, TrendingUp, Clock,
    Users, CheckCircle, XCircle, ArrowUpRight, RefreshCw,
    Phone, Smile, Meh, Frown
} from 'lucide-react';
import { UserProfile, AIConversation, AIDashboardStats, AIEscalationWithDetails } from '../types';
import { fetchAIDashboardStats, fetchAIConversations, subscribeToAIConversations } from '../services/aiConversationService';
import { fetchPendingEscalations, subscribeToEscalations } from '../services/aiEscalationService';
import { useToast } from './ToastProvider';

interface AIDashboardViewProps {
    currentUser: UserProfile | null;
}

const AIDashboardView: React.FC<AIDashboardViewProps> = ({ currentUser }) => {
    const [stats, setStats] = useState<AIDashboardStats | null>(null);
    const [recentConversations, setRecentConversations] = useState<AIConversation[]>([]);
    const [pendingEscalations, setPendingEscalations] = useState<AIEscalationWithDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const { addToast } = useToast();

    const loadData = useCallback(async () => {
        try {
            const [statsData, conversationsData, escalationsData] = await Promise.all([
                fetchAIDashboardStats(),
                fetchAIConversations({ status: undefined }), // Get all recent
                fetchPendingEscalations(),
            ]);
            setStats(statsData);
            setRecentConversations(conversationsData.slice(0, 10));
            setPendingEscalations(escalationsData);
        } catch (error) {
            console.error('Error loading AI dashboard data:', error);
            addToast('Failed to load AI dashboard data', 'error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [addToast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        const unsubConv = subscribeToAIConversations(() => loadData());
        const unsubEsc = subscribeToEscalations(() => loadData());
        return () => {
            unsubConv();
            unsubEsc();
        };
    }, [loadData]);

    const handleRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const today = new Date();
        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        }
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    const getPurposeLabel = (purpose: string) => {
        const labels: Record<string, string> = {
            lead_gen: 'Lead Generation',
            inquiry: 'Inquiry',
            complaint: 'Complaint',
            delivery: 'Delivery',
            sales: 'Sales',
        };
        return labels[purpose] || purpose;
    };

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
            completed: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
            escalated: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
            abandoned: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        };
        return colors[status] || 'bg-slate-100 text-slate-600';
    };

    const getPriorityColor = (priority: string) => {
        const colors: Record<string, string> = {
            urgent: 'bg-red-500 text-white',
            high: 'bg-orange-500 text-white',
            normal: 'bg-blue-500 text-white',
            low: 'bg-slate-400 text-white',
        };
        return colors[priority] || 'bg-slate-400 text-white';
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
                        <Bot className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">AI Service Dashboard</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">24/7 Automated Customer Support via SMS</p>
                    </div>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    <span className="text-sm font-medium">Refresh</span>
                </button>
            </div>

            {/* AI Status Indicator */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-xl">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="w-4 h-4 bg-white rounded-full animate-pulse"></div>
                            <div className="absolute inset-0 w-4 h-4 bg-white rounded-full animate-ping opacity-75"></div>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">AI System Active</h2>
                            <p className="text-emerald-100">Handling SMS conversations in Tagalog</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-3xl font-bold">{stats?.active_conversations || 0}</p>
                        <p className="text-sm text-emerald-100">Active Conversations</p>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Today's Conversations"
                    value={stats?.today_conversations || 0}
                    icon={MessageSquare}
                    color="blue"
                />
                <StatCard
                    title="Escalation Rate"
                    value={`${stats?.escalation_rate || 0}%`}
                    icon={AlertTriangle}
                    color="amber"
                />
                <StatCard
                    title="Pending Escalations"
                    value={pendingEscalations.length}
                    icon={Users}
                    color="red"
                />
                <StatCard
                    title="Avg Response Time"
                    value={stats?.avg_response_time_seconds ? `${stats.avg_response_time_seconds}s` : 'N/A'}
                    icon={Clock}
                    color="green"
                />
            </div>

            {/* Sentiment & Purpose Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Sentiment Breakdown */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Sentiment (Last 7 Days)</h3>
                    <div className="space-y-3">
                        <SentimentBar
                            label="Positive"
                            value={stats?.sentiment_breakdown.positive || 0}
                            total={(stats?.sentiment_breakdown.positive || 0) + (stats?.sentiment_breakdown.neutral || 0) + (stats?.sentiment_breakdown.negative || 0)}
                            icon={Smile}
                            color="emerald"
                        />
                        <SentimentBar
                            label="Neutral"
                            value={stats?.sentiment_breakdown.neutral || 0}
                            total={(stats?.sentiment_breakdown.positive || 0) + (stats?.sentiment_breakdown.neutral || 0) + (stats?.sentiment_breakdown.negative || 0)}
                            icon={Meh}
                            color="slate"
                        />
                        <SentimentBar
                            label="Negative"
                            value={stats?.sentiment_breakdown.negative || 0}
                            total={(stats?.sentiment_breakdown.positive || 0) + (stats?.sentiment_breakdown.neutral || 0) + (stats?.sentiment_breakdown.negative || 0)}
                            icon={Frown}
                            color="red"
                        />
                    </div>
                </div>

                {/* Purpose Breakdown */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Conversation Purpose</h3>
                    <div className="space-y-2">
                        {Object.entries(stats?.purpose_breakdown || {}).map(([purpose, count]) => (
                            <div key={purpose} className="flex items-center justify-between py-2">
                                <span className="text-sm text-slate-600 dark:text-slate-400">{getPurposeLabel(purpose)}</span>
                                <span className="font-semibold text-slate-800 dark:text-white">{count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Conversations */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Recent Conversations</h3>
                        <button className="text-sm text-brand-blue hover:underline flex items-center gap-1">
                            View All <ArrowUpRight className="w-3 h-3" />
                        </button>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
                        {recentConversations.length === 0 ? (
                            <div className="p-6 text-center text-slate-500">
                                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <p>No conversations yet</p>
                                <p className="text-sm">AI conversations will appear here</p>
                            </div>
                        ) : (
                            recentConversations.map((conv) => (
                                <div key={conv.id} className="px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Phone className="w-4 h-4 text-slate-400" />
                                                <span className="font-medium text-slate-800 dark:text-white truncate">
                                                    {conv.contact?.company || conv.phone_number || 'Unknown'}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                                                {getPurposeLabel(conv.purpose)} • {conv.contact?.name || 'New Lead'}
                                            </p>
                                        </div>
                                        <div className="text-right ml-4">
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(conv.status)}`}>
                                                {conv.status}
                                            </span>
                                            <p className="text-xs text-slate-400 mt-1">
                                                {formatDate(conv.started_at)} {formatTime(conv.started_at)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Escalation Queue */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Escalation Queue</h3>
                        {pendingEscalations.length > 0 && (
                            <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-bold rounded-full">
                                {pendingEscalations.length} Pending
                            </span>
                        )}
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
                        {pendingEscalations.length === 0 ? (
                            <div className="p-6 text-center text-slate-500">
                                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-500 opacity-50" />
                                <p className="text-emerald-600 dark:text-emerald-400 font-medium">All Clear!</p>
                                <p className="text-sm">No pending escalations</p>
                            </div>
                        ) : (
                            pendingEscalations.map((esc) => (
                                <div key={esc.id} className="px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${getPriorityColor(esc.priority)}`}>
                                                    {esc.priority}
                                                </span>
                                                <span className="font-medium text-slate-800 dark:text-white truncate">
                                                    {esc.conversation?.contact?.company || esc.conversation?.phone_number || 'Unknown'}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                                {esc.reason.replace(/_/g, ' ')}
                                            </p>
                                        </div>
                                        <div className="text-right ml-4">
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${esc.status === 'pending'
                                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                }`}>
                                                {esc.status}
                                            </span>
                                            <p className="text-xs text-slate-400 mt-1">
                                                {formatTime(esc.created_at)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Stat Card Component
interface StatCardProps {
    title: string;
    value: number | string;
    icon: React.FC<{ className?: string }>;
    color: 'blue' | 'amber' | 'red' | 'green';
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, color }) => {
    const colorClasses = {
        blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
        amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
        red: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
        green: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
                    <Icon className="w-5 h-5" />
                </div>
            </div>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{value}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
        </div>
    );
};

// Sentiment Bar Component
interface SentimentBarProps {
    label: string;
    value: number;
    total: number;
    icon: React.FC<{ className?: string }>;
    color: 'emerald' | 'slate' | 'red';
}

const SentimentBar: React.FC<SentimentBarProps> = ({ label, value, total, icon: Icon, color }) => {
    const percentage = total > 0 ? Math.round((value / total) * 100) : 0;

    const colorClasses = {
        emerald: 'bg-emerald-500',
        slate: 'bg-slate-400',
        red: 'bg-red-500',
    };

    const iconClasses = {
        emerald: 'text-emerald-500',
        slate: 'text-slate-400',
        red: 'text-red-500',
    };

    return (
        <div className="flex items-center gap-3">
            <Icon className={`w-5 h-5 ${iconClasses[color]}`} />
            <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
                    <span className="text-sm font-medium text-slate-800 dark:text-white">{value} ({percentage}%)</span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                        className={`h-full ${colorClasses[color]} transition-all duration-500`}
                        style={{ width: `${percentage}%` }}
                    />
                </div>
            </div>
        </div>
    );
};

export default AIDashboardView;
