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
  const [showSalespersonSummary, setShowSalespersonSummary] = useState(false);

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

  const groupTransactionsByCategory = () => {
    if (!reportData) return {};

    const grouped: Record<string, SalesReportTransaction[]> = {};
    for (const tx of reportData.transactions) {
      if (!grouped[tx.category]) {
        grouped[tx.category] = [];
      }
      grouped[tx.category].push(tx);
    }
    return grouped;
  };

  const getCategoryTotal = (category: string): CategoryTotal | undefined => {
    return reportData?.summary.categoryTotals.find((c) => c.category === category);
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

  const groupedTransactions = groupTransactionsByCategory();
  const categories = Object.keys(groupedTransactions).sort();

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 via-slate-50/95 to-blue-50/30 dark:from-slate-950 dark:via-slate-950 dark:to-blue-950/20 p-6 md:p-8 lg:p-10 animate-fadeIn print:p-0 print:bg-white overflow-y-auto">
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
              Sales Report
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 print:text-gray-600">
              {formatDate(dateFrom)} to {formatDate(dateTo)} | {customerId === 'all' ? 'All Customers' : 'Selected Customer'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 print:hidden">
          <button
            onClick={() => setShowSalespersonSummary(!showSalespersonSummary)}
            className={`group relative flex items-center gap-2 px-6 py-3 border rounded-xl transition-all duration-300 ${
              showSalespersonSummary
                ? 'bg-brand-blue text-white border-brand-blue'
                : 'bg-white dark:bg-slate-900/80 border-slate-200/60 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 hover:text-brand-blue hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline font-medium">Salesperson Summary</span>
          </button>
          <button
            onClick={handlePrint}
            className="group relative flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-700/60 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-brand-blue transition-all duration-300"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline font-medium">Print</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 animate-slideInUp print:grid-cols-4" style={{ animationDelay: '0.1s' }}>
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700/60 rounded-xl p-6 print:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Transactions</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{reportData?.transactions.length || 0}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-400/60" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700/60 rounded-xl p-6 print:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">SO Amount</p>
              <p className="text-xl font-bold text-slate-800 dark:text-white">
                {formatCurrency(reportData?.summary.grandTotal.soAmount || 0)}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-400/60" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700/60 rounded-xl p-6 print:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">DR Amount</p>
              <p className="text-xl font-bold text-slate-800 dark:text-white">
                {formatCurrency(reportData?.summary.grandTotal.drAmount || 0)}
              </p>
            </div>
            <Receipt className="w-8 h-8 text-amber-400/60" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700/60 rounded-xl p-6 print:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Invoice Amount</p>
              <p className="text-xl font-bold text-slate-800 dark:text-white">
                {formatCurrency(reportData?.summary.grandTotal.invoiceAmount || 0)}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-emerald-400/60" />
          </div>
        </div>
      </div>

      {showSalespersonSummary && reportData && (
        <div className="mb-8 animate-slideInUp">
          <SalespersonSummary
            salespersonTotals={reportData.summary.salespersonTotals}
            formatCurrency={formatCurrency}
          />
        </div>
      )}

      <div className="bg-white dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl overflow-hidden shadow-lg print:shadow-none">
        <div className="p-6 border-b border-slate-200/60 dark:border-slate-700/60">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-blue" />
            Transaction Details
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Grouped by product category with subtotals</p>
        </div>

        <div className="overflow-x-auto">
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
              {categories.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                    No transactions found for the selected period.
                  </td>
                </tr>
              ) : (
                categories.map((category) => {
                  const transactions = groupedTransactions[category];
                  const categoryTotal = getCategoryTotal(category);

                  return (
                    <React.Fragment key={category}>
                      <tr className="bg-slate-100/50 dark:bg-slate-800/30">
                        <td colSpan={9} className="px-4 py-2">
                          <span className="font-bold text-sm text-brand-blue">{category}</span>
                        </td>
                      </tr>

                      {transactions.map((tx) => (
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
                              tx.type === 'invoice' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            }`}>
                              {tx.type === 'invoice' ? 'INV' : 'DR'}: {tx.refNo}
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
                      ))}

                      <tr className="bg-slate-50 dark:bg-slate-800/50 font-semibold">
                        <td colSpan={5} className="px-4 py-2 text-right text-sm text-slate-700 dark:text-slate-300">
                          {category} Subtotal:
                        </td>
                        <td className="px-4 py-2 text-sm text-slate-800 dark:text-white text-right">
                          {formatCurrency(categoryTotal?.soAmount || 0)}
                        </td>
                        <td className="px-4 py-2 text-sm text-slate-800 dark:text-white text-right">
                          {formatCurrency(categoryTotal?.drAmount || 0)}
                        </td>
                        <td className="px-4 py-2 text-sm text-slate-800 dark:text-white text-right">
                          {formatCurrency(categoryTotal?.invoiceAmount || 0)}
                        </td>
                        <td></td>
                      </tr>
                    </React.Fragment>
                  );
                })
              )}

              {categories.length > 0 && (
                <tr className="bg-brand-blue/10 dark:bg-brand-blue/20 font-bold">
                  <td colSpan={5} className="px-4 py-3 text-right text-sm text-brand-blue">
                    Grand Total:
                  </td>
                  <td className="px-4 py-3 text-sm text-brand-blue text-right">
                    {formatCurrency(reportData?.summary.grandTotal.soAmount || 0)}
                  </td>
                  <td className="px-4 py-3 text-sm text-brand-blue text-right">
                    {formatCurrency(reportData?.summary.grandTotal.drAmount || 0)}
                  </td>
                  <td className="px-4 py-3 text-sm text-brand-blue text-right">
                    {formatCurrency(reportData?.summary.grandTotal.invoiceAmount || 0)}
                  </td>
                  <td></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
