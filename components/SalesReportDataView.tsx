import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  Printer,
  FileText,
  TrendingUp,
  Receipt,
  DollarSign,
  Users,
} from 'lucide-react';
import CustomLoadingSpinner from './CustomLoadingSpinner';
import { UserProfile, SalesReportData, SalesReportTransaction, CategoryTotal } from '../types';
import { getSalesReportData } from '../services/salesReportService';
import SalesReportDetailModal from './SalesReportDetailModal';
import SalespersonSummary from './SalespersonSummary';

interface SalesReportDataViewProps {
  dateFrom: string;
  dateTo: string;
  customerId: string;
  onBack: () => void;
  currentUser?: UserProfile;
}

const SalesReportDataView: React.FC<SalesReportDataViewProps> = ({
  dateFrom,
  dateTo,
  customerId,
  onBack,
}) => {
  const [reportData, setReportData] = useState<SalesReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<SalesReportTransaction | null>(null);
  const [activeTab, setActiveTab] = useState<'transactions' | 'salesperson'>('transactions');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    loadReportData();
  }, [dateFrom, dateTo, customerId]);

  const loadReportData = async () => {
    setIsLoading(true);
    try {
      const data = await getSalesReportData({ dateFrom, dateTo, customerId });
      setReportData(data);
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
      month: '2-digit',
      day: '2-digit',
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const getUniqueCategories = () => {
    if (!reportData) return [];
    const categories = [...new Set(reportData.transactions.map((tx) => tx.category))].sort();
    return categories;
  };

  const getCategoryCount = (category: string) => {
    if (!reportData) return 0;
    return reportData.transactions.filter((tx) => tx.category === category).length;
  };

  const getFilteredTransactions = () => {
    if (!reportData) return [];
    if (!selectedCategory) return reportData.transactions;
    return reportData.transactions.filter((tx) => tx.category === selectedCategory);
  };

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
            <p className="text-slate-700 dark:text-slate-200 font-semibold text-lg">Generating Sales Report</p>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Please wait while we compile your data...</p>
          </div>
        </div>
      </div>
    );
  }

  const categories = getUniqueCategories();
  const filteredTransactions = getFilteredTransactions();

  return (
    <div className="flex h-full flex-col bg-gradient-to-br from-slate-50 via-slate-50/95 to-blue-50/30 dark:from-slate-950 dark:via-slate-950 dark:to-blue-950/20 p-4 sm:p-6 print:bg-white print:p-0 dark:from-slate-950 dark:via-slate-950 dark:to-blue-950/20 lg:p-8 animate-fadeIn overflow-y-auto">
      <div className="mb-4 sm:mb-6 flex flex-col items-start justify-between gap-4 print:mb-6 lg:flex-row lg:items-center animate-slideInUp flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="group relative p-2.5 bg-white dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/60 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 hover:text-brand-blue transition-all duration-300 shadow-sm print:hidden"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white print:text-black">
              Sales Report
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 print:text-gray-600">
              {formatDate(dateFrom)} to {formatDate(dateTo)} | {customerId === 'all' ? 'All Customers' : 'Selected Customer'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 print:hidden">
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm p-1 rounded-xl flex items-center border border-slate-200/60 dark:border-slate-700/60 shadow-sm">
            <button
              onClick={() => setActiveTab('transactions')}
              className={`relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${activeTab === 'transactions'
                ? 'bg-brand-blue text-white shadow-md'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Transactions</span>
            </button>
            <button
              onClick={() => setActiveTab('salesperson')}
              className={`relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${activeTab === 'salesperson'
                ? 'bg-brand-blue text-white shadow-md'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Salesperson</span>
            </button>
          </div>

          <button
            onClick={handlePrint}
            className="group relative flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-700/60 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-brand-blue transition-all duration-300"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline font-medium">Print</span>
          </button>
        </div>
      </div>

      <div className="mb-4 sm:mb-6 grid grid-cols-1 md:grid-cols-4 gap-3 sm:gap-4 animate-slideInUp print:grid-cols-4 flex-shrink-0" style={{ animationDelay: '0.1s' }}>
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700/60 rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Transactions</p>
              <p className="text-xl font-bold text-slate-800 dark:text-white">{reportData?.transactions.length || 0}</p>
            </div>
            <FileText className="w-6 h-6 text-blue-400/60 flex-shrink-0" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700/60 rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">SO Amount</p>
              <p className="text-lg font-bold text-slate-800 dark:text-white truncate">
                {formatCurrency(reportData?.summary.grandTotal.soAmount || 0)}
              </p>
            </div>
            <TrendingUp className="w-6 h-6 text-green-400/60 flex-shrink-0" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700/60 rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">DR Amount</p>
              <p className="text-lg font-bold text-slate-800 dark:text-white truncate">
                {formatCurrency(reportData?.summary.grandTotal.drAmount || 0)}
              </p>
            </div>
            <Receipt className="w-6 h-6 text-amber-400/60 flex-shrink-0" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700/60 rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Invoice Amount</p>
              <p className="text-lg font-bold text-slate-800 dark:text-white truncate">
                {formatCurrency(reportData?.summary.grandTotal.invoiceAmount || 0)}
              </p>
            </div>
            <DollarSign className="w-6 h-6 text-emerald-400/60 flex-shrink-0" />
          </div>
        </div>
      </div>

      {activeTab === 'salesperson' && reportData && (
        <div className="flex-1 min-h-0 animate-slideInUp">
          <SalespersonSummary
            salespersonTotals={reportData.summary.salespersonTotals}
            formatCurrency={formatCurrency}
          />
        </div>
      )}

      {activeTab === 'transactions' && (
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl overflow-hidden shadow-lg print:shadow-none min-h-0">
        <div className="p-4 sm:p-6 border-b border-slate-200/60 dark:border-slate-700/60 flex-shrink-0 space-y-3">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-blue" />
              Transaction Details
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {filteredTransactions.length} transactions
              {selectedCategory && ` in "${selectedCategory}"`}
            </p>
          </div>

          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  selectedCategory === null
                    ? 'bg-brand-blue text-white shadow-md'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                All ({reportData?.transactions.length || 0})
              </button>
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    selectedCategory === category
                      ? 'bg-brand-blue text-white shadow-md'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {category} ({getCategoryCount(category)})
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-x-auto min-h-0">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200/60 dark:border-slate-700/60">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Terms</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Ref #</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">SO #</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">SO Amount</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">DR</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Invoice</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Salesperson</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-700/60">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                    No transactions found{selectedCategory && ` in "${selectedCategory}"`}.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedTransaction(tx)}
                  >
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{formatDate(tx.date)}</td>
                    <td className="px-4 py-3 text-sm text-slate-800 dark:text-white font-medium">{tx.customer}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{tx.terms}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                        tx.type === 'invoice'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : tx.type === 'dr'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400'
                      }`}>
                        {tx.type === 'invoice' ? 'INV' : tx.type === 'dr' ? 'DR' : 'SO'}: {tx.refNo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{tx.soNo}</td>
                    <td className="px-4 py-3 text-sm text-slate-800 dark:text-white font-medium text-right">
                      {tx.soAmount > 0 ? formatCurrency(tx.soAmount) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-800 dark:text-white font-medium text-right">
                      {tx.drAmount > 0 ? formatCurrency(tx.drAmount) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-800 dark:text-white font-medium text-right">
                      {tx.invoiceAmount > 0 ? formatCurrency(tx.invoiceAmount) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{tx.salesperson}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      <SalesReportDetailModal
        isOpen={selectedTransaction !== null}
        onClose={() => setSelectedTransaction(null)}
        transaction={selectedTransaction}
        formatCurrency={formatCurrency}
      />
    </div>
  );
};

export default SalesReportDataView;
