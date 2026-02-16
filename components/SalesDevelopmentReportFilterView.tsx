import React, { useState, useEffect } from 'react';
import { ChevronLeft, FileText, Printer, TrendingDown, Package, Users } from 'lucide-react';
import CustomLoadingSpinner from './CustomLoadingSpinner';
import { getSalesDevelopmentReportData, getSalesDevelopmentDemandSummary } from '../services/salesInquiryService';
import InquiryDetailsModal from './InquiryDetailsModal';
import DemandSummaryModal from './DemandSummaryModal';

interface SalesDevelopmentReportDataViewProps {
  dateFrom: string;
  dateTo: string;
  reportCategory: 'not_purchase' | 'no_stock';
  onBack: () => void;
}

const SalesDevelopmentReportDataView: React.FC<SalesDevelopmentReportDataViewProps> = ({
  dateFrom,
  dateTo,
  reportCategory,
  onBack,
}) => {
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [demandSummary, setDemandSummary] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedInquiry, setSelectedInquiry] = useState<any | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<any | null>(null);

  useEffect(() => {
    loadReportData();
  }, [dateFrom, dateTo, reportCategory]);

  const loadReportData = async () => {
    setIsLoading(true);
    try {
      const [inquiryData, summaryData] = await Promise.all([
        getSalesDevelopmentReportData(dateFrom, dateTo, reportCategory),
        getSalesDevelopmentDemandSummary(dateFrom, dateTo, reportCategory),
      ]);
      setInquiries(inquiryData);
      setDemandSummary(summaryData);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const categoryTitle = reportCategory === 'not_purchase' 
    ? 'Not Purchased (Lost Sales)' 
    : 'No Stock (Unmet Demand)';

  const categoryDesc = reportCategory === 'not_purchase'
    ? 'Items marked "On Stock" but no sales order generated'
    : 'Items marked "Out of Stock" when customers inquired';

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-50 via-slate-50/95 to-blue-50/30 dark:from-slate-950 dark:via-slate-950 dark:to-blue-950/20">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="absolute inset-0 bg-brand-blue blur-2xl opacity-15 animate-pulse rounded-full"></div>
            <div className="relative">
              <CustomLoadingSpinner label="Loading" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <p className="text-slate-700 dark:text-slate-200 font-semibold text-lg">Generating Report</p>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Please wait while we compile your data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 via-slate-50/95 to-blue-50/30 dark:from-slate-950 dark:via-slate-950 dark:to-blue-950/20 p-6 md:p-8 lg:p-10 animate-fadeIn print:p-0 print:bg-white overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-6 print:mb-6 animate-slideInUp">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="group relative p-2.5 bg-white dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/60 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 hover:text-brand-blue transition-all duration-300 shadow-sm print:hidden"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white print:text-black">
              Sales Development Report
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 print:text-gray-600">
              {categoryTitle} • {dateFrom} to {dateTo}
            </p>
          </div>
        </div>

        <button
          onClick={handlePrint}
          className="group relative flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-700/60 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-brand-blue transition-all duration-300 print:hidden"
        >
          <Printer className="w-4 h-4" />
          <span className="hidden sm:inline font-medium">Print</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 animate-slideInUp print:grid-cols-2" style={{ animationDelay: '0.1s' }}>
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700/60 rounded-xl p-6 print:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Total Inquiries</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{inquiries.length}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-400/60" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700/60 rounded-xl p-6 print:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Total Quantity</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{inquiries.reduce((sum, item) => sum + (item.qty || 0), 0)}</p>
            </div>
            <Package className="w-8 h-8 text-amber-400/60" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700/60 rounded-xl p-6 print:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Unique Items</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{demandSummary.length}</p>
            </div>
            <TrendingDown className="w-8 h-8 text-red-400/60" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700/60 rounded-xl p-6 print:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Potential Value</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">
                {formatCurrency(demandSummary.reduce((sum, item) => sum + (item.total_quantity * (item.average_price || 0)), 0))}
              </p>
            </div>
            <Users className="w-8 h-8 text-green-400/60" />
          </div>
        </div>
      </div>

      {/* Inquiry Log Table */}
      <div className="bg-white dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl overflow-hidden shadow-lg mb-8 print:shadow-none">
        <div className="p-6 border-b border-slate-200/60 dark:border-slate-700/60">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-blue" />
            Detailed Inquiry Log
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Complete list of all customer inquiries</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200/60 dark:border-slate-700/60">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Inquiry</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Salesperson</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Part No</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Qty</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-700/60">
              {inquiries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                    No inquiries found for this period and category.
                  </td>
                </tr>
              ) : (
                inquiries.map((inquiry, idx) => (
                  <tr
                    key={inquiry.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedInquiry(inquiry)}
                  >
                    <td className="px-6 py-4 text-sm font-semibold text-slate-800 dark:text-white">{inquiry.inquiry_no}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{formatDate(inquiry.sales_date)}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{inquiry.customer_company}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{inquiry.sales_person}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-300">{inquiry.part_no}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 text-right">{inquiry.qty}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-800 dark:text-white text-right">{formatCurrency(inquiry.amount)}</td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedInquiry(inquiry);
                        }}
                        className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-semibold hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Demand Summary Table */}
      <div className="bg-white dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl overflow-hidden shadow-lg print:shadow-none">
        <div className="p-6 border-b border-slate-200/60 dark:border-slate-700/60">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-brand-blue" />
            Demand Summary (Aggregated by Part Number)
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Total demand for each item across all inquiries</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200/60 dark:border-slate-700/60">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Part No</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Description</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Total Qty</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Inquiries</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Potential Value</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-700/60">
              {demandSummary.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                    No demand summary data available.
                  </td>
                </tr>
              ) : (
                demandSummary.map((summary) => (
                  <tr
                    key={summary.part_no}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedSummary(summary)}
                  >
                    <td className="px-6 py-4 text-sm font-semibold text-slate-800 dark:text-white">{summary.part_no}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{summary.description || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-800 dark:text-white text-right">{summary.total_quantity}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 text-center">{summary.customer_count}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-800 dark:text-white text-right">
                      {formatCurrency(summary.total_quantity * (summary.average_price || 0))}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSummary(summary);
                        }}
                        className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg text-xs font-semibold hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <InquiryDetailsModal
        isOpen={selectedInquiry !== null}
        onClose={() => setSelectedInquiry(null)}
        inquiry={selectedInquiry}
      />

      <DemandSummaryModal
        isOpen={selectedSummary !== null}
        onClose={() => setSelectedSummary(null)}
        summary={selectedSummary}
      />
    </div>
  );
};

export default SalesDevelopmentReportDataView;
