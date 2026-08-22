import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Box,
  CalendarDays,
  CircleHelp,
  ClipboardCheck,
  Download,
  FileDown,
  Filter,
  Lightbulb,
  ListFilter,
  Loader2,
  Package,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Tag,
  Users,
} from 'lucide-react';
import { UserProfile } from '../types';
import {
  CustomerWithInquiries,
  createPurchaseRequestFromSuggestions,
  fetchCustomersWithNotListedInquiries,
  fetchSuggestedStockDetails,
  fetchSuggestedStockSummary,
  SuggestedStockDetail,
  SuggestedStockItem,
} from '../services/suggestedStockService';
import { useToast } from './ToastProvider';
import type { PurchaseRequestWithItems } from '../purchaseRequest.types';
import ModuleRecordLink from './ModuleRecordLink';

interface SuggestedStockReportProps {
  currentUser?: UserProfile | null;
}

type Period = 'today' | 'week' | 'month' | 'year' | 'custom';
type ViewMode = 'summary' | 'detail';
type SortOption = 'inquiries-desc' | 'qty-desc' | 'customers-desc' | 'part-asc';

interface AppliedFilters {
  dateFrom: string;
  dateTo: string;
  customerId: string;
  salesperson: string;
  viewMode: ViewMode;
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

const getPeriodRange = (period: Period, monthValue: string) => {
  const today = new Date();
  if (period === 'month') return getMonthRange(monthValue);
  if (period === 'today') {
    const value = toIsoDate(today);
    return { dateFrom: value, dateTo: value };
  }
  const from = new Date(today);
  if (period === 'week') from.setDate(today.getDate() - 6);
  if (period === 'year') from.setFullYear(today.getFullYear() - 1);
  return { dateFrom: toIsoDate(from), dateTo: toIsoDate(today) };
};

const formatDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const LOAD_BATCH_SIZE = 20;

const SuggestedStockReport: React.FC<SuggestedStockReportProps> = ({ currentUser }) => {
  const [prHistory, setPrHistory] = useState<PurchaseRequestWithItems[]>([]);
  const { addToast } = useToast();
  const currentMonth = toIsoDate(new Date()).slice(0, 7);
  const initialRange = getMonthRange(currentMonth);

  const [period, setPeriod] = useState<Period>('month');
  const [monthValue, setMonthValue] = useState(currentMonth);
  const [dateFrom, setDateFrom] = useState(initialRange.dateFrom);
  const [dateTo, setDateTo] = useState(initialRange.dateTo);
  const [selectedCustomer, setSelectedCustomer] = useState('all');
  const [selectedSalesperson, setSelectedSalesperson] = useState('all');
  const [viewMode, setViewMode] = useState<ViewMode>('summary');
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters>({
    ...initialRange,
    customerId: 'all',
    salesperson: 'all',
    viewMode: 'summary',
  });

  const [customers, setCustomers] = useState<CustomerWithInquiries[]>([]);
  const [summaryData, setSummaryData] = useState<SuggestedStockItem[]>([]);
  const [detailData, setDetailData] = useState<SuggestedStockDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [sortOption, setSortOption] = useState<SortOption>('inquiries-desc');
  const [visibleCount, setVisibleCount] = useState(LOAD_BATCH_SIZE);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [refreshRequest, setRefreshRequest] = useState(0);
  const [isCreatingPR, setIsCreatingPR] = useState(false);
  const [generatedPR, setGeneratedPR] = useState<PurchaseRequestWithItems | null>(null);
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
    try {
      const filters = {
        dateFrom: appliedFilters.dateFrom,
        dateTo: appliedFilters.dateTo,
        customerId: appliedFilters.customerId,
      };
      const [summary, details] = await Promise.all([
        fetchSuggestedStockSummary(filters),
        fetchSuggestedStockDetails(filters),
      ]);
      if (requestId !== loadRequestId.current) return;
      setSummaryData(summary);
      setDetailData(details);
    } finally {
      if (requestId === loadRequestId.current) setIsLoading(false);
    }
  }, [appliedFilters.customerId, appliedFilters.dateFrom, appliedFilters.dateTo, refreshRequest]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const salespeople = useMemo(
    () =>
      Array.from(new Set(detailData.map((item) => item.salesPerson.trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [detailData]
  );

  useEffect(() => {
    if (selectedSalesperson !== 'all' && !salespeople.includes(selectedSalesperson)) {
      setSelectedSalesperson('all');
    }
  }, [salespeople, selectedSalesperson]);

  useEffect(() => {
    if (!dateFrom || !dateTo || dateFrom > dateTo) return;
    const timer = window.setTimeout(() => {
      const nextFilters: AppliedFilters = {
        dateFrom,
        dateTo,
        customerId: selectedCustomer,
        salesperson: selectedSalesperson,
        viewMode,
      };
      setAppliedFilters((current) =>
        current.dateFrom === nextFilters.dateFrom &&
        current.dateTo === nextFilters.dateTo &&
        current.customerId === nextFilters.customerId &&
        current.salesperson === nextFilters.salesperson &&
        current.viewMode === nextFilters.viewMode
          ? current
          : nextFilters
      );
    }, 150);

    return () => window.clearTimeout(timer);
  }, [dateFrom, dateTo, selectedCustomer, selectedSalesperson, viewMode]);

  const visibleDetails = useMemo(
    () =>
      appliedFilters.salesperson === 'all'
        ? detailData
        : detailData.filter((item) => item.salesPerson === appliedFilters.salesperson),
    [appliedFilters.salesperson, detailData]
  );

  const salespersonSummary = useMemo(() => {
    if (appliedFilters.salesperson === 'all') return summaryData;

    const baseByKey = new Map(
      summaryData.map((item) => [
        `${item.partNo}\u0000${item.itemCode}\u0000${item.description}`,
        item,
      ])
    );
    const grouped = new Map<string, SuggestedStockDetail[]>();
    visibleDetails.forEach((item) => {
      const key = `${item.partNo}\u0000${item.itemCode}\u0000${item.description}`;
      grouped.set(key, [...(grouped.get(key) || []), item]);
    });

    return Array.from(grouped.entries()).map(([key, rows]) => {
      const base = baseByKey.get(key);
      const customerMap = new Map(rows.map((row) => [row.customerId, row.customerName]));
      return {
        id: base?.id || rows[0]?.id || key,
        partNo: rows[0]?.partNo || '',
        itemCode: rows[0]?.itemCode || '',
        description: rows[0]?.description || '',
        brand: base?.brand || '',
        databaseItemCode: base?.databaseItemCode || '',
        databasePartNo: base?.databasePartNo || '',
        isListed: base?.isListed || false,
        inquiryCount: rows.length,
        totalQty: rows.reduce((sum, row) => sum + (Number(row.qty) > 0 ? Number(row.qty) : 1), 0),
        customerCount: customerMap.size,
        customers: Array.from(customerMap, ([id, name]) => ({ id, name })),
        remark: base?.remark || '',
        lastInquiryDate: rows.reduce(
          (latest, row) => (row.inquiryDate > latest ? row.inquiryDate : latest),
          ''
        ),
      };
    });
  }, [appliedFilters.salesperson, summaryData, visibleDetails]);

  const sortedSummary = useMemo(() => {
    const rows = [...salespersonSummary];
    rows.sort((a, b) => {
      if (sortOption === 'part-asc') return a.partNo.localeCompare(b.partNo);
      if (sortOption === 'qty-desc') return b.totalQty - a.totalQty;
      if (sortOption === 'customers-desc') return b.customerCount - a.customerCount;
      return b.inquiryCount - a.inquiryCount;
    });
    return rows;
  }, [salespersonSummary, sortOption]);

  const activeRows = appliedFilters.viewMode === 'summary' ? sortedSummary : visibleDetails;
  const visibleItemCount = Math.min(visibleCount, activeRows.length);
  const visibleSummary = sortedSummary.slice(0, visibleCount);
  const visibleDetailRows = visibleDetails.slice(0, visibleCount);
  const hasMoreRows = visibleItemCount < activeRows.length;

  useEffect(() => {
    setVisibleCount(LOAD_BATCH_SIZE);
    setSelectedIds(new Set());
  }, [appliedFilters, sortOption]);

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || isLoading || !hasMoreRows) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisibleCount((current) => Math.min(current + LOAD_BATCH_SIZE, activeRows.length));
      },
      { rootMargin: '320px 0px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeRows.length, hasMoreRows, isLoading]);

  const totalInquiries = salespersonSummary.reduce((sum, item) => sum + item.inquiryCount, 0);
  const totalQty = salespersonSummary.reduce((sum, item) => sum + item.totalQty, 0);
  const uniqueCustomers = new Set(
    salespersonSummary.flatMap((item) => item.customers.map((customer) => customer.id))
  ).size;
  const notListedCount = salespersonSummary.filter((item) => !item.isListed).length;

  const setPeriodAndRange = (nextPeriod: Period) => {
    setPeriod(nextPeriod);
    if (nextPeriod === 'custom') return;
    const range = getPeriodRange(nextPeriod, monthValue);
    setDateFrom(range.dateFrom);
    setDateTo(range.dateTo);
  };

  const applyFilters = () => {
    if (!dateFrom || !dateTo || dateFrom > dateTo) return;
    setAppliedFilters({
      dateFrom,
      dateTo,
      customerId: selectedCustomer,
      salesperson: selectedSalesperson,
      viewMode,
    });
    setRefreshRequest((current) => current + 1);
  };

  const toggleAll = () => {
    const visibleIds =
      appliedFilters.viewMode === 'summary'
        ? visibleSummary.map((item) => item.id)
        : visibleDetailRows.map((item) => item.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
    setSelectedIds((previous) => {
      const next = new Set(previous);
      visibleIds.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });
  };

  const toggleRow = (id: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedSuggestions = useMemo(
    () => summaryData.filter((item) => selectedIds.has(item.id)),
    [selectedIds, summaryData]
  );

  const handleCreatePRForSelected = async () => {
    if (selectedSuggestions.length === 0) return;
    setIsCreatingPR(true);
    try {
      const created = await createPurchaseRequestFromSuggestions(selectedSuggestions);
      setGeneratedPR(created);
      setPrHistory(prev => [created, ...prev]);
      setSelectedIds(new Set());
      addToast({
        type: 'success',
        title: 'Purchase request created',
        description: `${created.pr_number} contains ${selectedSuggestions.length} selected suggestion${selectedSuggestions.length === 1 ? '' : 's'}.`,
      });
    } catch (error: any) {
      addToast({ type: 'error', title: 'Unable to create purchase request', description: error.message });
    } finally {
      setIsCreatingPR(false);
    }
  };

  const exportCsv = () => {
    const escape = (value: unknown) => {
      const text = String(value ?? '');
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const header = [
      'Part Number',
      'Description',
      'Brand',
      'Total Inquiries',
      'Total Qty Requested',
      'Customers',
      'Status',
      'Database Item Code',
      'Database Part Number',
    ];
    const rows = sortedSummary.map((item) => [
      item.partNo,
      item.description,
      item.brand,
      item.inquiryCount,
      item.totalQty,
      item.customerCount,
      item.isListed ? 'Listed' : 'Not Listed',
      item.databaseItemCode,
      item.databasePartNo,
    ]);
    const csv = [header, ...rows].map((row) => row.map(escape).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `item-suggested-for-stock-${appliedFilters.dateFrom}-to-${appliedFilters.dateTo}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleItemAction = (item: SuggestedStockItem) => {
    if (item.isListed) {
      toggleRow(item.id);
      return;
    }
    window.dispatchEvent(
      new CustomEvent('workflow:navigate', {
        detail: {
          tab: 'warehouse-inventory-product-database',
          payload: {
            create: '1',
            partNo: item.partNo,
            description: item.description,
          },
        },
      })
    );
  };

  const filterCardClass = 'rounded-[5px] border border-[#d7dde3] bg-white p-3 shadow-sm';
  const controlClass =
    'h-9 w-full rounded-[4px] border border-[#c9d1d9] bg-white px-3 text-[12px] text-[#34495e] outline-none focus:border-[#6685a4] focus:ring-2 focus:ring-[#6685a4]/15';
  const tableHeaderClass =
    'border-b border-r border-[#d9e0e6] bg-[#f4f6f8] px-2 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.04em] text-[#52606d]';
  const tableCellClass = 'border-b border-r border-[#e2e7eb] px-2 py-2.5 text-[12px] text-[#34495e]';

  const sidebarSteps = [
    [Search, 'Choose a view', 'Select summary or inquiry-level detail.'],
    [CalendarDays, 'Set the period', 'Use a quick period or choose a custom date range.'],
    [Users, 'Narrow the list', 'Filter by customer and salesperson when needed.'],
    [FileDown, 'Generate report', 'Filters update live; use this button to refresh again.'],
    [BarChart3, 'Review demand', 'Compare inquiries, requested quantities, and customers.'],
    [AlertTriangle, 'Check status', 'Prioritize records still marked Not Listed.'],
    [Plus, 'Create missing items', 'Open Product Database for items not yet registered.'],
    [ShoppingCart, 'Add listed items', 'Send an existing item into the purchasing workflow.'],
    [Download, 'Share the result', 'Export the current report or print it.'],
  ] as const;

  return (
    <div className="h-full overflow-y-auto bg-[#f7f9fc] text-slate-900">
      <div className="mx-auto max-w-[1500px] p-5 lg:p-8">
        <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-400"><span>Purchasing</span><span>›</span><span>Reports</span><span>›</span><span className="text-slate-700">Item Suggested for Stock Report</span></div>
            <h1 className="text-2xl font-extrabold uppercase tracking-tight text-[#173c83]">Item Suggested for Stock Report</h1>
            <p className="mt-1 text-sm text-slate-500">Parts requested by customers but not found in the product database.</p>
          </div>
        </header>

        <div className="grid items-start gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="rounded-lg border border-slate-200 bg-[#f8fafb] p-4 shadow-sm xl:order-1">
            <h2 className="border-b border-slate-200 pb-3 text-sm font-bold uppercase text-[#173c83]">PR History</h2>
            <div className="mt-4 space-y-3">
              {prHistory.length === 0 ? (
                <p className="text-sm text-slate-500">No purchase requests created yet.</p>
              ) : (
                prHistory.map((pr) => (
                  <div key={pr.id} className="rounded border border-slate-200 bg-white p-3">
                    <ModuleRecordLink tab="warehouse-purchasing-purchase-request" payload={{ prId: pr.id }} className="block font-bold text-[#173c83] hover:underline">
                      {pr.pr_number}
                    </ModuleRecordLink>
                    <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                      <span>{formatDate(pr.request_date)}</span>
                      <span className="rounded bg-amber-100 px-2 py-0.5 font-bold text-amber-700">{pr.status}</span>
                    </div>
                    <p className="mt-2 text-xs font-semibold text-slate-600">{pr.items?.length || 0} items</p>
                  </div>
                ))
              )}
            </div>
          </aside>

          <main className="min-w-0 xl:order-2">
            <section className="mb-4 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700">
                <CalendarDays className="h-4 w-4 text-[#175fd3]" /> Search by Date
              </div>
              <div className="flex overflow-hidden rounded-md border border-slate-300">
                {(['today', 'week', 'month', 'year'] as Period[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => { setPeriodAndRange(option); setRefreshRequest(c => c + 1); }}
                    className={`border-r border-slate-200 px-4 py-1.5 text-sm font-bold last:border-r-0 ${
                      period === option ? 'bg-[#175fd3] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {option === 'today' ? 'Today' : option === 'week' ? 'This Week' : option === 'month' ? 'This Month' : 'This Year'}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPeriod('custom')}
                  className={`px-4 py-1.5 text-sm font-bold ${
                    period === 'custom' ? 'bg-[#175fd3] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Custom Date
                </button>
              </div>
              {period === 'custom' ? (
                <div className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-[#173c83]">
                  <input type="date" value={dateFrom} max={dateTo} onChange={(event) => setDateFrom(event.target.value)} className="bg-transparent outline-none" />
                  <span>-</span>
                  <input type="date" value={dateTo} min={dateFrom} onChange={(event) => setDateTo(event.target.value)} className="bg-transparent outline-none" />
                  <button type="button" onClick={applyFilters} className="ml-2 rounded bg-[#175fd3] px-2 py-0.5 text-white">Apply</button>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-1.5 text-sm font-bold text-[#173c83]">
                  <CalendarDays className="h-4 w-4" /> {new Date(appliedFilters.dateFrom).toLocaleDateString('en-GB')} - {new Date(appliedFilters.dateTo).toLocaleDateString('en-GB')}
                </div>
              )}
            </section>

            <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-5 py-3 shadow-sm backdrop-blur">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-bold text-slate-700">{selectedIds.size} item(s) selected</span>
                  <button
                    type="button"
                    onClick={handleCreatePRForSelected}
                    disabled={selectedSuggestions.length === 0 || isCreatingPR}
                    className="inline-flex items-center gap-2 rounded-md bg-[#175fd3] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#0e4fb7] disabled:opacity-50"
                  >
                    {isCreatingPR ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Create PR for Selected
                  </button>
                </div>
                <div className="flex items-center gap-2 rounded bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                  <Lightbulb className="h-3.5 w-3.5 text-amber-500" /> These items are not yet in inventory. Create PR to evaluate and purchase.
                </div>
              </div>

              {isLoading ? (
                <div className="flex h-56 items-center justify-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin text-[#175fd3]" /> Loading report data...
                </div>
              ) : visibleSummary.length === 0 ? (
                <div className="flex h-56 flex-col items-center justify-center text-center">
                  <Package className="mb-2 h-10 w-10 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-600">No suggested stock items found.</p>
                  <p className="mt-1 text-xs text-slate-400">Try selecting a different date range.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] border-collapse text-xs">
                    <thead>
                      <tr>
                        <th className="border-b border-slate-200 bg-[#102f76] px-4 py-3 text-center text-white"><input type="checkbox" checked={visibleSummary.length > 0 && visibleSummary.every((item) => selectedIds.has(item.id))} onChange={toggleAll} className="h-4 w-4 rounded border-white/30 bg-white/10" aria-label="Select all items" /></th>
                        <th className="border-b border-slate-200 bg-[#102f76] px-4 py-3 text-left font-bold uppercase tracking-wide text-white">Part No</th>
                        <th className="border-b border-slate-200 bg-[#102f76] px-4 py-3 text-left font-bold uppercase tracking-wide text-white">Description</th>
                        <th className="border-b border-slate-200 bg-[#102f76] px-4 py-3 text-center font-bold uppercase tracking-wide text-white">Customer Requests</th>
                        <th className="border-b border-slate-200 bg-[#102f76] px-4 py-3 text-center font-bold uppercase tracking-wide text-white">Qty Requested (Total)</th>
                        <th className="border-b border-slate-200 bg-[#102f76] px-4 py-3 text-center font-bold uppercase tracking-wide text-white">Customers</th>
                        <th className="border-b border-slate-200 bg-[#102f76] px-4 py-3 text-center font-bold uppercase tracking-wide text-white">Last Requested</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleSummary.map((item) => (
                        <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-3 text-center"><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleRow(item.id)} aria-label={`Select ${item.partNo}`} className="h-4 w-4 rounded border-slate-300" /></td>
                          <td className="px-4 py-3 font-semibold text-[#e85c41]">{item.partNo || '-'}</td>
                          <td className="px-4 py-3 font-semibold text-[#173c83]">{item.description || '-'}</td>
                          <td className="px-4 py-3 text-center font-bold text-[#175fd3]">{item.inquiryCount} requests</td>
                          <td className="px-4 py-3 text-center font-bold text-slate-700">{item.totalQty} pcs</td>
                          <td className="px-4 py-3 text-center font-semibold text-slate-600">{item.customerCount} customers</td>
                          <td className="px-4 py-3 text-center font-semibold text-slate-600">{new Date(item.lastInquiryDate).toLocaleDateString('en-GB')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="sticky left-0 flex min-w-full flex-col gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-500">
                      Showing 1 to {visibleItemCount} of {activeRows.length} items
                    </p>
                    <div ref={loadMoreRef} className="flex min-h-7 items-center gap-2 text-sm font-semibold text-[#175fd3]">
                      {hasMoreRows && (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Scroll to load more</>
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
