import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Bot, Send, Users, Phone, MessageSquare, Search,
    Filter, ChevronDown, CheckCircle2, Clock, XCircle,
    TrendingUp, ThumbsUp, ThumbsDown, Minus,
    RefreshCw, Megaphone, Languages
} from 'lucide-react';
import { UserProfile, AICampaignOutreach, AICampaignStats, AIMessageLanguage } from '../types';
import * as aiSalesAgentService from '../services/aiSalesAgentService';
import { useToast } from './ToastProvider';

interface AICampaignOutreachPanelProps {
    currentUser: UserProfile | null;
    campaignId: string;
    campaignTitle: string;
}

const AICampaignOutreachPanel: React.FC<AICampaignOutreachPanelProps> = ({
    currentUser,
    campaignId,
    campaignTitle,
}) => {
    const [outreachList, setOutreachList] = useState<AICampaignOutreach[]>([]);
    const [stats, setStats] = useState<AICampaignStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [processing, setProcessing] = useState(false);
    const { addToast } = useToast();

    const loadData = useCallback(async () => {
        try {
            const [outreach, statsData] = await Promise.all([
                aiSalesAgentService.getCampaignOutreach(campaignId, { status: statusFilter || undefined }),
                aiSalesAgentService.getCampaignStats(campaignId),
            ]);
            setOutreachList(outreach);
            setStats(statsData);
        } catch (error) {
            console.error('Error loading outreach data:', error);
            addToast('Failed to load outreach data', 'error');
        } finally {
            setLoading(false);
        }
    }, [campaignId, statusFilter, addToast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const filteredOutreach = useMemo(() => {
        return outreachList.filter(item => {
            if (!searchQuery.trim()) return true;
            const clientName = (item.client as any)?.company || '';
            return clientName.toLowerCase().includes(searchQuery.toLowerCase());
        });
    }, [outreachList, searchQuery]);

    const handleProcessQueue = async () => {
        setProcessing(true);
        try {
            const result = await aiSalesAgentService.processOutreachQueue();
            addToast(`Processed ${result.processed} messages: ${result.successful} sent, ${result.failed} failed`, 'success');
            loadData();
        } catch (error) {
            console.error('Error processing outreach queue:', error);
            addToast('Failed to process outreach queue', 'error');
        } finally {
            setProcessing(false);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending': return <Clock className="w-4 h-4 text-amber-500" />;
            case 'sent': return <Send className="w-4 h-4 text-blue-500" />;
            case 'delivered': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
            case 'responded': return <MessageSquare className="w-4 h-4 text-violet-500" />;
            case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
            default: return <Clock className="w-4 h-4 text-slate-400" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
            case 'sent': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            case 'delivered': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
            case 'responded': return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400';
            case 'failed': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
            default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
        }
    };

    const getOutcomeIcon = (outcome: string | undefined) => {
        switch (outcome) {
            case 'interested': return <ThumbsUp className="w-4 h-4 text-emerald-500" />;
            case 'not_interested': return <ThumbsDown className="w-4 h-4 text-red-500" />;
            case 'converted': return <CheckCircle2 className="w-4 h-4 text-violet-500" />;
            case 'escalated': return <Phone className="w-4 h-4 text-amber-500" />;
            case 'no_response': return <Minus className="w-4 h-4 text-slate-400" />;
            default: return null;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl">
                        <Bot className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="font-semibold text-slate-800 dark:text-white">AI Outreach</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{campaignTitle}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={loadData}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className="w-4 h-4 text-slate-500" />
                    </button>
                    <button
                        onClick={handleProcessQueue}
                        disabled={processing}
                        className="flex items-center gap-2 px-3 py-2 bg-brand-blue text-white rounded-xl hover:bg-blue-600 transition-colors text-sm font-medium disabled:opacity-50"
                    >
                        <Send className="w-4 h-4" />
                        {processing ? 'Processing...' : 'Process Queue'}
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-center">
                        <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.total_outreach}</p>
                        <p className="text-xs text-slate-500">Total</p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-center">
                        <p className="text-2xl font-bold text-amber-500">{stats.pending_count}</p>
                        <p className="text-xs text-slate-500">Pending</p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-center">
                        <p className="text-2xl font-bold text-emerald-500">{stats.delivered_count}</p>
                        <p className="text-xs text-slate-500">Delivered</p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-center">
                        <p className="text-2xl font-bold text-violet-500">{stats.responded_count}</p>
                        <p className="text-xs text-slate-500">Responded</p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-center">
                        <p className="text-2xl font-bold text-blue-500">{stats.response_rate.toFixed(1)}%</p>
                        <p className="text-xs text-slate-500">Response Rate</p>
                    </div>
                </div>
            )}

            {/* Sentiment Breakdown */}
            {stats && (stats.sentiment_breakdown.positive > 0 || stats.sentiment_breakdown.negative > 0 || stats.sentiment_breakdown.neutral > 0) && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                    <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Feedback Sentiment</h3>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                            <span className="text-sm text-slate-600 dark:text-slate-400">Positive: {stats.sentiment_breakdown.positive}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-slate-400"></div>
                            <span className="text-sm text-slate-600 dark:text-slate-400">Neutral: {stats.sentiment_breakdown.neutral}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                            <span className="text-sm text-slate-600 dark:text-slate-400">Negative: {stats.sentiment_breakdown.negative}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search clients..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none"
                    />
                </div>
                <div className="relative">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="appearance-none pl-4 pr-10 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm cursor-pointer focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none"
                    >
                        <option value="">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="sent">Sent</option>
                        <option value="delivered">Delivered</option>
                        <option value="responded">Responded</option>
                        <option value="failed">Failed</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
            </div>

            {/* Outreach List */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                {filteredOutreach.length === 0 ? (
                    <div className="p-12 text-center">
                        <Megaphone className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                        <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-400 mb-1">No Outreach Yet</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-500">
                            Create outreach to start AI-powered campaign messaging.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-200 dark:divide-slate-800">
                        {filteredOutreach.map((item) => (
                            <div key={item.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3 flex-1">
                                        <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                            <Users className="w-4 h-4 text-slate-500" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium text-slate-800 dark:text-white truncate">
                                                    {(item.client as any)?.company || 'Unknown Client'}
                                                </p>
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md ${getStatusColor(item.status)}`}>
                                                    {getStatusIcon(item.status)}
                                                    {item.status}
                                                </span>
                                                {item.outcome && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs rounded-md">
                                                        {getOutcomeIcon(item.outcome)}
                                                        {item.outcome.replace('_', ' ')}
                                                    </span>
                                                )}
                                            </div>
                                            {item.message_content && (
                                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                                                    {item.message_content}
                                                </p>
                                            )}
                                            {item.response_content && (
                                                <div className="mt-2 p-2 bg-violet-50 dark:bg-violet-900/20 rounded-lg">
                                                    <p className="text-xs text-violet-600 dark:text-violet-400 font-medium">Response:</p>
                                                    <p className="text-sm text-violet-700 dark:text-violet-300">{item.response_content}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="flex items-center gap-1 text-xs text-slate-500">
                                            <Languages className="w-3 h-3" />
                                            {item.language}
                                        </div>
                                        <p className="text-xs text-slate-400 mt-1">
                                            {new Date(item.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                {item.error_message && (
                                    <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                        <p className="text-xs text-red-600 dark:text-red-400">Error: {item.error_message}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AICampaignOutreachPanel;
