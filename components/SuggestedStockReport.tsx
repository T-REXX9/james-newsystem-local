import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  Download,
  Lightbulb,
  ListFilter,
  Loader2,
  Package,
  Plus,
} from 'lucide-react';
import { UserProfile } from '../types';
import {
  CustomerWithInquiries,
  fetchCustomersWithNotListedInquiries,
  fetchSuggestedStockSummaryPage,
  SuggestedStockItem,
} from '../services/suggestedStockService';
import { useToast } from './ToastProvider';

interface SuggestedStockReportProps {
  currentUser?: UserProfile | null;
}

type Period = 'today' | 'week' | 'month' | 'year' | 'custom';
type SortOption = 'description-asc' | 'description-desc' | 'inquiries-desc' | 'inquiries-asc';

interface AppliedFilters {
  dateFrom: string;
  dateTo: string;
  customerId: string;
}

const toIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getMonthRange = (monthValue: string) => {
  const [year, month] = monthValue.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return { dateFrom: toIsoDate(start), dateTo: toIsoDate(end) };
};

const getPeriodRange = (period: Exclude<Period, 'custom'>) => {
  const today = new Date();
  if (period === 'month') return getMonthRange(toIsoDate(today).slice(0, 7));
  if (period === 'today') {
    const value = toIsoDate(today);
    return { dateFrom: value, dateTo: value };
  }
  const from = new Date(today);
  if (period === 'week') from.setDate(today.getDate() - 6);
  if (period === 'year') {
    from.setMonth(0, 1);
  }
  return { dateFrom: toIsoDate(from), dateTo: toIsoDate(today) };
};

const formatDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const summaryRowKey = (item: Pick<SuggestedStockItem, 'id' | 'partNo' | 'itemCode' | 'description'>) =>
  item.id || `${item.partNo}::${item.itemCode}::${item.description}`;

const LOAD_BATCH_SIZE = 20;

const SuggestedStockReport: React.FC<SuggestedStockReportProps> = ({ currentUser: _currentUser }) => {
  const { addToast } = useToast();
  const currentMonth = toIsoDate(new Date()).slice(0, 7);
  const initialRange = getMonthRange(currentMonth);

  const [period, setPeriod] = useState<Period>('month');
  const [dateFrom, setDateFrom] = useState(initialRange.dateFrom);
  const [dateTo, setDateTo] = useState(initialRange.dateTo);
  const [selectedCustomer, setSelectedCustomer] = useState('all');
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters>({
    ...initialRange,
    customerId: 'all',
  });

  const [customers, setCustomers] = useState<CustomerWithInquiries[]>([]);
  const [summaryData, setSummaryData] = useState<SuggestedStockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMorePages, setHasMorePages] = useState(false);
  const [summaryPage, setSummaryPage] = useState(1);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [sortOption, setSortOption] = useState<SortOption>('inquiries-desc');
  const [visibleCount, setVisibleCount] = useState(LOAD_BATCH_SIZE);
  const [refreshRequest, setRefreshRequest] = useState(0);
  const loadRequestId = useRef(0);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoadingCustomers(true);
    void fetchCustomersWithNotListedInquiries(dateFrom, dateTo).then((rows) => {
      if (!active) return;
      setCustomers(rows);
      setSelectedCustomer((current) =>
        current === 'all' || rows.some((customer) => customer.id === current) ? current : 'all'
      );
      setIsLoadingCustomers(false);
    });
    return () => {
      active = false;
    };
  }, [dateFrom, dateTo]);

  const loadReport = useCallback(async () => {
    const requestId = ++loadRequestId.current;
    setIsLoading(true);
    setSummaryPage(1);
    setHasMorePages(false);
    try {
      const result = await fetchSuggestedStockSummaryPage({
        dateFrom: appliedFilters.dateFrom,
        dateTo: appliedFilters.dateTo,
        customerId: appliedFilters.customerId,
      }, 1, 50);
      if (requestId !== loadRequestId.current) return;
      setSummaryData(result.items);
      setHasMorePages(result.hasMore);
      setSummaryPage(1);
    } catch (error) {
      if (requestId !== loadRequestId.current) return;
      setSummaryData([]);
      setHasMorePages(false);
      addToast({
        type: 'error',
        title: 'Unable to load suggested stock report',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      if (requestId === loadRequestId.current) setIsLoading(false);
    }
  }, [addToast, appliedFilters.customerId, appliedFilters.dateFrom, appliedFilters.dateTo, refreshRequest]);

  const loadMoreSummary = useCallback(async () => {
    if (isLoading || isLoadingMore || !hasMorePages) return;
    setIsLoadingMore(true);
    const nextPage = summaryPage + 1;
    try {
      const result = await fetchSuggestedStockSummaryPage({
        dateFrom: appliedFilters.dateFrom,
        dateTo: appliedFilters.dateTo,
        customerId: appliedFilters.customerId,
      }, nextPage, 50);
      setSummaryData((current) => {
        const seen = new Set(current.map((item) => summaryRowKey(item)));
        const merged = [...current];
        result.items.forEach((item) => {
          const key = summaryRowKey(item);
          if (seen.has(key)) return;
          seen.add(key);
          merged.push(item);
        });
        return merged;
      });
      setSummaryPage(nextPage);
      setHasMorePages(result.hasMore);
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Unable to load more items',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsLoadingMore(false);
    }
  }, [addToast, appliedFilters.customerId, appliedFilters.dateFrom, appliedFilters.dateTo, hasMorePages, isLoading, isLoadingMore, summaryPage]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const sortedSummary = useMemo(() => {
    const rows = [...summaryData];
    rows.sort((a, b) => {
      if (sortOption === 'description-asc') return a.description.localeCompare(b.description);
      if (sortOption === 'description-desc') return b.description.localeCompare(a.description);
      if (sortOption === 'inquiries-asc') return a.inquiryCount - b.inquiryCount || a.description.localeCompare(b.description);
      return b.inquiryCount - a.inquiryCount || a.description.localeCompare(b.description);
    });
    return rows;
  }, [summaryData, sortOption]);

  const visibleItemCount = Math.min(visibleCount, sortedSummary.length);
  const visibleSummary = sortedSummary.slice(0, visibleCount);
  const hasMoreRows = visibleItemCount < sortedSummary.length || hasMorePages;

  useEffect(() => {
    setVisibleCount(LOAD_BATCH_SIZE);
  }, [appliedFilters, sortOption, summaryData.length]);

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || isLoading || !hasMoreRows) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        if (visibleCount < sortedSummary.length) {
          setVisibleCount((current) => Math.min(current + LOAD_BATCH_SIZE, sortedSummary.length));
          return;
        }
        if (hasMorePages && !isLoadingMore) {
          void loadMoreSummary();
        }
      },
      { rootMargin: '320px 0px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMorePages, hasMoreRows, isLoading, isLoadingMore, loadMoreSummary, sortedSummary.length, visibleCount]);

  const totalInquiries = sortedSummary.reduce((sum, item) => sum + item.inquiryCount, 0);
  const totalQty = sortedSummary.reduce((sum, item) => sum + item.totalQty, 0);
  const uniqueCustomers = new Set(
    sortedSummary.flatMap((item) => item.customers.map((customer) => customer.id))
  ).size;
  const uniqueItemCount = sortedSummary.length;

  const setPeriodAndRange = (nextPeriod: Period) => {
    setPeriod(nextPeriod);
    if (nextPeriod === 'custom') return;
    const range = getPeriodRange(nextPeriod);
    setDateFrom(range.dateFrom);
    setDateTo(range.dateTo);
    setAppliedFilters({
      ...range,
      customerId: selectedCustomer,
    });
    setRefreshRequest((current) => current + 1);
  };

  const applyFilters = () => {
    if (!dateFrom || !dateTo || dateFrom > dateTo) return;
    setAppliedFilters({
      dateFrom,
      dateTo,
      customerId: selectedCustomer,
    });
    setRefreshRequest((current) => current + 1);
  };

  const resetDateRange = () => {
    const range = getPeriodRange('month');
    setPeriod('month');
    setDateFrom(range.dateFrom);
    setDateTo(range.dateTo);
    setAppliedFilters({
      ...range,
      customerId: selectedCustomer,
    });
    setRefreshRequest((current) => current + 1);
  };

  const dateRangeError = !dateFrom || !dateTo
    ? 'Choose both a start date and an end date.'
    : dateFrom > dateTo
      ? 'Start date must be on or before end date.'
      : '';

  const exportCsv = () => {
    const escape = (value: unknown) => {
      const text = String(value ?? '');
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const header = [
      'Part Number',
      'Item Code',
      'Description',
      'Brand',
      'Total Inquiries',
      'Total Qty Requested',
      'Customers',
      'Last Requested',
    ];
    const rows = sortedSummary.map((item) => [
      item.partNo,
      item.itemCode,
      item.description,
      item.brand,
      item.inquiryCount,
      item.totalQty,
      item.customerCount,
      item.lastInquiryDate,
    ]);
    const csv = [header, ...rows].map((row) => row.map(escape).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `item-suggested-for-stock-${appliedFilters.dateFrom}-to-${appliedFilters.dateTo}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCreateProduct = (item: SuggestedStockItem) => {
    const params = new URLSearchParams({
      create: '1',
      suggestedFrom: '1',
      partNo: item.partNo,
      description: item.description,
      suggestedInquiryItemId: item.id,
    });
    if (item.itemCode) params.set('itemCode', item.itemCode);
    const productDatabaseUrl = new URL(window.location.href);
    productDatabaseUrl.hash = `#/warehouse-inventory-product-database?${params.toString()}`;
    const productWindow = window.open(productDatabaseUrl.toString(), '_blank', 'noopener,noreferrer');

    if (!productWindow) {
      addToast({
        type: 'warning',
        title: 'New tab was blocked',
        description: 'Please allow pop-ups for this system to open Product Database in a separate tab.',
        durationMs: 5000,
      });
    }
  };

  const openReorderReport = () => {
    window.location.hash = '#/warehouse-reports-reorder-report';
  };

  return (
    <div className="h-full overflow-y-auto bg-[#f7f9fc] text-slate-900">
      <div className="mx-auto max-w-[1500px] p-5 lg:p-8">
        <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-400"><span>Purchasing</span><span>›</span><span>Reports</span><span>›</span><span className="text-slate-700">Item Suggested for Stock Report</span></div>
            <h1 className="text-2xl font-extrabold uppercase tracking-tight text-[#173c83]">Item Suggested for Stock Report</h1>
            <p className="mt-1 text-sm text-slate-500">
              Catalog gaps only — parts requested by customers that are not yet in the product database. Once listed, stocking continues on Reorder Report.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              <Download className="h-4 w-4" /> Export CSV
            </button>
            <button
              type="button"
              onClick={openReorderReport}
              className="inline-flex items-center gap-2 rounded-md bg-[#173c83] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#102f76]"
            >
              Open Reorder Report <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="grid items-start gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="rounded-lg border border-slate-200 bg-[#f8fafb] p-4 shadow-sm xl:order-1">
            <h2 className="border-b border-slate-200 pb-3 text-sm font-bold uppercase text-[#173c83]">Workflow</h2>
            <ol className="mt-4 space-y-3 text-sm text-slate-600">
              <li><span className="font-bold text-[#173c83]">1.</span> Review unlisted customer demand below.</li>
              <li><span className="font-bold text-[#173c83]">2.</span> Create the product in Product Database (set reorder qty).</li>
              <li><span className="font-bold text-[#173c83]">3.</span> The item leaves this report once listed.</li>
              <li><span className="font-bold text-[#173c83]">4.</span> Use Reorder Report for PR / PO / receiving.</li>
            </ol>
            <button
              type="button"
              onClick={openReorderReport}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md border border-[#173c83] bg-white px-3 py-2 text-xs font-bold text-[#173c83] transition hover:bg-blue-50"
            >
              Go to Reorder Report <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </aside>

          <main className="min-w-0 xl:order-2">
            <section className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Unique items in report</p><p className="mt-1 text-2xl font-extrabold text-[#173c83]">{uniqueItemCount}</p></div>
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Total inquiries</p><p className="mt-1 text-2xl font-extrabold text-[#175fd3]">{totalInquiries}</p></div>
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Quantity requested</p><p className="mt-1 text-2xl font-extrabold text-slate-700">{totalQty}</p></div>
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Customers / prospects</p><p className="mt-1 text-2xl font-extrabold text-emerald-700">{uniqueCustomers}</p></div>
            </section>

            <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm" aria-label="Report filters and sorting">
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-600">
                    <ListFilter className="h-4 w-4 text-[#175fd3]" /> Sort By
                  </span>
                  <select
                    aria-label="Sort suggested stock items"
                    value={sortOption}
                    onChange={(event) => setSortOption(event.target.value as SortOption)}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-[#175fd3] focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="inquiries-desc">Customer requests — highest first</option>
                    <option value="inquiries-asc">Customer requests — lowest first</option>
                    <option value="description-asc">Description — A to Z</option>
                    <option value="description-desc">Description — Z to A</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-600">
                    Customer
                  </span>
                  <select
                    aria-label="Filter by customer"
                    value={selectedCustomer}
                    onChange={(event) => setSelectedCustomer(event.target.value)}
                    disabled={isLoadingCustomers}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-[#175fd3] focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                  >
                    <option value="all">All customers</option>
                    {customers.map((customer) => (
                      <option key={`${customer.id}-${customer.company}`} value={customer.id}>
                        {customer.company} ({customer.inquiryCount})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-4 border-t border-slate-200 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="flex items-center gap-2 text-sm font-bold text-slate-700">
                      <CalendarDays className="h-4 w-4 text-[#175fd3]" /> Date Range
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">Use a quick range or choose exact start and end dates.</p>
                  </div>
                  <div className="flex flex-wrap overflow-hidden rounded-md border border-slate-300">
                    {(['today', 'week', 'month', 'year'] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setPeriodAndRange(option)}
                        className={`border-r border-slate-200 px-3 py-2 text-xs font-bold last:border-r-0 ${
                          period === option ? 'bg-[#175fd3] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {option === 'today' ? 'Today' : option === 'week' ? 'Last 7 Days' : option === 'month' ? 'This Month' : 'This Year'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3 grid items-end gap-3 sm:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_auto_auto]">
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold text-slate-600">Start date</span>
                    <input
                      aria-label="Start date"
                      type="date"
                      value={dateFrom}
                      onChange={(event) => { setDateFrom(event.target.value); setPeriod('custom'); }}
                      className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-[#175fd3] focus:ring-2 focus:ring-blue-100"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold text-slate-600">End date</span>
                    <input
                      aria-label="End date"
                      type="date"
                      value={dateTo}
                      onChange={(event) => { setDateTo(event.target.value); setPeriod('custom'); }}
                      className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-[#175fd3] focus:ring-2 focus:ring-blue-100"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={applyFilters}
                    disabled={Boolean(dateRangeError)}
                    className="h-10 rounded-md bg-[#175fd3] px-4 text-sm font-bold text-white transition hover:bg-[#0e4fb7] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Apply Filters
                  </button>
                  <button
                    type="button"
                    onClick={resetDateRange}
                    className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                  >
                    Reset
                  </button>
                </div>
                {dateRangeError ? (
                  <p role="alert" className="mt-2 text-xs font-semibold text-rose-600">{dateRangeError}</p>
                ) : (
                  <p className="mt-2 text-xs font-semibold text-[#173c83]">
                    Showing {formatDate(appliedFilters.dateFrom)} through {formatDate(appliedFilters.dateTo)}
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-5 py-3 shadow-sm backdrop-blur">
                <p className="text-sm font-bold text-slate-700">
                  {uniqueItemCount} unlisted item{uniqueItemCount === 1 ? '' : 's'} needing catalog entry
                </p>
                <div className="flex items-center gap-2 rounded bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                  <Lightbulb className="h-3.5 w-3.5 text-amber-500" /> Create each product with a reorder quantity so it can appear on Reorder Report.
                </div>
              </div>

              {isLoading ? (
                <div className="flex h-56 items-center justify-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin text-[#175fd3]" /> Loading report data...
                </div>
              ) : visibleSummary.length === 0 ? (
                <div className="flex h-56 flex-col items-center justify-center text-center">
                  <Package className="mb-2 h-10 w-10 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-600">No unlisted suggested stock items found.</p>
                  <p className="mt-1 text-xs text-slate-400">Listed demand is handled on Reorder Report. Try a different date range or customer filter.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] border-collapse text-xs">
                    <thead>
                      <tr>
                        <th className="border-b border-slate-200 bg-[#102f76] px-4 py-3 text-left font-bold uppercase tracking-wide text-white">Part No</th>
                        <th className="border-b border-slate-200 bg-[#102f76] px-4 py-3 text-left font-bold uppercase tracking-wide text-white">Description</th>
                        <th className="border-b border-slate-200 bg-[#102f76] px-4 py-3 text-center font-bold uppercase tracking-wide text-white">Customer Requests</th>
                        <th className="border-b border-slate-200 bg-[#102f76] px-4 py-3 text-center font-bold uppercase tracking-wide text-white">Qty Requested (Total)</th>
                        <th className="border-b border-slate-200 bg-[#102f76] px-4 py-3 text-center font-bold uppercase tracking-wide text-white">Customers</th>
                        <th className="border-b border-slate-200 bg-[#102f76] px-4 py-3 text-center font-bold uppercase tracking-wide text-white">Last Requested</th>
                        <th className="border-b border-slate-200 bg-[#102f76] px-4 py-3 text-center font-bold uppercase tracking-wide text-white">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleSummary.map((item) => (
                        <tr key={summaryRowKey(item)} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-3 font-semibold text-[#e85c41]">{item.partNo || '-'}</td>
                          <td className="px-4 py-3 font-semibold text-[#173c83]">{item.description || '-'}</td>
                          <td className="px-4 py-3 text-center font-bold text-[#175fd3]">{item.inquiryCount} requests</td>
                          <td className="px-4 py-3 text-center font-bold text-slate-700">{item.totalQty} pcs</td>
                          <td className="px-4 py-3 text-center font-semibold text-slate-600">{item.customerCount} customers</td>
                          <td className="px-4 py-3 text-center font-semibold text-slate-600">{item.lastInquiryDate ? new Date(item.lastInquiryDate).toLocaleDateString('en-GB') : '-'}</td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleCreateProduct(item)}
                              className="inline-flex items-center gap-1 rounded-md border border-[#175fd3] bg-white px-3 py-1.5 text-xs font-bold text-[#175fd3] transition hover:bg-blue-50"
                            >
                              <Plus className="h-3.5 w-3.5" /> Create
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="sticky left-0 flex min-w-full flex-col gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-500">
                      Showing 1 to {visibleItemCount} of {sortedSummary.length} items
                    </p>
                    <div ref={loadMoreRef} className="flex min-h-7 items-center gap-2 text-sm font-semibold text-[#175fd3]">
                      {(hasMoreRows || isLoadingMore) && (
                        <><Loader2 className="h-4 w-4 animate-spin" /> {isLoadingMore ? 'Loading more items...' : 'Scroll to load more'}</>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </main>
        </div>
      </div>
    </div>
  );
};

export default SuggestedStockReport;
