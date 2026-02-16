
import React, { useState, useEffect, useMemo } from 'react';
import { fetchReorderReportEntries } from '../services/supabaseService';
import { ReorderReportEntry } from '../types';
import { Printer, AlertTriangle, CheckCircle, Package, Zap, Turtle, MessageSquareWarning } from 'lucide-react';
import CustomLoadingSpinner from './CustomLoadingSpinner';

const ReorderReport: React.FC = () => {
  const [reportEntries, setReportEntries] = useState<ReorderReportEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    setIsLoading(true);
    try {
      const data = await fetchReorderReportEntries();
      setReportEntries(data);
    } finally {
      setIsLoading(false);
    }
  };

  const criticalCount = useMemo(
    () => reportEntries.filter(entry => entry.status === 'critical').length,
    [reportEntries]
  );

  const totalReplenish = useMemo(
    () => reportEntries.reduce((sum, entry) => sum + (entry.replenish_quantity || 0), 0),
    [reportEntries]
  );

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-slate-950">
        <CustomLoadingSpinner label="Loading" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-8 animate-fadeIn print:p-0 print:bg-white">

      {/* Header - Hidden in Print if you want a custom print header, but usually we keep it */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 print:mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2 print:text-black">
            <Package className="w-6 h-6 text-brand-blue print:text-black" />
            Inventory Reorder Report
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 print:text-gray-600">
            Generated on: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-brand-blue hover:bg-blue-700 text-white rounded-lg shadow-sm font-medium transition-colors print:hidden"
        >
          <Printer className="w-4 h-4" /> Print Report
        </button>
      </div>

      {/* Summary Cards - Hidden in Print to save ink/space usually, but let's keep simple stats if nice */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 print:hidden">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Items Needing Reorder</p>
            <h4 className="text-3xl font-bold text-slate-800 dark:text-white">{reportEntries.length}</h4>
          </div>
          <div className="p-3 bg-rose-50 dark:bg-rose-900/30 rounded-lg text-rose-600 dark:text-rose-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Critical Alerts</p>
            <h4 className="text-3xl font-bold text-slate-800 dark:text-white">{criticalCount}</h4>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Replenish Qty</p>
            <h4 className="text-3xl font-bold text-slate-800 dark:text-white">{totalReplenish}</h4>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-brand-blue dark:text-blue-400">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Report Table */}
      <div className="flex-1 overflow-hidden bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm print:shadow-none print:border-none print:overflow-visible">
        <div className="h-full overflow-y-auto custom-scrollbar print:overflow-visible print:h-auto">
          <table className="w-full text-left border-collapse print:text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10 shadow-sm print:shadow-none print:bg-gray-100 print:static">
              <tr className="text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700 print:text-black print:border-gray-300">
                <th className="p-4 print:p-2">Part No / OEM</th>
                <th className="p-4 print:p-2">Description</th>
                <th className="p-4 print:p-2">Brand</th>
                <th className="p-4 text-center print:p-2">Current Stock</th>
                <th className="p-4 text-center print:p-2">Reorder Point</th>
                <th className="p-4 text-center print:p-2">Replenish Qty</th>
                <th className="p-4 text-center print:p-2">Indicators</th>
                <th className="p-4 text-center print:p-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-gray-200">
              {reportEntries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500 dark:text-slate-400 italic">
                    All stock levels are healthy. No items need reordering.
                  </td>
                </tr>
              ) : (
                reportEntries.map((entry) => {
                  const isCritical = entry.status === 'critical';
                  const statusLabel = isCritical ? 'Critical' : entry.status === 'low' ? 'Low Stock' : 'Healthy';

                  return (
                    <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors print:hover:bg-transparent">
                      <td className="p-4 align-top print:p-2">
                        <div className="font-bold text-slate-800 dark:text-white print:text-black">{entry.part_no}</div>
                        {entry.brand && <div className="text-xs text-slate-500 font-mono mt-0.5">{entry.brand}</div>}
                      </td>
                      <td className="p-4 align-top text-slate-600 dark:text-slate-300 print:p-2 print:text-black">
                        {entry.description || '—'}
                        {entry.notes && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 print:text-black">
                            Note: {entry.notes}
                          </p>
                        )}
                        {entry.stock_snapshot && (
                          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap gap-2 font-mono print:text-black">
                            {Object.entries(entry.stock_snapshot).map(([warehouse, qty]) => (
                              <span key={warehouse}>
                                {warehouse.toUpperCase()}: {qty}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-4 align-top text-slate-600 dark:text-slate-300 print:p-2 print:text-black">
                        {entry.brand || '—'}
                      </td>
                      <td className="p-4 align-top text-center print:p-2">
                        <span className={`font-mono font-bold ${isCritical ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'} print:text-black`}>
                          {entry.total_stock}
                        </span>
                      </td>
                      <td className="p-4 align-top text-center text-slate-600 dark:text-slate-300 print:p-2 print:text-black">
                        {entry.reorder_point}
                      </td>
                      <td className="p-4 align-top text-center font-bold text-slate-800 dark:text-white print:p-2 print:text-black">
                        {entry.replenish_quantity}
                      </td>
                      {/* Indicators Column - Movement & Complaint Badges */}
                      <td className="p-4 align-top text-center print:p-2">
                        <div className="flex flex-col gap-1.5 items-center">
                          {/* Movement Classification Badge */}
                          {entry.movement_classification === 'fast' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800 print:border-black print:bg-transparent print:text-black">
                              <Zap className="w-3 h-3" />
                              Fast
                            </span>
                          )}
                          {entry.movement_classification === 'slow' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800 print:border-black print:bg-transparent print:text-black">
                              <Turtle className="w-3 h-3" />
                              Slow
                            </span>
                          )}
                          {/* Complaint Badge */}
                          {entry.complaint_count && entry.complaint_count > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800 print:border-black print:bg-transparent print:text-black">
                              <MessageSquareWarning className="w-3 h-3" />
                              {entry.complaint_count} Complaint{entry.complaint_count > 1 ? 's' : ''}
                            </span>
                          )}
                          {/* Show dash if no indicators */}
                          {entry.movement_classification === 'normal' && (!entry.complaint_count || entry.complaint_count === 0) && (
                            <span className="text-slate-400 dark:text-slate-500">—</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 align-top text-center print:p-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase border print:border-black print:bg-transparent print:text-black ${isCritical
                            ? 'bg-rose-50 text-rose-600 border-rose-100'
                            : entry.status === 'low'
                              ? 'bg-amber-50 text-amber-600 border-amber-100'
                              : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                            }`}
                        >
                          <AlertTriangle className="w-3 h-3" />
                          {statusLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Print Footer */}
      <div className="hidden print:block mt-8 text-center text-xs text-gray-500">
        <p>End of Report -- TND-OPC System</p>
      </div>

    </div>
  );
};

export default ReorderReport;
