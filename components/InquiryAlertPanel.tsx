// components/InquiryAlertPanel.tsx
import React, { useState, useEffect } from 'react';
import { AlertTriangle, TrendingDown, Users, Calendar, DollarSign, X, RefreshCw } from 'lucide-react';
import {
    getInquiryAlerts,
    refreshInquiryAlerts,
    dismissInquiryAlert,
    type InquiryAlert,
} from '../services/inquiryAlertService';
import { UserProfile } from '../types';

interface InquiryAlertPanelProps {
    currentUser: UserProfile | null;
    onViewDetails?: (itemCode: string) => void;
}

const InquiryAlertPanel: React.FC<InquiryAlertPanelProps> = ({ currentUser, onViewDetails }) => {
    const [alerts, setAlerts] = useState<InquiryAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadAlerts = async () => {
        try {
            const data = await getInquiryAlerts();
            setAlerts(data);
        } catch (error) {
            console.error('Error loading inquiry alerts:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await refreshInquiryAlerts();
            await loadAlerts();
        } catch (error) {
            console.error('Error refreshing alerts:', error);
        } finally {
            setRefreshing(false);
        }
    };

    const handleDismiss = async (itemCode: string) => {
        if (!currentUser) return;

        try {
            await dismissInquiryAlert(itemCode, currentUser.id);
            // Remove from UI
            setAlerts((prev) => prev.filter((alert) => alert.item_code !== itemCode));
        } catch (error) {
            console.error('Error dismissing alert:', error);
        }
    };

    useEffect(() => {
        loadAlerts();
    }, []);

    if (loading) {
        return (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm animate-pulse">
                <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                    <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-1/3"></div>
                </div>
                <div className="px-5 py-8">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded mb-3"></div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-2/3"></div>
                </div>
            </div>
        );
    }

    if (alerts.length === 0) {
        return null; // Don't show panel if no alerts
    }

    return (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 rounded-2xl border-2 border-amber-200 dark:border-amber-800 shadow-lg">
            {/* Header */}
            <div className="px-4 py-3 border-b border-amber-200 dark:border-amber-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-amber-500 rounded-lg">
                        <AlertTriangle className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                            Price Alert: High Inquiry, Low Conversion
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                            {alerts.length} {alerts.length === 1 ? 'product' : 'products'} with pricing concerns
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="p-2 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-lg transition-colors disabled:opacity-50"
                    title="Refresh alerts"
                >
                    <RefreshCw className={`w-4 h-4 text-amber-600 dark:text-amber-400 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Alert List */}
            <div className="p-4 grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                {alerts.map((alert) => (
                    <div
                        key={alert.item_code}
                        className="bg-white dark:bg-slate-900 rounded-xl border border-amber-200 dark:border-amber-800 p-3 shadow-sm hover:shadow-md transition-shadow h-full"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                                {/* Product Info */}
                                <div className="mb-2.5">
                                    <h4 className="font-bold text-slate-800 dark:text-white text-sm truncate">
                                        {alert.description || 'Unknown Product'}
                                    </h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        {alert.part_no || alert.item_code}
                                    </p>
                                </div>

                                {/* Stats Grid */}
                                <div className="grid grid-cols-2 gap-1.5 mb-2.5">
                                    <div className="flex items-center gap-1.5 text-xs">
                                        <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                                        <span className="text-slate-600 dark:text-slate-400">
                                            <span className="font-bold text-red-600 dark:text-red-400">{alert.inquiry_count}</span> inquiries
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs">
                                        <Users className="w-3.5 h-3.5 text-amber-500" />
                                        <span className="text-slate-600 dark:text-slate-400">
                                            <span className="font-bold text-amber-600 dark:text-amber-400">{alert.unique_customers}</span> customers
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs">
                                        <DollarSign className="w-3.5 h-3.5 text-blue-500" />
                                        <span className="text-slate-600 dark:text-slate-400">
                                            ₱{alert.avg_inquiry_price.toLocaleString('en-PH', { maximumFractionDigits: 0 })} avg
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs">
                                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                        <span className="text-slate-600 dark:text-slate-400">
                                            {new Date(alert.last_inquiry_date).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                            })}
                                        </span>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2">
                                    {onViewDetails && (
                                        <button
                                            onClick={() => onViewDetails(alert.item_code)}
                                            className="px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-lg transition-colors"
                                        >
                                            View Details
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleDismiss(alert.item_code)}
                                        className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                            </div>

                            {/* Dismiss Icon */}
                            <button
                                onClick={() => handleDismiss(alert.item_code)}
                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex-shrink-0"
                                title="Dismiss"
                            >
                                <X className="w-4 h-4 text-slate-400" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-amber-200 dark:border-amber-800 bg-amber-100/50 dark:bg-amber-900/20 rounded-b-2xl">
                <p className="text-xs text-center text-slate-600 dark:text-slate-400">
                    <span className="font-semibold">💡 Tip:</span> Consider reviewing pricing for these products - multiple customer inquiries without purchases may indicate price sensitivity.
                </p>
            </div>
        </div>
    );
};

export default InquiryAlertPanel;
