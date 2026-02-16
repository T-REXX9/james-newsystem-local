import React, { useState, useEffect } from 'react';
import { Tag, ArrowRight, Clock, CheckCircle2 } from 'lucide-react';
import { Promotion, UserProfile } from '../types';
import * as promotionService from '../services/promotionService';

interface Props {
    currentUser: UserProfile | null;
    onViewAll?: () => void;
}

const PromotionDashboardWidget: React.FC<Props> = ({ currentUser, onViewAll }) => {
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!currentUser) return;
            try {
                const data = await promotionService.getAssignedPromotions(currentUser.id);
                // Only show active promotions with pending work
                const filtered = data.filter((p) => {
                    if (p.status !== 'Active') return false;
                    const hasWork = p.postings?.some(
                        (post) => post.status === 'Not Posted' || post.status === 'Rejected'
                    );
                    return hasWork;
                });
                setPromotions(filtered.slice(0, 3)); // Show max 3
            } catch (error) {
                console.error('Error fetching promotions:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [currentUser]);

    // Calculate days until expiry
    const getDaysUntilExpiry = (endDate: string) => {
        const end = new Date(endDate);
        const now = new Date();
        const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return diff;
    };

    // Get pending count for a promotion
    const getPendingCount = (promotion: Promotion) => {
        return (
            promotion.postings?.filter((p) => p.status === 'Not Posted' || p.status === 'Rejected').length || 0
        );
    };

    if (loading) {
        return (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-32" />
                    <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded" />
                </div>
            </div>
        );
    }

    if (promotions.length === 0) {
        return (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                <div className="flex items-center gap-2 mb-3">
                    <Tag className="w-4 h-4 text-blue-500" />
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Active Promotions</h3>
                </div>
                <div className="flex items-center justify-center py-6 text-slate-400 dark:text-slate-500">
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                    <span className="text-sm">All caught up!</span>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-blue-500" />
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Active Promotions</h3>
                </div>
                {onViewAll && (
                    <button
                        onClick={onViewAll}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                        View All <ArrowRight className="w-3 h-3" />
                    </button>
                )}
            </div>

            <div className="space-y-3">
                {promotions.map((promo) => {
                    const daysLeft = getDaysUntilExpiry(promo.end_date);
                    const pendingCount = getPendingCount(promo);

                    return (
                        <div
                            key={promo.id}
                            className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                        >
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                    {promo.campaign_title}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                                    <Clock className="w-3 h-3" />
                                    {daysLeft} days left
                                </p>
                            </div>
                            <span className="flex-shrink-0 px-2.5 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium rounded-full">
                                {pendingCount} pending
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default PromotionDashboardWidget;
