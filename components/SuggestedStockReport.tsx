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
  fetchCustomersWithNotListedInquiries,
  fetchSuggestedStockDetails,
  fetchSuggestedStockSummary,
  SuggestedStockDetail,
  SuggestedStockItem,
} from '../services/suggestedStockService';
import AddToPurchaseRequestModal from './AddToPurchaseRequestModal';

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
  const [selectedItem, setSelectedItem] = useState<SuggestedStockItem | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
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
      setSelectedItem(item);
      setShowPurchaseModal(true);
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
    <div className="h-full overflow-auto bg-[#eef1f4] text-[#263f4f]">
      <div className="mx-auto max-w-[1680px] p-4 lg:p-5">
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_286px]">
          <main className="min-w-0 space-y-4">
            <header className="flex flex-col gap-4 rounded-[5px] border border-[#d5dce2] bg-white p-5 shadow-sm md:flex-row md:items-start md:justify-between">
              <div className="max-w-4xl">
                <h1 className="text-[25px] font-bold uppercase tracking-[0.02em] text-[#263f4f]">
                  Item Suggested for Stock Report
                </h1>
                <p className="mt-1 text-[14px] font-bold text-[#c44743]">
                  Find requested parts that still need an inventory decision.
                </p>
                <p className="mt-2 max-w-3xl text-[12px] leading-5 text-[#71808d]">
                  This report groups inquiry items marked Not Listed. Each inquiry counts once, and a blank or zero
                  requested quantity counts as one.
                </p>
              </div>
              <div className="flex shrink-0 flex-row gap-2 md:w-[190px] md:flex-col">
                <button
                  type="button"
                  onClick={applyFilters}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-[4px] border border-[#54718d] bg-[#6685a4] px-4 text-[12px] font-semibold text-white hover:bg-[#516c87]"
                >
                  <FileDown className="h-4 w-4" />
                  Generate Report
                </button>
                <button
                  type="button"
                  onClick={exportCsv}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-[4px] border border-[#b9c4cc] bg-white px-4 text-[12px] font-semibold text-[#516c87] hover:bg-[#f5f7f8]"
                >
                  <Download className="h-4 w-4 text-[#d74b4b]" />
                  Export CSV
                </button>
              </div>
            </header>

            <section className="grid gap-2 lg:grid-cols-5">
              <div className={filterCardClass}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#6685a4] text-[10px] font-bold text-white">1</span>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-[#52606d]">View By</span>
                </div>
                <select value={viewMode} onChange={(event) => setViewMode(event.target.value as ViewMode)} className={controlClass}>
                  <option value="summary">Items Summary</option>
                  <option value="detail">Inquiry Details</option>
                </select>
              </div>

              <div className={filterCardClass}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#6685a4] text-[10px] font-bold text-white">2</span>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-[#52606d]">Period</span>
                </div>
                <div className="grid grid-cols-4 overflow-hidden rounded-[4px] border border-[#c9d1d9]">
                  {(['today', 'week', 'month', 'year'] as Period[]).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setPeriodAndRange(option)}
                      className={`h-[34px] border-r border-[#d7dde3] text-[9px] font-bold uppercase last:border-r-0 ${
                        period === option ? 'bg-[#6685a4] text-white' : 'bg-white text-[#647482] hover:bg-[#f1f4f6]'
                      }`}
                    >
                      {option === 'today' ? 'Day' : option}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => setPeriodAndRange('custom')} className="mt-1 text-[10px] font-semibold text-[#6685a4] hover:underline">
                  Custom range
                </button>
              </div>

              <div className={filterCardClass}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#6685a4] text-[10px] font-bold text-white">3</span>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-[#52606d]">Month</span>
                </div>
                <input
                  type="month"
                  value={monthValue}
                  onChange={(event) => {
                    setMonthValue(event.target.value);
                    setPeriod('month');
                    const range = getMonthRange(event.target.value);
                    setDateFrom(range.dateFrom);
                    setDateTo(range.dateTo);
                  }}
                  className={controlClass}
                />
              </div>

              <div className={filterCardClass}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#6685a4] text-[10px] font-bold text-white">4</span>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-[#52606d]">Customer</span>
                </div>
                <select value={selectedCustomer} onChange={(event) => setSelectedCustomer(event.target.value)} className={controlClass} disabled={isLoadingCustomers}>
                  <option value="all">{isLoadingCustomers ? 'Loading customers...' : 'All Customers'}</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>{customer.company} ({customer.inquiryCount})</option>
                  ))}
                </select>
              </div>

              <div className={filterCardClass}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#6685a4] text-[10px] font-bold text-white">5</span>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-[#52606d]">Salesperson</span>
                </div>
                <select value={selectedSalesperson} onChange={(event) => setSelectedSalesperson(event.target.value)} className={controlClass}>
                  <option value="all">All Salespersons</option>
                  {salespeople.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </div>
            </section>

            {period === 'custom' && (
              <section className="flex flex-wrap items-end gap-3 rounded-[5px] border border-[#d7dde3] bg-white p-3 shadow-sm">
                <label className="text-[11px] font-semibold text-[#52606d]">
                  Date From
                  <input type="date" value={dateFrom} max={dateTo} onChange={(event) => setDateFrom(event.target.value)} className={`${controlClass} mt-1 w-44`} />
                </label>
                <label className="text-[11px] font-semibold text-[#52606d]">
                  Date To
                  <input type="date" value={dateTo} min={dateFrom} onChange={(event) => setDateTo(event.target.value)} className={`${controlClass} mt-1 w-44`} />
                </label>
                {dateFrom > dateTo && <span className="pb-2 text-[11px] font-semibold text-[#c44743]">Date To must be after Date From.</span>}
              </section>
            )}

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                [Package, 'Unique Not Listed Items', notListedCount, 'Need inventory setup', '#d9534f', '#fbeaea'],
                [BarChart3, 'Total Inquiries', totalInquiries, 'Within selected period', '#6685a4', '#eaf0f6'],
                [Users, 'Customers / Prospects', uniqueCustomers, 'Unique requesters', '#5cb85c', '#ebf7eb'],
                [Box, 'Total Qty Requested', totalQty, 'Blank quantity = 1', '#8a6d3b', '#fff5df'],
              ].map(([Icon, label, value, caption, color, background]) => (
                <article key={String(label)} className="flex min-h-[104px] items-center gap-3 rounded-[5px] border border-[#d7dde3] bg-white p-4 shadow-sm">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ color: String(color), backgroundColor: String(background) }}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[10px] font-bold uppercase leading-4 tracking-wide text-[#71808d]">{label}</p>
                    <p className="text-[25px] font-bold leading-8 text-[#263f4f]">{String(value)}</p>
                    <p className="text-[10px] text-[#8b98a3]">{caption}</p>
                  </div>
                </article>
              ))}
            </section>

            <section className="flex items-center gap-3 rounded-[5px] border border-[#efd7a2] border-l-4 border-l-[#f0ad4e] bg-[#fff8e8] p-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f0ad4e] text-[12px] font-bold text-white">1</span>
              <AlertTriangle className="h-5 w-5 shrink-0 text-[#c88216]" />
              <div>
                <p className="text-[12px] font-bold text-[#73561d]">Review Not Listed items before purchasing.</p>
                <p className="mt-0.5 text-[11px] text-[#8a6d3b]">Create missing inventory records first; items already matched can be added directly to purchasing.</p>
              </div>
            </section>

            <section className="overflow-visible rounded-[5px] border border-[#cfd7de] bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-[#dbe1e6] px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-[14px] font-bold text-[#263f4f]">Not Listed Items <span className="font-normal text-[#71808d]">(Grouped by requested part)</span></h2>
                  <p className="mt-0.5 text-[10px] text-[#8b98a3]">{formatDate(appliedFilters.dateFrom)} – {formatDate(appliedFilters.dateTo)}</p>
                </div>
                <label className="flex items-center gap-2 text-[11px] font-semibold text-[#647482]">
                  Sort by
                  <select value={sortOption} onChange={(event) => setSortOption(event.target.value as SortOption)} className={`${controlClass} w-[190px]`}>
                    <option value="inquiries-desc">Most Inquiries</option>
                    <option value="qty-desc">Highest Quantity</option>
                    <option value="customers-desc">Most Customers</option>
                    <option value="part-asc">Part Number A–Z</option>
                  </select>
                </label>
              </div>

              {isLoading ? (
                <div className="flex h-56 items-center justify-center gap-2 text-[12px] text-[#71808d]">
                  <Loader2 className="h-5 w-5 animate-spin text-[#6685a4]" />
                  Loading report data...
                </div>
              ) : activeRows.length === 0 ? (
                <div className="flex h-56 flex-col items-center justify-center text-center">
                  <Package className="mb-2 h-10 w-10 text-[#c9d1d9]" />
                  <p className="text-[13px] font-semibold text-[#52606d]">No suggested stock items found.</p>
                  <p className="mt-1 text-[11px] text-[#8b98a3]">Adjust the report filters and generate again.</p>
                </div>
              ) : (
                <div className="overflow-x-auto xl:overflow-visible">
                  {appliedFilters.viewMode === 'summary' ? (
                    <table className="min-w-[1240px] w-full border-collapse">
                      <thead className="sticky top-0 z-20 shadow-[0_2px_5px_rgba(38,63,79,0.18)]">
                        <tr>
                          <th rowSpan={2} className={`${tableHeaderClass} w-9 text-center`}><input type="checkbox" checked={visibleSummary.length > 0 && visibleSummary.every((item) => selectedIds.has(item.id))} onChange={toggleAll} aria-label="Select all visible items" /></th>
                          <th rowSpan={2} className={`${tableHeaderClass} w-10 text-center`}>#</th>
                          <th rowSpan={2} className={tableHeaderClass}>Part Number</th>
                          <th rowSpan={2} className={tableHeaderClass}>Description</th>
                          <th rowSpan={2} className={tableHeaderClass}>Brand</th>
                          <th rowSpan={2} className={`${tableHeaderClass} text-center`}>Total Inquiries<br /><span className="font-normal">(Count)</span></th>
                          <th rowSpan={2} className={`${tableHeaderClass} text-center`}>Total Qty Requested<br /><span className="font-normal">(Blank qty = 1)</span></th>
                          <th rowSpan={2} className={`${tableHeaderClass} text-center`}>Customers<br /><span className="font-normal">(Count)</span></th>
                          <th rowSpan={2} className={`${tableHeaderClass} text-center`}>Status</th>
                          <th colSpan={2} className={`${tableHeaderClass} text-center`}>If Already Listed</th>
                          <th rowSpan={2} className={`${tableHeaderClass} text-center`}>Action</th>
                        </tr>
                        <tr>
                          <th className={tableHeaderClass}>Item Code</th>
                          <th className={tableHeaderClass}>Part Number (In Database)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleSummary.map((item, index) => (
                          <tr key={item.id} className="hover:bg-[#f8fafb]">
                            <td className={`${tableCellClass} text-center`}><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleRow(item.id)} aria-label={`Select ${item.partNo || item.description}`} /></td>
                            <td className={`${tableCellClass} text-center text-[#8b98a3]`}>{index + 1}</td>
                            <td className={tableCellClass}><button type="button" className="font-semibold text-[#4f7697] hover:underline" onClick={() => handleItemAction(item)}>{item.partNo || '-'}</button></td>
                            <td className={`${tableCellClass} max-w-[230px]`}>{item.description || '-'}</td>
                            <td className={tableCellClass}>{item.brand || '-'}</td>
                            <td className={`${tableCellClass} text-center text-[14px] font-bold text-[#d74b4b]`}>{item.inquiryCount}</td>
                            <td className={`${tableCellClass} text-center font-semibold`}>{item.totalQty}</td>
                            <td className={`${tableCellClass} text-center font-semibold`}>{item.customerCount}</td>
                            <td className={`${tableCellClass} text-center`}>
                              <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${item.isListed ? 'bg-[#e4f5e7] text-[#3c763d]' : 'bg-[#fbeaea] text-[#a94442]'}`}>
                                {item.isListed ? 'Listed' : 'Not Listed'}
                              </span>
                            </td>
                            <td className={tableCellClass}>{item.databaseItemCode || '-'}</td>
                            <td className={tableCellClass}>{item.databasePartNo || '-'}</td>
                            <td className={`${tableCellClass} text-center`}>
                              <button
                                type="button"
                                onClick={() => handleItemAction(item)}
                                className={`inline-flex h-8 items-center justify-center gap-1 rounded-[4px] px-3 text-[10px] font-bold ${
                                  item.isListed
                                    ? 'border border-[#54718d] bg-[#6685a4] text-white hover:bg-[#516c87]'
                                    : 'border border-[#d74b4b] bg-white text-[#c44743] hover:bg-[#fbeaea]'
                                }`}
                              >
                                {item.isListed ? <ShoppingCart className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                                {item.isListed ? 'Add' : 'Create'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <table className="min-w-[980px] w-full border-collapse">
                      <thead className="sticky top-0 z-20 shadow-[0_2px_5px_rgba(38,63,79,0.18)]">
                        <tr>
                          <th className={`${tableHeaderClass} w-9 text-center`}><input type="checkbox" checked={visibleDetailRows.length > 0 && visibleDetailRows.every((item) => selectedIds.has(item.id))} onChange={toggleAll} aria-label="Select all visible inquiries" /></th>
                          <th className={tableHeaderClass}>Date</th>
                          <th className={tableHeaderClass}>Inquiry No.</th>
                          <th className={tableHeaderClass}>Customer</th>
                          <th className={tableHeaderClass}>Part Number</th>
                          <th className={tableHeaderClass}>Item Code</th>
                          <th className={tableHeaderClass}>Description</th>
                          <th className={`${tableHeaderClass} text-center`}>Qty</th>
                          <th className={tableHeaderClass}>Salesperson</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleDetailRows.map((item) => (
                          <tr key={item.id} className="hover:bg-[#f8fafb]">
                            <td className={`${tableCellClass} text-center`}><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleRow(item.id)} aria-label={`Select inquiry ${item.inquiryNo}`} /></td>
                            <td className={tableCellClass}>{item.inquiryDate ? formatDate(item.inquiryDate.slice(0, 10)) : '-'}</td>
                            <td className={`${tableCellClass} font-semibold text-[#4f7697]`}>{item.inquiryNo || '-'}</td>
                            <td className={tableCellClass}>{item.customerName || '-'}</td>
                            <td className={tableCellClass}>{item.partNo || '-'}</td>
                            <td className={tableCellClass}>{item.itemCode || '-'}</td>
                            <td className={tableCellClass}>{item.description || '-'}</td>
                            <td className={`${tableCellClass} text-center font-semibold`}>{Number(item.qty) > 0 ? item.qty : 1}</td>
                            <td className={tableCellClass}>{item.salesPerson || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  <div className="sticky left-0 flex min-w-full flex-col gap-2 border-t border-[#dbe1e6] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[10px] text-[#8b98a3]">
                      Showing {visibleItemCount} of {activeRows.length} items
                    </p>
                    <div ref={loadMoreRef} className="flex min-h-7 items-center gap-2 text-[10px] font-semibold text-[#6685a4]">
                      {hasMoreRows ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Scroll to load more
                        </>
                      ) : (
                        <span className="text-[#8b98a3]">All items loaded</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="grid gap-3 lg:grid-cols-2">
              <article className="rounded-[5px] border border-[#d7dde3] bg-white p-4 shadow-sm">
                <h3 className="flex items-center gap-2 text-[13px] font-bold text-[#263f4f]"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#6685a4] text-[11px] text-white">2</span>Create New Item</h3>
                <div className="mt-5 grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-start gap-2 text-center">
                  {[
                    [Search, 'Review', 'Check the requested part'],
                    [Tag, 'Create', 'Add it to Product Database'],
                    [ClipboardCheck, 'Verify', 'Confirm code and details'],
                    [ShoppingCart, 'Purchase', 'Continue to purchasing'],
                  ].map(([Icon, title, copy], index) => (
                    <React.Fragment key={String(title)}>
                      <div>
                        <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-[#edf2f6] text-[#6685a4]"><Icon className="h-4 w-4" /></span>
                        <p className="mt-2 text-[10px] font-bold text-[#34495e]">{title}</p>
                        <p className="mt-1 text-[9px] leading-4 text-[#8b98a3]">{copy}</p>
                      </div>
                      {index < 3 && <ArrowRight className="mt-3 h-4 w-4 text-[#c4cdd4]" />}
                    </React.Fragment>
                  ))}
                </div>
              </article>
              <article className="rounded-[5px] border border-[#d7dde3] bg-white p-4 shadow-sm">
                <h3 className="flex items-center gap-2 text-[13px] font-bold text-[#263f4f]"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#5cb85c] text-[11px] text-white">3</span>If Already Listed</h3>
                <p className="mt-3 text-[11px] leading-5 text-[#71808d]">Matched records show the existing inventory code and database part number. Use Add to continue the purchasing workflow without creating a duplicate item.</p>
                <div className="mt-3 rounded-[4px] border border-[#d7e7d9] bg-[#f2faf3] p-3 text-[10px]">
                  <p><b>Item Code:</b> shown from Product Database</p>
                  <p className="mt-1"><b>Part Number:</b> the matched inventory part</p>
                </div>
              </article>
              <div className="flex items-start gap-2 rounded-[5px] border border-[#efd7a2] bg-[#fff8e8] p-3 text-[10px] text-[#8a6d3b]"><Lightbulb className="h-4 w-4 shrink-0" /><p><b>Tip:</b> Sort by inquiries or quantity to identify the strongest demand first.</p></div>
              <div className="flex items-start gap-2 rounded-[5px] border border-[#c9ddeb] bg-[#eef7fc] p-3 text-[10px] text-[#4f7697]"><CircleHelp className="h-4 w-4 shrink-0" /><p><b>Need Help?</b> Use Inquiry Details to see the customer and salesperson behind each request.</p></div>
            </section>
          </main>

          <aside className="sticky top-4 rounded-[5px] border border-[#cfd7de] bg-white p-4 shadow-sm">
            <h2 className="flex items-center gap-2 border-b border-[#e0e5e9] pb-3 text-[13px] font-bold text-[#263f4f]"><ListFilter className="h-4 w-4 text-[#6685a4]" />How It Works – Step by Step</h2>
            <ol className="mt-4 space-y-4">
              {sidebarSteps.map(([Icon, title, copy], index) => (
                <li key={title} className="grid grid-cols-[24px_24px_1fr] gap-2">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white ${index === 5 ? 'bg-[#d9534f]' : index >= 6 ? 'bg-[#5cb85c]' : 'bg-[#6685a4]'}`}>{index + 1}</span>
                  <Icon className="mt-1 h-4 w-4 text-[#71808d]" />
                  <div>
                    <p className="text-[10px] font-bold text-[#34495e]">{title}</p>
                    <p className="mt-0.5 text-[9px] leading-4 text-[#8b98a3]">{copy}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-5 flex gap-2 border-t border-[#e0e5e9] pt-4 text-[9px] leading-4 text-[#8a6d3b]">
              <AlertTriangle className="h-4 w-4 shrink-0 text-[#f0ad4e]" />
              <p><b>Note:</b> Creating or adding an item opens the appropriate inventory or purchasing module. Review details before saving.</p>
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => window.print()} className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-[4px] border border-[#c9d1d9] bg-white text-[10px] font-semibold text-[#647482] hover:bg-[#f5f7f8]"><Printer className="h-3.5 w-3.5" />Print</button>
              <button type="button" onClick={() => setPeriodAndRange('month')} className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-[4px] border border-[#c9d1d9] bg-white text-[10px] font-semibold text-[#647482] hover:bg-[#f5f7f8]"><Filter className="h-3.5 w-3.5" />Reset Period</button>
            </div>
          </aside>
        </div>
      </div>

      {showPurchaseModal && selectedItem && (
        <AddToPurchaseRequestModal
          item={selectedItem}
          currentUser={currentUser}
          onClose={() => {
            setShowPurchaseModal(false);
            setSelectedItem(null);
          }}
        />
      )}
    </div>
  );
};

export default SuggestedStockReport;
