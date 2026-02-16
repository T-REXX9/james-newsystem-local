import React, { useState, useCallback } from 'react';
import {
  Printer,
  Loader2,
  TrendingUp,
  TrendingDown,
  Download,
  Play,
  Package,
  ArrowUpDown,
} from 'lucide-react';
import CustomLoadingSpinner from './CustomLoadingSpinner';
import { generateFastSlowReport } from '../services/inventoryMovementService';
import type { FastSlowMovementItem, FastSlowReportData, FastSlowReportFilters } from '../types';

const FastSlowInventoryReport: React.FC = () => {
  const [reportData, setReportData] = useState<FastSlowReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState<FastSlowReportFilters>({
    sortBy: 'sales_volume',
    sortDirection: 'desc',
  });

  const handleGenerateReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await generateFastSlowReport(filters);
      setReportData(data);
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleExport = useCallback(() => {
    if (!reportData) return;

    const allItems = [...reportData.fastMovingItems, ...reportData.slowMovingItems];
    const headers = [
      'Category',
      'Part No',
      'Item Code',
      'Description',
      'First Arrival',
      'Total Purchased',
      'Total Sold',
      reportData.fastMovingItems[0]?.month1_label || 'Month 1',
      reportData.fastMovingItems[0]?.month2_label || 'Month 2',
      reportData.fastMovingItems[0]?.month3_label || 'Month 3',
    ];

    const rows = allItems.map(item => [
      item.category.toUpperCase(),
      item.part_no,
      item.item_code,
      item.description,
      item.first_arrival_date || 'N/A',
      item.total_purchased,
      item.total_sold,
      item.month1_sales,
      item.month2_sales,
      item.month3_sales,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `fast-slow-inventory-report-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }, [reportData]);

  const renderTable = (items: FastSlowMovementItem[], title: string, isFast: boolean) => {
    const Icon = isFast ? TrendingUp : TrendingDown;
    const colorClass = isFast
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-rose-600 dark:text-rose-400';
    const bgClass = isFast
      ? 'bg-emerald-50 dark:bg-emerald-900/20'
      : 'bg-rose-50 dark:bg-rose-900/20';
    const borderClass = isFast
      ? 'border-emerald-200 dark:border-emerald-800'
      : 'border-rose-200 dark:border-rose-800';

    return (
      <div className="mb-8 print:mb-4">
        <div className={`flex items-center gap-2 mb-4 print:mb-2`}>
          <div className={`p-2 rounded-lg ${bgClass} ${colorClass}`}>
            <Icon className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-white print:text-black">
            {title} ({items.length} items)
          </h2>
        </div>

        <div className={`bg-white dark:bg-slate-900 rounded-xl border ${borderClass} shadow-sm overflow-hidden print:shadow-none print:border-gray-300`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse print:text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 print:bg-gray-100">
                <tr className="text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700 print:text-black print:border-gray-300">
                  <th className="p-3 print:p-2">Part No</th>
                  <th className="p-3 print:p-2">Item Code</th>
                  <th className="p-3 print:p-2">Description</th>
                  <th className="p-3 print:p-2">First Arrival</th>
                  <th className="p-3 text-center print:p-2">Total Purchased</th>
                  <th className="p-3 text-center print:p-2">Total Sold</th>
                  <th className="p-3 text-center print:p-2">{items[0]?.month1_label || 'Month 1'}</th>
                  <th className="p-3 text-center print:p-2">{items[0]?.month2_label || 'Month 2'}</th>
                  <th className="p-3 text-center print:p-2">{items[0]?.month3_label || 'Month 3'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-gray-200">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-500 dark:text-slate-400 italic">
                      No items in this category.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr
                      key={item.item_id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors print:hover:bg-transparent"
                    >
                      <td className="p-3 font-medium text-slate-800 dark:text-white print:p-2 print:text-black">
                        {item.part_no || '—'}
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-300 print:p-2 print:text-black">
                        {item.item_code || '—'}
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-300 print:p-2 print:text-black max-w-xs truncate">
                        {item.description || '—'}
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-300 print:p-2 print:text-black">
                        {item.first_arrival_date || 'N/A'}
                      </td>
                      <td className="p-3 text-center text-slate-600 dark:text-slate-300 print:p-2 print:text-black">
                        {item.total_purchased}
                      </td>
                      <td className="p-3 text-center text-slate-600 dark:text-slate-300 print:p-2 print:text-black">
                        {item.total_sold}
                      </td>
                      <td className="p-3 text-center text-slate-600 dark:text-slate-300 print:p-2 print:text-black">
                        {item.month1_sales}
                      </td>
                      <td className="p-3 text-center text-slate-600 dark:text-slate-300 print:p-2 print:text-black">
                        {item.month2_sales}
                      </td>
                      <td className={`p-3 text-center font-bold print:p-2 ${isFast ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'} print:text-black`}>
                        {item.month3_sales}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-8 animate-fadeIn print:p-0 print:bg-white">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 print:mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2 print:text-black">
            <Package className="w-6 h-6 text-brand-blue print:text-black" />
            Fast/Slow Inventory Report
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 print:text-gray-600">
            Analyzes product movement over the last 3 months
          </p>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          {reportData && (
            <>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg shadow-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" /> Export
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg shadow-sm font-medium transition-colors"
              >
                <Printer className="w-4 h-4" /> Print
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 mb-6 print:hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-slate-500" />
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Sort By:</label>
            <select
              value={filters.sortBy}
              onChange={(e) => setFilters(f => ({ ...f, sortBy: e.target.value as 'sales_volume' | 'part_no' }))}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
            >
              <option value="sales_volume">Sales Volume</option>
              <option value="part_no">Part Number</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Direction:</label>
            <select
              value={filters.sortDirection}
              onChange={(e) => setFilters(f => ({ ...f, sortDirection: e.target.value as 'asc' | 'desc' }))}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>

          <button
            onClick={handleGenerateReport}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-brand-blue hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-lg shadow-sm font-medium transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Generate Report
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <CustomLoadingSpinner label="Loading" />
            <p className="text-slate-500 dark:text-slate-400">Calculating inventory movement...</p>
          </div>
        </div>
      )}

      {!isLoading && !reportData && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Package className="w-16 h-16 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-400 mb-2">
              No Report Generated
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-500 max-w-md">
              Click "Generate Report" to analyze inventory movement over the last 3 months.
            </p>
          </div>
        </div>
      )}

      {!isLoading && reportData && (
        <div className="flex-1 overflow-y-auto custom-scrollbar print:overflow-visible print:h-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 print:hidden">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Fast Moving Items</p>
                <h4 className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{reportData.fastMovingItems.length}</h4>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Slow Moving Items</p>
                <h4 className="text-3xl font-bold text-rose-600 dark:text-rose-400">{reportData.slowMovingItems.length}</h4>
              </div>
              <div className="p-3 bg-rose-50 dark:bg-rose-900/30 rounded-lg text-rose-600 dark:text-rose-400">
                <TrendingDown className="w-6 h-6" />
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 print:text-gray-600">
            Report generated on: {new Date(reportData.generatedAt).toLocaleString()}
          </p>

          {renderTable(reportData.fastMovingItems, 'Fast Moving Items', true)}
          {renderTable(reportData.slowMovingItems, 'Slow Moving Items', false)}

          <div className="hidden print:block mt-8 text-center text-xs text-gray-500">
            <p>End of Report -- TND-OPC System</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default FastSlowInventoryReport;
