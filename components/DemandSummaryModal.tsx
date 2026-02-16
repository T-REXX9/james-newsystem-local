import React from 'react';
import { X, Package, Hash, Users, Code, TrendingUp, Inbox } from 'lucide-react';

interface DemandSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: any;
}

const DemandSummaryModal: React.FC<DemandSummaryModalProps> = ({ isOpen, onClose, summary }) => {
  if (!isOpen || !summary) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-800">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">Demand Summary Details</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800/50 dark:to-slate-700/50 border border-blue-200 dark:border-slate-700 rounded-xl p-6">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-2">
                  <Code className="w-4 h-4" />
                  Part Number
                </label>
                <p className="text-2xl font-bold text-gray-800 dark:text-white">{summary.part_no}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-2">
                    <Hash className="w-4 h-4" />
                    Total Quantity Requested
                  </label>
                  <p className="text-2xl font-bold text-gray-800 dark:text-white">{summary.total_quantity || 0}</p>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4" />
                    Customer Inquiries
                  </label>
                  <p className="text-2xl font-bold text-gray-800 dark:text-white">{summary.customer_count || 0}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-slate-800 pt-6">
            <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <Package className="w-5 h-5" />
              Item Information
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Item Code</label>
                <p className="text-sm text-gray-700 dark:text-slate-300">{summary.item_code || 'N/A'}</p>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Description/Brand</label>
                <p className="text-sm text-gray-700 dark:text-slate-300">{summary.description || summary.brand || 'N/A'}</p>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-1">
                  <Inbox className="w-4 h-4" />
                  Application
                </label>
                <p className="text-sm text-gray-700 dark:text-slate-300">{summary.application || 'N/A'}</p>
              </div>
            </div>
          </div>

          {(summary.pr_number || summary.po_number || summary.eta || summary.rr_number) && (
            <div className="border-t border-gray-100 dark:border-slate-800 pt-6">
              <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Supply Status
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {summary.pr_number && (
                  <div>
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Purchase Request #</label>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white bg-amber-50 dark:bg-amber-900/20 p-2 rounded">{summary.pr_number}</p>
                  </div>
                )}
                {summary.po_number && (
                  <div>
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Purchase Order #</label>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white bg-blue-50 dark:bg-blue-900/20 p-2 rounded">{summary.po_number}</p>
                  </div>
                )}
                {summary.eta && (
                  <div>
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Estimated Arrival</label>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white bg-green-50 dark:bg-green-900/20 p-2 rounded">{summary.eta}</p>
                  </div>
                )}
                {summary.rr_number && (
                  <div>
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Receiving Report #</label>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded">{summary.rr_number}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="border-t border-gray-100 dark:border-slate-800 pt-6 bg-slate-50/50 dark:bg-slate-800/30 p-4 rounded-lg">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              <strong>Total Potential Revenue:</strong> {summary.total_quantity && summary.average_price
                ? `₱${(summary.total_quantity * summary.average_price).toLocaleString('en-PH')}`
                : 'N/A'
              }
            </p>
          </div>
        </div>

        <div className="p-6 bg-slate-50/50 dark:bg-slate-800/50 backdrop-blur-md border-t border-slate-200/60 dark:border-slate-700/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg font-medium hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default DemandSummaryModal;
