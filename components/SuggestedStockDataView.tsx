import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  Printer,
  Download,
  Loader2,
  Package,
  Users,
  Calendar,
  TrendingUp,
  Edit2,
  Check,
  X,
  ShoppingCart,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import CustomLoadingSpinner from './CustomLoadingSpinner';
import { UserProfile } from '../types';
import {
  fetchSuggestedStockSummary,
  fetchSuggestedStockDetails,
  updateItemRemark,
  SuggestedStockItem,
  SuggestedStockDetail,
} from '../services/suggestedStockService';
import AddToPurchaseRequestModal from './AddToPurchaseRequestModal';

interface SuggestedStockDataViewProps {
  dateFrom: string;
  dateTo: string;
  customerId: string;
  onBack: () => void;
  currentUser?: UserProfile | null;
}

type ViewMode = 'summary' | 'detail';
type SortField = 'partNo' | 'inquiryCount' | 'totalQty' | 'customerCount' | 'lastInquiryDate';
type SortDirection = 'asc' | 'desc';

const SuggestedStockDataView: React.FC<SuggestedStockDataViewProps> = ({
  dateFrom,
  dateTo,
  customerId,
  onBack,
  currentUser,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('summary');
  const [summaryData, setSummaryData] = useState<SuggestedStockItem[]>([]);
  const [detailData, setDetailData] = useState<SuggestedStockDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('inquiryCount');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [editingRemarkId, setEditingRemarkId] = useState<string | null>(null);
  const [editingRemarkValue, setEditingRemarkValue] = useState<string>('');
  const [savingRemark, setSavingRemark] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SuggestedStockItem | null>(null);
  const [showPRModal, setShowPRModal] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const filters = { dateFrom, dateTo, customerId };
      const [summary, details] = await Promise.all([
        fetchSuggestedStockSummary(filters),
        fetchSuggestedStockDetails(filters),
      ]);
      setSummaryData(summary);
      setDetailData(details);
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo, customerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const sortedSummaryData = useMemo(() => {
    return [...summaryData].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'partNo':
          comparison = a.partNo.localeCompare(b.partNo);
          break;
        case 'inquiryCount':
          comparison = a.inquiryCount - b.inquiryCount;
          break;
        case 'totalQty':
          comparison = a.totalQty - b.totalQty;
          break;
        case 'customerCount':
          comparison = a.customerCount - b.customerCount;
          break;
        case 'lastInquiryDate':
          comparison = a.lastInquiryDate.localeCompare(b.lastInquiryDate);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [summaryData, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleStartEditRemark = (item: SuggestedStockItem) => {
    setEditingRemarkId(item.id);
    setEditingRemarkValue(item.remark);
  };

  const handleSaveRemark = async () => {
    if (!editingRemarkId) return;
    setSavingRemark(true);
    const success = await updateItemRemark(editingRemarkId, editingRemarkValue);
    if (success) {
      setSummaryData((prev) =>
        prev.map((item) =>
          item.id === editingRemarkId ? { ...item, remark: editingRemarkValue } : item
        )
      );
    }
    setSavingRemark(false);
    setEditingRemarkId(null);
  };

  const handleCancelEditRemark = () => {
    setEditingRemarkId(null);
    setEditingRemarkValue('');
  };

  const handleAddToPR = (item: SuggestedStockItem) => {
    setSelectedItem(item);
    setShowPRModal(true);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const escapeCSV = (val: any) => {
      const str = String(val ?? '');
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    };

    const headers = ['Part No', 'Item Code', 'Description', 'Inquiry Count', 'Total Qty', 'Customer Count', 'Customers', 'Last Inquiry Date', 'Remark'];
    const rows = sortedSummaryData.map((item) => [
      escapeCSV(item.partNo),
      escapeCSV(item.itemCode),
      escapeCSV(item.description),
      item.inquiryCount,
      item.totalQty,
      item.customerCount,
      escapeCSV(item.customers.map((c) => c.name).join('; ')),
      item.lastInquiryDate,
      escapeCSV(item.remark),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `suggested-stock-report-${dateFrom}-to-${dateTo}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    );
  };

  const totalUniqueItems = summaryData.length;
  const totalInquiries = summaryData.reduce((sum, item) => sum + item.inquiryCount, 0);
  const totalQty = summaryData.reduce((sum, item) => sum + item.totalQty, 0);
  const uniqueCustomers = new Set(summaryData.flatMap((item) => item.customers.map((c) => c.id))).size;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <CustomLoadingSpinner label="Loading" />
        <p className="mt-4 text-slate-500 dark:text-slate-400">Loading report data...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 animate-fadeIn">
      <div className="p-6 print:p-2">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors print:hidden"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
                Item Suggested for Stock Report
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {new Date(dateFrom).toLocaleDateString('en-PH', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}{' '}
                -{' '}
                {new Date(dateTo).toLocaleDateString('en-PH', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setViewMode('summary')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  viewMode === 'summary'
                    ? 'bg-brand-blue text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                Summary
              </button>
              <button
                onClick={() => setViewMode('detail')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  viewMode === 'detail'
                    ? 'bg-brand-blue text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                Details
              </button>
            </div>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 print:grid-cols-4">
          <div className="bg-white dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-brand-blue mb-2">
              <Package className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Unique Items</span>
            </div>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{totalUniqueItems}</p>
          </div>
          <div className="bg-white dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-blue-500 mb-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Total Inquiries</span>
            </div>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{totalInquiries}</p>
          </div>
          <div className="bg-white dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-emerald-500 mb-2">
              <Calendar className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Total Qty</span>
            </div>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{totalQty}</p>
          </div>
          <div className="bg-white dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-purple-500 mb-2">
              <Users className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Customers</span>
            </div>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{uniqueCustomers}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6 print:px-2 print:pb-2">
        {summaryData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Package className="w-16 h-16 text-slate-300 dark:text-slate-700 mb-4" />
            <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-400">
              No Items Found
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
              No unlisted items were requested during this period.
            </p>
          </div>
        ) : viewMode === 'summary' ? (
          <div className="bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50">
                    <th
                      className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                      onClick={() => handleSort('partNo')}
                    >
                      <div className="flex items-center gap-1">
                        Part No / Item Code
                        <SortIcon field="partNo" />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Description
                    </th>
                    <th
                      className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                      onClick={() => handleSort('inquiryCount')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Inquiries
                        <SortIcon field="inquiryCount" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                      onClick={() => handleSort('totalQty')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Total Qty
                        <SortIcon field="totalQty" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                      onClick={() => handleSort('customerCount')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Customers
                        <SortIcon field="customerCount" />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Customer Names
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                      onClick={() => handleSort('lastInquiryDate')}
                    >
                      <div className="flex items-center gap-1">
                        Last Inquiry
                        <SortIcon field="lastInquiryDate" />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Remark
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 print:hidden">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {sortedSummaryData.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800 dark:text-white">
                          {item.partNo || '-'}
                        </div>
                        <div className="text-xs text-slate-500">{item.itemCode || '-'}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 max-w-xs truncate">
                        {item.description || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                          {item.inquiryCount}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-medium text-slate-800 dark:text-white">
                        {item.totalQty}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                          {item.customerCount}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 max-w-xs">
                        <div className="line-clamp-2">
                          {item.customers.map((c) => c.name).join(', ') || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                        {item.lastInquiryDate
                          ? new Date(item.lastInquiryDate).toLocaleDateString('en-PH')
                          : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {editingRemarkId === item.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={editingRemarkValue}
                              onChange={(e) => setEditingRemarkValue(e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-blue outline-none"
                              autoFocus
                            />
                            <button
                              onClick={handleSaveRemark}
                              disabled={savingRemark}
                              className="p-1 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded"
                            >
                              {savingRemark ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={handleCancelEditRemark}
                              className="p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 group">
                            <span className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-[120px]">
                              {item.remark || '-'}
                            </span>
                            <button
                              onClick={() => handleStartEditRemark(item)}
                              className="p-1 text-slate-400 hover:text-brand-blue opacity-0 group-hover:opacity-100 transition-opacity print:hidden"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center print:hidden">
                        <button
                          onClick={() => handleAddToPR(item)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand-blue hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          <ShoppingCart className="w-3 h-3" />
                          Add to PR
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50">
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Inquiry No
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Part No
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Item Code
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Description
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Qty
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Sales Person
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Remark
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {detailData.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {item.inquiryDate
                          ? new Date(item.inquiryDate).toLocaleDateString('en-PH')
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-800 dark:text-white">
                        {item.inquiryNo || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                        {item.customerName || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-800 dark:text-white">
                        {item.partNo || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                        {item.itemCode || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 max-w-xs truncate">
                        {item.description || '-'}
                      </td>
                      <td className="px-4 py-3 text-center font-medium text-slate-800 dark:text-white">
                        {item.qty}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                        {item.salesPerson || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 max-w-xs truncate">
                        {item.remark || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showPRModal && selectedItem && (
        <AddToPurchaseRequestModal
          item={selectedItem}
          onClose={() => {
            setShowPRModal(false);
            setSelectedItem(null);
          }}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};

export default SuggestedStockDataView;
