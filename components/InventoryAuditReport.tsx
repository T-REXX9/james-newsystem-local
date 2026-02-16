import React, { useState, useCallback, useEffect } from 'react';
import {
  Printer,
  Loader2,
  Download,
  Play,
  ClipboardCheck,
  TrendingUp,
  TrendingDown,
  Calendar,
  Search,
  Package,
} from 'lucide-react';
import CustomLoadingSpinner from './CustomLoadingSpinner';
import { generateInventoryAuditReport, fetchProducts } from '../services/inventoryAuditService';
import type {
  InventoryAuditFilters,
  InventoryAuditReportData,
  InventoryAuditTimePeriod,
  Product,
} from '../types';

const TIME_PERIOD_OPTIONS: { value: InventoryAuditTimePeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'custom', label: 'Custom' },
];

const ADJUSTMENT_TYPE_LABELS: Record<string, string> = {
  physical_count: 'Physical Count',
  damage: 'Damage',
  correction: 'Correction',
};

const WAREHOUSE_LABELS: Record<string, string> = {
  WH1: 'Warehouse 1',
  WH2: 'Warehouse 2',
  WH3: 'Warehouse 3',
  WH4: 'Warehouse 4',
  WH5: 'Warehouse 5',
  WH6: 'Warehouse 6',
};

const InventoryAuditReport: React.FC = () => {
  const [reportData, setReportData] = useState<InventoryAuditReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [filters, setFilters] = useState<InventoryAuditFilters>({
    timePeriod: 'month',
  });
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .catch((err) => console.error('Error loading products:', err));
  }, []);

  const validateFilters = useCallback((): boolean => {
    if (filters.timePeriod === 'custom') {
      if (!filters.dateFrom || !filters.dateTo) {
        setValidationError('Please select both start and end dates.');
        return false;
      }
      if (new Date(filters.dateFrom) > new Date(filters.dateTo)) {
        setValidationError('Start date cannot be after end date.');
        return false;
      }
    }
    setValidationError(null);
    return true;
  }, [filters]);

  const handleGenerateReport = useCallback(async () => {
    if (!validateFilters()) return;

    setIsLoading(true);
    try {
      const data = await generateInventoryAuditReport(filters);
      setReportData(data);
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filters, validateFilters]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleExport = useCallback(() => {
    if (!reportData) return;

    const headers = [
      'Date',
      'Adjustment No',
      'Type',
      'Warehouse',
      'Part No',
      'Item Code',
      'Description',
      'Brand',
      'System Qty',
      'Physical Qty',
      'Difference',
      'Reason',
      'Processed By',
      'Notes',
    ];

    const rows = reportData.records.map((record) => [
      record.adjustment_date,
      record.adjustment_no,
      ADJUSTMENT_TYPE_LABELS[record.adjustment_type] || record.adjustment_type,
      WAREHOUSE_LABELS[record.warehouse_id] || record.warehouse_id,
      record.part_no,
      record.item_code,
      record.description,
      record.brand,
      record.system_qty,
      record.physical_qty,
      record.difference,
      record.reason,
      record.processor_name || '',
      record.notes || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `inventory-audit-report-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }, [reportData]);

  const uniquePartNumbers = [...new Set(products.map((p) => p.part_no).filter(Boolean))].sort();
  const uniqueItemCodes = [...new Set(products.map((p) => p.item_code).filter(Boolean))].sort();

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-8 animate-fadeIn print:p-0 print:bg-white">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 print:mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2 print:text-black">
            <ClipboardCheck className="w-6 h-6 text-brand-blue print:text-black" />
            Inventory Audit Report
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 print:text-gray-600">
            Track and review all manual stock adjustments
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
        <div className="flex flex-col lg:flex-row items-start lg:items-end gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Time Period:
            </label>
            <select
              value={filters.timePeriod}
              onChange={(e) =>
                setFilters((f) => ({ ...f, timePeriod: e.target.value as InventoryAuditTimePeriod }))
              }
              className="px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
            >
              {TIME_PERIOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {filters.timePeriod === 'custom' && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">From:</label>
              <input
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                className="px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
              />
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">To:</label>
              <input
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                className="px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-500" />
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Part No:</label>
            <select
              value={filters.partNo || ''}
              onChange={(e) => setFilters((f) => ({ ...f, partNo: e.target.value || undefined }))}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue min-w-[150px]"
            >
              <option value="">All</option>
              {uniquePartNumbers.map((pn) => (
                <option key={pn} value={pn}>
                  {pn}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Item Code:</label>
            <select
              value={filters.itemCode || ''}
              onChange={(e) => setFilters((f) => ({ ...f, itemCode: e.target.value || undefined }))}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue min-w-[150px]"
            >
              <option value="">All</option>
              {uniqueItemCodes.map((ic) => (
                <option key={ic} value={ic}>
                  {ic}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleGenerateReport}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-brand-blue hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-lg shadow-sm font-medium transition-colors"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Generate Report
          </button>
        </div>

        {validationError && (
          <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{validationError}</p>
        )}
      </div>

      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <CustomLoadingSpinner label="Loading" />
            <p className="text-slate-500 dark:text-slate-400">Loading audit records...</p>
          </div>
        </div>
      )}

      {!isLoading && !reportData && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <ClipboardCheck className="w-16 h-16 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-400 mb-2">
              No Report Generated
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-500 max-w-md">
              Select your filters and click "Generate Report" to view stock adjustment records.
            </p>
          </div>
        </div>
      )}

      {!isLoading && reportData && (
        <div className="flex-1 overflow-y-auto custom-scrollbar print:overflow-visible print:h-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 print:hidden">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Total Adjustments
                </p>
                <h4 className="text-3xl font-bold text-slate-800 dark:text-white">
                  {reportData.totalAdjustments}
                </h4>
              </div>
              <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400">
                <Package className="w-6 h-6" />
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Total Added (+)
                </p>
                <h4 className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                  +{reportData.totalPositive}
                </h4>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Total Removed (-)
                </p>
                <h4 className="text-3xl font-bold text-rose-600 dark:text-rose-400">
                  -{reportData.totalNegative}
                </h4>
              </div>
              <div className="p-3 bg-rose-50 dark:bg-rose-900/30 rounded-lg text-rose-600 dark:text-rose-400">
                <TrendingDown className="w-6 h-6" />
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 print:text-gray-600">
            Report generated on: {new Date(reportData.generatedAt).toLocaleString()}
          </p>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden print:shadow-none print:border-gray-300">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse print:text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800 print:bg-gray-100">
                  <tr className="text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700 print:text-black print:border-gray-300">
                    <th className="p-3 print:p-2">Date</th>
                    <th className="p-3 print:p-2">Adjustment No</th>
                    <th className="p-3 print:p-2">Type</th>
                    <th className="p-3 print:p-2">Part No</th>
                    <th className="p-3 print:p-2">Item Code</th>
                    <th className="p-3 print:p-2">Description</th>
                    <th className="p-3 print:p-2">Brand</th>
                    <th className="p-3 text-center print:p-2">System Qty</th>
                    <th className="p-3 text-center print:p-2">Physical Qty</th>
                    <th className="p-3 text-center print:p-2">Difference</th>
                    <th className="p-3 print:p-2">Reason</th>
                    <th className="p-3 print:p-2">Processed By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-gray-200">
                  {reportData.records.length === 0 ? (
                    <tr>
                      <td
                        colSpan={12}
                        className="p-8 text-center text-slate-500 dark:text-slate-400 italic"
                      >
                        No adjustment records found for the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    reportData.records.map((record) => (
                      <tr
                        key={record.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors print:hover:bg-transparent"
                      >
                        <td className="p-3 text-slate-600 dark:text-slate-300 print:p-2 print:text-black whitespace-nowrap">
                          {new Date(record.adjustment_date).toLocaleDateString()}
                        </td>
                        <td className="p-3 font-medium text-slate-800 dark:text-white print:p-2 print:text-black">
                          {record.adjustment_no || '-'}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300 print:p-2 print:text-black">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              record.adjustment_type === 'damage'
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                                : record.adjustment_type === 'correction'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            }`}
                          >
                            {ADJUSTMENT_TYPE_LABELS[record.adjustment_type] || record.adjustment_type}
                          </span>
                        </td>
                        <td className="p-3 font-medium text-slate-800 dark:text-white print:p-2 print:text-black">
                          {record.part_no || '-'}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300 print:p-2 print:text-black">
                          {record.item_code || '-'}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300 print:p-2 print:text-black max-w-xs truncate">
                          {record.description || '-'}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300 print:p-2 print:text-black">
                          {record.brand || '-'}
                        </td>
                        <td className="p-3 text-center text-slate-600 dark:text-slate-300 print:p-2 print:text-black">
                          {record.system_qty}
                        </td>
                        <td className="p-3 text-center text-slate-600 dark:text-slate-300 print:p-2 print:text-black">
                          {record.physical_qty}
                        </td>
                        <td
                          className={`p-3 text-center font-bold print:p-2 ${
                            record.difference > 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : record.difference < 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-slate-500'
                          } print:text-black`}
                        >
                          {record.difference > 0 ? '+' : ''}
                          {record.difference}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300 print:p-2 print:text-black max-w-[200px] truncate">
                          {record.reason || '-'}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300 print:p-2 print:text-black">
                          {record.processor_name || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="hidden print:block mt-8 text-center text-xs text-gray-500">
            <p>End of Report -- TND-OPC System</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryAuditReport;
