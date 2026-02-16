import React from 'react';
import { X, TrendingUp } from 'lucide-react';
import { AgentPerformanceSummary } from '../types';

interface AgentSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentSummary: AgentPerformanceSummary | null;
  loading?: boolean;
}

const AgentSummaryModal: React.FC<AgentSummaryModalProps> = ({ isOpen, onClose, agentSummary, loading = false }) => {
  if (!isOpen) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${Math.round(value)}%`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3">
            {agentSummary?.avatar_url && (
              <img
                src={agentSummary.avatar_url}
                alt={agentSummary?.agent_name}
                className="w-10 h-10 rounded-full object-cover"
              />
            )}
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                {loading ? 'Loading...' : agentSummary?.agent_name}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Sales Performance Summary</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="px-6 py-8 text-center text-slate-500">
            <p>Loading agent summary...</p>
          </div>
        ) : agentSummary ? (
          <div className="px-6 py-6 space-y-6">
            {/* Quota Section */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-sm text-slate-800 dark:text-white">Quota Performance</h3>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Monthly Quota</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-white">
                    {formatCurrency(agentSummary.monthly_quota)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Current Achievement</p>
                  <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                    {formatCurrency(agentSummary.current_achievement)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Remaining</p>
                  <p className={`text-sm font-bold ${agentSummary.remaining_quota > 0
                      ? 'text-slate-600 dark:text-slate-300'
                      : 'text-emerald-600 dark:text-emerald-400'
                    }`}>
                    {formatCurrency(Math.abs(agentSummary.remaining_quota))}
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Achievement</span>
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    {formatPercentage(agentSummary.achievement_percentage)}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${agentSummary.achievement_percentage >= 100
                        ? 'bg-emerald-500'
                        : agentSummary.achievement_percentage >= 75
                          ? 'bg-blue-500'
                          : agentSummary.achievement_percentage >= 50
                            ? 'bg-yellow-500'
                            : 'bg-orange-500'
                      }`}
                    style={{ width: `${Math.min(agentSummary.achievement_percentage, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Customer Breakdown Section */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
              <h3 className="font-semibold text-sm text-slate-800 dark:text-white mb-3">Customer Breakdown</h3>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white dark:bg-slate-900 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Active</p>
                  <div className="flex flex-col items-center justify-center gap-0.5">
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(agentSummary.active_sales)}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      {agentSummary.current_achievement > 0
                        ? formatPercentage((agentSummary.active_sales / agentSummary.current_achievement) * 100)
                        : '0%'}
                    </span>
                  </div>
                  <div className="h-1 bg-emerald-200 dark:bg-emerald-900/30 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${agentSummary.current_achievement > 0 ? (agentSummary.active_sales / agentSummary.current_achievement) * 100 : 0}%` }}></div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Prospective</p>
                  <div className="flex flex-col items-center justify-center gap-0.5">
                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                      {formatCurrency(agentSummary.prospective_sales)}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      {agentSummary.current_achievement > 0
                        ? formatPercentage((agentSummary.prospective_sales / agentSummary.current_achievement) * 100)
                        : '0%'}
                    </span>
                  </div>
                  <div className="h-1 bg-blue-200 dark:bg-blue-900/30 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${agentSummary.current_achievement > 0 ? (agentSummary.prospective_sales / agentSummary.current_achievement) * 100 : 0}%` }}></div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Inactive</p>
                  <div className="flex flex-col items-center justify-center gap-0.5">
                    <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
                      {formatCurrency(agentSummary.inactive_sales)}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      {agentSummary.current_achievement > 0
                        ? formatPercentage((agentSummary.inactive_sales / agentSummary.current_achievement) * 100)
                        : '0%'}
                    </span>
                  </div>
                  <div className="h-1 bg-slate-200 dark:bg-slate-700 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-slate-500 rounded-full" style={{ width: `${agentSummary.current_achievement > 0 ? (agentSummary.inactive_sales / agentSummary.current_achievement) * 100 : 0}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Customers Section */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-semibold text-sm text-slate-800 dark:text-white">Top Customers</h3>
              </div>

              {agentSummary.top_customers.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">No top customers yet</p>
              ) : (
                <div className="space-y-2">
                  {agentSummary.top_customers.map((customer, idx) => (
                    <div key={customer.id} className="bg-white dark:bg-slate-900 rounded-lg p-3 flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-xs font-bold text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                            {customer.company}
                          </span>
                        </div>
                        {customer.last_purchase_date && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 ml-8">
                            Last purchase: {new Date(customer.last_purchase_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                          {formatCurrency(customer.total_sales)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="px-6 py-8 text-center text-slate-500">
            <p>Failed to load agent summary</p>
          </div>
        )}

        {/* Footer */}
        <div className="sticky bottom-0 px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AgentSummaryModal;
