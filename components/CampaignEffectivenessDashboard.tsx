import React, { useState, useEffect, useCallback } from 'react';
import {
    BarChart3, TrendingUp, Users, MessageSquare, Target,
    ThumbsUp, ThumbsDown, Minus, Heart, AlertCircle,
    Calendar, ChevronDown, RefreshCw, Megaphone
} from 'lucide-react';
import { UserProfile, AICampaignStats } from '../types';
import * as aiSalesAgentService from '../services/aiSalesAgentService';
import { useToast } from './ToastProvider';

interface CampaignEffectivenessDashboardProps {
    currentUser: UserProfile | null;
    campaignId: string;
    campaignTitle: string;
}

const CampaignEffectivenessDashboard: React.FC<CampaignEffectivenessDashboardProps> = ({
    currentUser,
    campaignId,
    campaignTitle,
}) => {
    const [stats, setStats] = useState<AICampaignStats | null>(null);
    const [feedbackAnalysis, setFeedbackAnalysis] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const { addToast } = useToast();

    const loadData = useCallback(async () => {
        try {
            const [statsData, analysisData] = await Promise.all([
                aiSalesAgentService.getCampaignStats(campaignId),
                aiSalesAgentService.analyzeCampaignFeedback(campaignId),
            ]);
            setStats(statsData);
            setFeedbackAnalysis(analysisData);
        } catch (error) {
            console.error('Error loading campaign effectiveness data:', error);
            addToast('Failed to load campaign data', 'error');
        } finally {
            setLoading(false);
        }
    }, [campaignId, addToast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const getOutcomeColor = (outcome: string) => {
        const colors: Record<string, string> = {
            interested: 'bg-emerald-500',
            converted: 'bg-violet-500',
            not_interested: 'bg-red-500',
            no_response: 'bg-slate-400',
            escalated: 'bg-amber-500',
        };
        return colors[outcome] || 'bg-slate-400';
    };

    const getSentimentIcon = (sentiment: string) => {
        switch (sentiment) {
            case 'positive': return <ThumbsUp className="w-4 h-4 text-emerald-500" />;
            case 'negative': return <ThumbsDown className="w-4 h-4 text-red-500" />;
            case 'neutral': return <Minus className="w-4 h-4 text-slate-400" />;
            default: return null;
        }
    };

    const getFeedbackTypeIcon = (type: string) => {
        const icons: Record<string, React.ReactNode> = {
            interest: <Heart className="w-4 h-4 text-emerald-500" />,
            objection: <AlertCircle className="w-4 h-4 text-amber-500" />,
            question: <MessageSquare className="w-4 h-4 text-blue-500" />,
            conversion: <Target className="w-4 h-4 text-violet-500" />,
            complaint: <ThumbsDown className="w-4 h-4 text-red-500" />,
            positive: <ThumbsUp className="w-4 h-4 text-emerald-500" />,
        };
        return icons[type] || <MessageSquare className="w-4 h-4 text-slate-400" />;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                        <BarChart3 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Campaign Effectiveness</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{campaignTitle}</p>
                    </div>
                </div>
                <button
                    onClick={loadData}
                    className="flex items-center gap-2 px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                </button>
            </div>

            {/* Main Stats Grid */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                <Megaphone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                        </div>
                        <p className="text-3xl font-bold text-slate-800 dark:text-white">{stats.total_outreach}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Total Outreach</p>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
                                <MessageSquare className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                            </div>
                        </div>
                        <p className="text-3xl font-bold text-violet-600">{stats.response_rate.toFixed(1)}%</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Response Rate</p>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                                <Target className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                        </div>
                        <p className="text-3xl font-bold text-emerald-600">{stats.conversion_rate.toFixed(1)}%</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Conversion Rate</p>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                                <Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                            </div>
                        </div>
                        <p className="text-3xl font-bold text-slate-800 dark:text-white">{stats.responded_count}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Responses</p>
                    </div>
                </div>
            )}

            {/* Outcome Breakdown */}
            {stats && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5" />
                        Outcome Breakdown
                    </h3>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {Object.entries(stats.outcome_breakdown).map(([outcome, count]) => (
                            <div key={outcome} className="text-center">
                                <div className={`w-12 h-12 mx-auto mb-2 rounded-xl ${getOutcomeColor(outcome)} flex items-center justify-center`}>
                                    <span className="text-white font-bold">{count as number}</span>
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-400 capitalize">
                                    {outcome.replace('_', ' ')}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-6">
                        <div className="h-4 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                            {Object.entries(stats.outcome_breakdown).map(([outcome, count], index) => {
                                const percentage = stats.total_outreach > 0 ? ((count as number) / stats.total_outreach) * 100 : 0;
                                return (
                                    <div
                                        key={outcome}
                                        className={`${getOutcomeColor(outcome)} transition-all duration-500`}
                                        style={{ width: `${percentage}%` }}
                                        title={`${outcome}: ${count}`}
                                    />
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Sentiment Analysis */}
            {stats && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                        <Heart className="w-5 h-5" />
                        Sentiment Analysis
                    </h3>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                            <ThumbsUp className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                            <p className="text-2xl font-bold text-emerald-600">{stats.sentiment_breakdown.positive}</p>
                            <p className="text-sm text-emerald-600/70">Positive</p>
                        </div>
                        <div className="text-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                            <Minus className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                            <p className="text-2xl font-bold text-slate-600 dark:text-slate-400">{stats.sentiment_breakdown.neutral}</p>
                            <p className="text-sm text-slate-500">Neutral</p>
                        </div>
                        <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
                            <ThumbsDown className="w-8 h-8 mx-auto mb-2 text-red-500" />
                            <p className="text-2xl font-bold text-red-600">{stats.sentiment_breakdown.negative}</p>
                            <p className="text-sm text-red-600/70">Negative</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Feedback Type Distribution */}
            {feedbackAnalysis && feedbackAnalysis.total_feedback > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                        <MessageSquare className="w-5 h-5" />
                        Feedback Analysis ({feedbackAnalysis.total_feedback} total)
                    </h3>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {Object.entries(feedbackAnalysis.feedback_type_distribution).map(([type, count]) => (
                            <div key={type} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                                {getFeedbackTypeIcon(type)}
                                <div>
                                    <p className="font-medium text-slate-800 dark:text-white capitalize">{type}</p>
                                    <p className="text-sm text-slate-500">{count as number} mentions</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Common Tags */}
            {feedbackAnalysis && feedbackAnalysis.common_tags.length > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Common Topics</h3>
                    <div className="flex flex-wrap gap-2">
                        {feedbackAnalysis.common_tags.map((item: any, index: number) => (
                            <span
                                key={index}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand-blue/10 text-brand-blue rounded-lg text-sm font-medium"
                            >
                                {item.tag}
                                <span className="ml-1 text-xs bg-brand-blue/20 px-1.5 py-0.5 rounded">{item.count}</span>
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {(!stats || stats.total_outreach === 0) && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
                    <BarChart3 className="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                    <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-400 mb-2">
                        No Data Yet
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-500">
                        Start AI outreach to see campaign effectiveness metrics.
                    </p>
                </div>
            )}
        </div>
    );
};

export default CampaignEffectivenessDashboard;
