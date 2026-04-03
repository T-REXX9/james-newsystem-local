import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  ChevronLeft,
  FileText,
  Package,
  Printer,
  Search,
  Sparkles,
  Target,
  TrendingDown,
  Users,
} from 'lucide-react';
import CustomLoadingSpinner from './CustomLoadingSpinner';
import {
  getSalesDevelopmentDemandSummaryLocal,
  getSalesDevelopmentReportDataLocal,
} from '../services/salesDevelopmentReportLocalApiService';
import InquiryDetailsModal from './InquiryDetailsModal';
import DemandSummaryModal from './DemandSummaryModal';

interface SalesDevelopmentReportDataViewProps {
  dateFrom: string;
  dateTo: string;
  reportCategory: 'not_purchase' | 'no_stock';
  onBack: () => void;
}

type InquiryRow = {
  id: string;
  inquiry_id: string;
  inquiry_no: string;
  customer_company: string;
  sales_person: string;
  sales_date: string;
  part_no: string;
  item_code: string;
  description: string;
  qty: number;
  unit_price: number;
  amount: number;
  remark: string;
};

type DemandSummaryRow = {
  part_no: string;
  item_code: string;
  description: string;
  total_quantity: number;
  inquiry_count: number;
  customer_count: number;
  average_price: number;
};

type SortKey = 'amount' | 'qty' | 'date' | 'customers' | 'value';

const SalesDevelopmentReportDataView: React.FC<SalesDevelopmentReportDataViewProps> = ({
  dateFrom,
  dateTo,
  reportCategory,
  onBack,
}) => {
  const [inquiries, setInquiries] = useState<InquiryRow[]>([]);
  const [demandSummary, setDemandSummary] = useState<DemandSummaryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedInquiry, setSelectedInquiry] = useState<InquiryRow | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<DemandSummaryRow | null>(null);
  const [inquirySearch, setInquirySearch] = useState('');
  const [summarySearch, setSummarySearch] = useState('');
  const [inquirySort, setInquirySort] = useState<SortKey>('amount');
  const [summarySort, setSummarySort] = useState<SortKey>('value');
  const [activeTab, setActiveTab] = useState<'inquiry' | 'demand'>('inquiry');

  useEffect(() => {
    loadReportData();
  }, [dateFrom, dateTo, reportCategory]);

  const loadReportData = async () => {
    setIsLoading(true);
    try {
      const [inquiryData, summaryData] = await Promise.all([
        getSalesDevelopmentReportDataLocal(dateFrom, dateTo, reportCategory),
        getSalesDevelopmentDemandSummaryLocal(dateFrom, dateTo, reportCategory),
      ]);
      setInquiries(inquiryData);
      setDemandSummary(summaryData);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);

  const formatCompactCurrency = (amount: number) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString || 'N/A';

    return date.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const categoryTitle =
    reportCategory === 'not_purchase' ? 'Not Purchased (Lost Sales)' : 'No Stock (Unmet Demand)';

  const categoryDesc =
    reportCategory === 'not_purchase'
      ? 'Items marked "On Stock" but no sales order generated.'
      : 'Items marked "Out of Stock" when customers inquired.';

  const potentialValue = useMemo(
    () => demandSummary.reduce((sum, item) => sum + item.total_quantity * (item.average_price || 0), 0),
    [demandSummary]
  );

  const totalInquiryQuantity = useMemo(
    () => inquiries.reduce((sum, item) => sum + (item.qty || 0), 0),
    [inquiries]
  );

  const activeCustomers = useMemo(
    () =>
      new Set(
        inquiries
          .map((item) => item.customer_company?.trim())
          .filter((value) => value && value !== 'N/A')
      ).size,
    [inquiries]
  );

  const averageInquiryValue = inquiries.length > 0 ? potentialValue / inquiries.length : 0;
  const repeatDemandItems = demandSummary.filter((item) => item.inquiry_count > 1).length;

  const topDemandItem = useMemo(() => {
    if (demandSummary.length === 0) return null;

    return [...demandSummary].sort((a, b) => {
      const valueGap = b.total_quantity * (b.average_price || 0) - a.total_quantity * (a.average_price || 0);
      if (valueGap !== 0) return valueGap;
      return b.total_quantity - a.total_quantity;
    })[0];
  }, [demandSummary]);

  const filteredInquiries = useMemo(() => {
    const term = inquirySearch.trim().toLowerCase();
    const scoped = !term
      ? inquiries
      : inquiries.filter((item) =>
          [
            item.inquiry_no,
            item.customer_company,
            item.sales_person,
            item.part_no,
            item.item_code,
            item.description,
          ]
            .join(' ')
            .toLowerCase()
            .includes(term)
        );

    return [...scoped].sort((a, b) => {
      switch (inquirySort) {
        case 'qty':
          return b.qty - a.qty;
        case 'date':
          return new Date(b.sales_date).getTime() - new Date(a.sales_date).getTime();
        case 'amount':
        default:
          return b.amount - a.amount;
      }
    });
  }, [inquiries, inquirySearch, inquirySort]);

  const filteredDemandSummary = useMemo(() => {
    const term = summarySearch.trim().toLowerCase();
    const scoped = !term
      ? demandSummary
      : demandSummary.filter((item) =>
          [item.part_no, item.item_code, item.description].join(' ').toLowerCase().includes(term)
        );

    return [...scoped].sort((a, b) => {
      switch (summarySort) {
        case 'qty':
          return b.total_quantity - a.total_quantity;
        case 'customers':
          return b.customer_count - a.customer_count;
        case 'value':
        default:
          return b.total_quantity * (b.average_price || 0) - a.total_quantity * (a.average_price || 0);
      }
    });
  }, [demandSummary, summarySearch, summarySort]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-50 via-slate-50/95 to-blue-50/30 dark:from-slate-950 dark:via-slate-950 dark:to-blue-950/20">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-brand-blue opacity-15 blur-2xl animate-pulse" />
            <div className="relative">
              <CustomLoadingSpinner label="Loading" />
            </div>
          </div>
          <div className="space-y-2 text-center">
            <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">Generating Report</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Please wait while we compile your data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-gradient-to-br from-slate-50 via-slate-50/95 to-blue-50/30 p-4 sm:p-6 print:bg-white print:p-0 dark:from-slate-950 dark:via-slate-950 dark:to-blue-950/20 lg:p-8">
      <div className="mb-4 sm:mb-6 flex flex-col items-start justify-between gap-4 print:mb-6 lg:flex-row lg:items-center flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="group relative rounded-xl border border-slate-200/60 bg-white p-2.5 text-slate-500 shadow-sm transition-all duration-300 hover:bg-slate-50 hover:text-brand-blue print:hidden dark:border-slate-700/60 dark:bg-slate-900/80 dark:hover:bg-slate-800"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-slate-800 print:text-black dark:text-white md:text-3xl">
              Sales Development Report
            </h1>
            <p className="text-sm text-slate-600 print:text-gray-600 dark:text-slate-400">
              {categoryTitle} • {dateFrom} to {dateTo}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm p-1 rounded-xl flex items-center border border-slate-200/60 dark:border-slate-700/60 shadow-sm">
            <button
              onClick={() => setActiveTab('inquiry')}
              className={`relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${activeTab === 'inquiry'
                ? 'bg-brand-blue text-white shadow-md'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Inquiries</span>
            </button>
            <button
              onClick={() => setActiveTab('demand')}
              className={`relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${activeTab === 'demand'
                ? 'bg-brand-blue text-white shadow-md'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Demand</span>
            </button>
          </div>

          <button
            onClick={handlePrint}
            className="group relative flex items-center gap-2 rounded-xl border border-slate-200/60 bg-white px-6 py-3 text-slate-600 transition-all duration-300 hover:bg-slate-50 hover:text-brand-blue dark:border-slate-700/60 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Printer className="h-4 w-4" />
            <span className="hidden font-medium sm:inline">Print</span>
          </button>
        </div>
      </div>

      <div className="mb-4 sm:mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 animate-slideInUp flex-shrink-0">
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700/60 rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Total Inquiries</p>
              <p className="text-xl font-bold text-slate-800 dark:text-white">{inquiries.length}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">{activeCustomers} customers</p>
            </div>
            <FileText className="w-6 h-6 text-blue-400/60 flex-shrink-0" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700/60 rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Total Quantity</p>
              <p className="text-xl font-bold text-slate-800 dark:text-white">{totalInquiryQuantity.toLocaleString('en-PH')}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">{repeatDemandItems} repeat items</p>
            </div>
            <Package className="w-6 h-6 text-amber-400/60 flex-shrink-0" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700/60 rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Unique Items</p>
              <p className="text-xl font-bold text-slate-800 dark:text-white">{demandSummary.length}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">{topDemandItem ? topDemandItem.part_no : 'N/A'}</p>
            </div>
            <TrendingDown className="w-6 h-6 text-rose-400/60 flex-shrink-0" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700/60 rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Potential Value</p>
              <p className="text-lg font-bold text-slate-800 dark:text-white">{formatCompactCurrency(potentialValue)}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">{formatCurrency(potentialValue)}</p>
            </div>
            <Users className="w-6 h-6 text-emerald-400/60 flex-shrink-0" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700/60 rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Avg Per Inquiry</p>
              <p className="text-lg font-bold text-slate-800 dark:text-white">{formatCompactCurrency(averageInquiryValue)}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">{categoryTitle}</p>
            </div>
            <Target className="w-6 h-6 text-violet-400/60 flex-shrink-0" />
          </div>
        </div>
      </div>

      {activeTab === 'inquiry' && (
      <section className="flex-1 flex flex-col bg-white dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl overflow-hidden shadow-lg print:shadow-none min-h-0">
        <div className="p-4 sm:p-6 border-b border-slate-200/60 dark:border-slate-700/60 flex-shrink-0">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-1">
            <FileText className="w-5 h-5 text-brand-blue" />
            Detailed Inquiry Log
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {filteredInquiries.length} visible rows — Search by inquiry, customer, item, or salesperson and sort the list
          </p>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-3 sm:mt-4">
            <div className="flex-1">
              <SearchField
                value={inquirySearch}
                onChange={setInquirySearch}
                placeholder="Search inquiry, customer, part no..."
              />
            </div>
            <div className="flex gap-2">
              <SortToggle
                value={inquirySort}
                options={[
                  { key: 'amount', label: 'Highest value' },
                  { key: 'qty', label: 'Highest qty' },
                  { key: 'date', label: 'Latest date' },
                ]}
                onChange={(value) => setInquirySort(value as SortKey)}
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full min-w-[980px]">
            <thead className="sticky top-0 z-10 border-b border-slate-200/80 bg-slate-50/95 backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-800/95">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Inquiry</th>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Date</th>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Salesperson</th>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Item</th>
                <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Qty</th>
                <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Amount</th>
                <th className="px-6 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-700/60">
              {filteredInquiries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-slate-500 dark:text-slate-400">
                    No inquiries matched the current search and filters.
                  </td>
                </tr>
              ) : (
                filteredInquiries.map((inquiry, idx) => (
                  <tr
                    key={inquiry.id}
                    className={`cursor-pointer transition-all ${
                      idx % 2 === 0 ? 'bg-white/80 dark:bg-slate-900/10' : 'bg-slate-50/55 dark:bg-slate-800/10'
                    } hover:bg-blue-50/70 dark:hover:bg-slate-800/40`}
                    onClick={() => setSelectedInquiry(inquiry)}
                  >
                    <td className="px-4 sm:px-6 py-2 align-top">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">{inquiry.inquiry_no}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">Tap to inspect</span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-2 align-top text-sm text-slate-600 dark:text-slate-400">
                      {formatDate(inquiry.sales_date)}
                    </td>
                    <td className="px-4 sm:px-6 py-2 align-top">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                          {inquiry.customer_company || 'N/A'}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{inquiry.item_code || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-2 align-top text-sm text-slate-600 dark:text-slate-400">
                      {inquiry.sales_person || 'Unassigned'}
                    </td>
                    <td className="px-4 sm:px-6 py-2 align-top">
                      <div className="space-y-1">
                        <span className="inline-flex rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {inquiry.part_no || 'N/A'}
                        </span>
                        <p className="max-w-xs text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                          {inquiry.description || 'N/A'}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-2 align-top text-right text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {inquiry.qty.toLocaleString('en-PH')}
                    </td>
                    <td className="px-4 sm:px-6 py-2 align-top text-right">
                      <span className="inline-flex rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        {formatCurrency(inquiry.amount)}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-2 text-center align-top">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedInquiry(inquiry);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition-all hover:-translate-y-0.5 hover:shadow-blue-500/35"
                      >
                        <ArrowUpRight className="h-3 w-3" />
                        <span className="hidden sm:inline">View</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {activeTab === 'demand' && (
      <section className="flex-1 flex flex-col bg-white dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl overflow-hidden shadow-lg print:shadow-none min-h-0">
        <div className="p-4 sm:p-6 border-b border-slate-200/60 dark:border-slate-700/60 flex-shrink-0">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-1">
            <Package className="w-5 h-5 text-brand-blue" />
            Demand Summary
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {filteredDemandSummary.length} visible items — Prioritize by value, quantity, or customer reach to find high-opportunity items
          </p>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-3 sm:mt-4">
            <div className="flex-1">
              <SearchField
                value={summarySearch}
                onChange={setSummarySearch}
                placeholder="Search part no, code, description..."
              />
            </div>
            <div className="flex gap-2">
              <SortToggle
                value={summarySort}
                options={[
                  { key: 'value', label: 'Highest value' },
                  { key: 'qty', label: 'Highest qty' },
                  { key: 'customers', label: 'Most customers' },
                ]}
                onChange={(value) => setSummarySort(value as SortKey)}
              />
            </div>
          </div>
        </div>

        <div className="border-b border-slate-200/60 px-4 sm:px-6 py-3 dark:border-slate-700/60 flex-shrink-0">
          <div className="grid gap-2 md:grid-cols-3 text-sm">
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Potential Value</p>
              <p className="text-base font-bold text-slate-800 dark:text-white mt-1">{formatCurrency(potentialValue)}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Item Demand</p>
              <p className="text-base font-bold text-slate-800 dark:text-white mt-1">{demandSummary.reduce((sum, item) => sum + item.total_quantity, 0).toLocaleString('en-PH')} qty</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Repeat Demand Items</p>
              <p className="text-base font-bold text-slate-800 dark:text-white mt-1">{repeatDemandItems}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full min-w-[920px]">
            <thead className="sticky top-0 z-10 border-b border-slate-200/80 bg-slate-50/95 backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-800/95">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Part No</th>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Description</th>
                <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Total Qty</th>
                <th className="px-6 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Inquiries</th>
                <th className="px-6 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Customers</th>
                <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Potential Value</th>
                <th className="px-6 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-700/60">
              {filteredDemandSummary.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-500 dark:text-slate-400">
                    No demand items matched the current search and filters.
                  </td>
                </tr>
              ) : (
                filteredDemandSummary.map((summary, idx) => (
                  <tr
                    key={summary.part_no}
                    className={`cursor-pointer transition-all ${
                      idx % 2 === 0 ? 'bg-white/80 dark:bg-slate-900/10' : 'bg-slate-50/55 dark:bg-slate-800/10'
                    } hover:bg-emerald-50/70 dark:hover:bg-slate-800/40`}
                    onClick={() => setSelectedSummary(summary)}
                  >
                    <td className="px-4 sm:px-6 py-2 align-top">
                      <div className="space-y-1">
                        <span className="inline-flex rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-800 dark:bg-slate-800 dark:text-white">
                          {summary.part_no}
                        </span>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{summary.item_code || 'N/A'}</p>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-2 align-top">
                      <p className="max-w-xs text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
                        {summary.description || 'N/A'}
                      </p>
                    </td>
                    <td className="px-4 sm:px-6 py-2 align-top text-right text-sm font-semibold text-slate-800 dark:text-white">
                      {summary.total_quantity.toLocaleString('en-PH')}
                    </td>
                    <td className="px-4 sm:px-6 py-2 text-center align-top">
                      <span className="inline-flex rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        {summary.inquiry_count.toLocaleString('en-PH')}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-2 text-center align-top">
                      <span className="inline-flex rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        {summary.customer_count.toLocaleString('en-PH')}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-2 align-top text-right">
                      <span className="inline-flex rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        {formatCurrency(summary.total_quantity * (summary.average_price || 0))}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-2 text-center align-top">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSummary(summary);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-emerald-500/20 transition-all hover:-translate-y-0.5 hover:shadow-emerald-500/35"
                      >
                        <ArrowUpRight className="h-3 w-3" />
                        <span className="hidden sm:inline">View</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      )}

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

const SearchField: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}> = ({ value, onChange, placeholder }) => (
  <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-all focus-within:border-brand-blue/50 focus-within:ring-2 focus-within:ring-brand-blue/15 dark:border-slate-700 dark:bg-slate-900/80">
    <Search className="h-4 w-4 text-slate-400" />
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-100"
    />
  </label>
);

const SortToggle: React.FC<{
  value: string;
  options: Array<{ key: string; label: string }>;
  onChange: (value: string) => void;
}> = ({ value, options, onChange }) => (
  <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
    {options.map((option) => (
      <button
        key={option.key}
        onClick={() => onChange(option.key)}
        className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
          value === option.key
            ? 'bg-brand-blue text-white shadow-md'
            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
        }`}
      >
        {option.label}
      </button>
    ))}
  </div>
);


export default SalesDevelopmentReportDataView;
