import React, { useState } from 'react';
import {
    AlertTriangle, X, ShieldAlert, TrendingDown,
    CheckCircle2, DollarSign, Lock, Unlock
} from 'lucide-react';
import { LowProfitItem } from '../types';

interface LowProfitWarningModalProps {
    isOpen: boolean;
    onClose: () => void;
    lowProfitItems: LowProfitItem[];
    onConfirmOverride: (reason: string) => void;
    onAdjustPrices: () => void;
    requiresApproval: boolean;
    canOverride: boolean;
}

const LowProfitWarningModal: React.FC<LowProfitWarningModalProps> = ({
    isOpen,
    onClose,
    lowProfitItems,
    onConfirmOverride,
    onAdjustPrices,
    requiresApproval,
    canOverride,
}) => {
    const [reason, setReason] = useState('');
    const [showReasonField, setShowReasonField] = useState(false);

    const handleProceed = () => {
        if (requiresApproval && canOverride) {
            if (!showReasonField) {
                setShowReasonField(true);
                return;
            }
            if (!reason.trim()) return;
        }
        onConfirmOverride(reason);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency: 'PHP',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800 bg-amber-50 dark:bg-amber-900/20">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-amber-500 rounded-xl">
                            <ShieldAlert className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                                Low Profit Warning
                            </h2>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                {lowProfitItems.length} item{lowProfitItems.length > 1 ? 's' : ''} below profit threshold
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {/* Warning Message */}
                    <div className="flex gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/50 rounded-xl">
                        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                                The following items have profit margins below the configured threshold.
                            </p>
                            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                                {requiresApproval ? 'Manager approval is required to proceed.' : 'Please review before continuing.'}
                            </p>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-100 dark:bg-slate-800">
                                        <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Item</th>
                                        <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Cost</th>
                                        <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Net Price</th>
                                        <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Profit</th>
                                        <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Threshold</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {lowProfitItems.map((item, index) => (
                                        <tr key={index} className="hover:bg-slate-100 dark:hover:bg-slate-800/50">
                                            <td className="px-4 py-3">
                                                <div>
                                                    <p className="font-medium text-slate-800 dark:text-white">{item.item_code}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">{item.product_name}</p>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                                                {formatCurrency(item.cost)}
                                            </td>
                                            <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                                                {formatCurrency(item.net_price)}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={`inline-flex items-center gap-1 ${item.profit_percentage < 0 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                                    <TrendingDown className="w-3 h-3" />
                                                    {item.profit_percentage.toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400">
                                                {item.threshold_percentage}%
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Suggested Actions */}
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/50 rounded-xl">
                        <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                            Suggested Prices to Meet Threshold:
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {lowProfitItems.slice(0, 5).map((item, index) => {
                                const suggestedPrice = item.cost / (1 - item.threshold_percentage / 100);
                                return (
                                    <span key={index} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-800/30 text-blue-700 dark:text-blue-300 text-xs rounded-lg">
                                        <DollarSign className="w-3 h-3" />
                                        {item.item_code}: {formatCurrency(Math.ceil(suggestedPrice))}
                                    </span>
                                );
                            })}
                            {lowProfitItems.length > 5 && (
                                <span className="px-3 py-1 bg-blue-100 dark:bg-blue-800/30 text-blue-700 dark:text-blue-300 text-xs rounded-lg">
                                    +{lowProfitItems.length - 5} more
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Reason Field (shown when proceeding with override) */}
                    {showReasonField && canOverride && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Override Reason <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="Please provide a reason for approving this low-profit sale..."
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none resize-none"
                                rows={3}
                            />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between gap-3 p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                    >
                        Cancel
                    </button>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={onAdjustPrices}
                            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
                        >
                            <DollarSign className="w-4 h-4" />
                            Adjust Prices
                        </button>

                        {canOverride ? (
                            <button
                                onClick={handleProceed}
                                disabled={showReasonField && !reason.trim()}
                                className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Unlock className="w-4 h-4" />
                                {showReasonField ? 'Confirm Override' : 'Proceed Anyway'}
                            </button>
                        ) : (
                            <button
                                disabled
                                className="flex items-center gap-2 px-4 py-2.5 bg-slate-400 text-white rounded-xl font-medium cursor-not-allowed opacity-50"
                            >
                                <Lock className="w-4 h-4" />
                                Override Not Allowed
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LowProfitWarningModal;
