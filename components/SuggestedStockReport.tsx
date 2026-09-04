import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  Download,
  FolderOpen,
  Lightbulb,
  ListFilter,
  Loader2,
  Package,
  Plus,
  Search,
} from 'lucide-react';
import { UserProfile } from '../types';
import {
  addSuggestedStockItemsToKiv,
  createPurchaseRequestFromSuggestions,
  CustomerWithInquiries,
  fetchCustomersWithNotListedInquiries,
  fetchSuggestedStockSummaryPage,
  markSuggestedStockItemsAddedToPr,
  removeSuggestedStockItemsFromKiv,
  SuggestedStockItem,
} from '../services/suggestedStockService';
import { useToast } from './ToastProvider';

interface SuggestedStockReportProps {
  currentUser?: UserProfile | null;
}

type Period = 'today' | 'week' | 'month' | 'year' | 'custom';
type SortOption =
  | 'qty-desc'
  | 'kiv-folder'
  | 'description-asc'
  | 'description-desc'
  | 'inquiries-desc'
  | 'inquiries-asc';

interface AppliedFilters {
  dateFrom: string;
  dateTo: string;
  customerId: string;
  partNo: string;
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
  const initialRange = getPeriodRange('year');

  const [period, setPeriod] = useState<Period>('year');
  const [dateFrom, setDateFrom] = useState(initialRange.dateFrom);
  const [dateTo, setDateTo] = useState(initialRange.dateTo);
  const [selectedCustomer, setSelectedCustomer] = useState('all');
  const [partNoInput, setPartNoInput] = useState('');
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters>({
    ...initialRange,
    customerId: 'all',
    partNo: '',
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
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isUpdatingKiv, setIsUpdatingKiv] = useState(false);
  const [isAddingToPr, setIsAddingToPr] = useState(false);
  const [prQuantities, setPrQuantities] = useState<Record<string, number>>({});
  const isAddingToPrRef = useRef(false);
  const loadRequestId = useRef(0);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const hasLoadedOnce = useRef(false);
  const fullReloadKey = `${appliedFilters.dateFrom}|${appliedFilters.dateTo}|${appliedFilters.customerId}|${appliedFilters.partNo}|${refreshRequest}`;
  const prevFullReloadKey = useRef(fullReloadKey);
  const kivFolder = sortOption === 'kiv-folder';

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

  const reportFilters = useMemo(
    () => ({
      dateFrom: appliedFilters.dateFrom,
      dateTo: appliedFilters.dateTo,
      customerId: appliedFilters.customerId,
      partNo: appliedFilters.partNo,
      sortBy: kivFolder ? 'qty-desc' : sortOption,
      kivFolder,
    }),
    [appliedFilters.customerId, appliedFilters.dateFrom, appliedFilters.dateTo, appliedFilters.partNo, kivFolder, sortOption]
  );

  const loadReport = useCallback(async () => {
    const requestId = ++loadRequestId.current;
    const shouldShowLoader = !hasLoadedOnce.current || prevFullReloadKey.current !== fullReloadKey;
    prevFullReloadKey.current = fullReloadKey;
    if (shouldShowLoader) {
      hasLoadedOnce.current = false;
      setIsLoading(true);
    }
    setSummaryPage(1);
    setHasMorePages(false);
    setSelectedKeys(new Set());
    try {
      const result = await fetchSuggestedStockSummaryPage(reportFilters, 1, 50);
      if (requestId !== loadRequestId.current) return;
      setSummaryData(result.items);
      setHasMorePages(result.hasMore);
      setSummaryPage(1);
      hasLoadedOnce.current = true;
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
  }, [addToast, fullReloadKey, reportFilters]);

  const loadMoreSummary = useCallback(async () => {
    if (isLoading || isLoadingMore || !hasMorePages) return;
    setIsLoadingMore(true);
    const nextPage = summaryPage + 1;
    try {
      const result = await fetchSuggestedStockSummaryPage(reportFilters, nextPage, 50);
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
  }, [addToast, hasMorePages, isLoading, isLoadingMore, reportFilters, summaryPage]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  useEffect(() => {
    const refreshAfterProductCreate = () => void loadReport();
    window.addEventListener('focus', refreshAfterProductCreate);
    return () => window.removeEventListener('focus', refreshAfterProductCreate);
  }, [loadReport]);

  const sortedSummary = useMemo(() => {
    const search = partNoInput.trim().toLowerCase();
    const rows = summaryData.filter((item) =>
      search === '' || item.partNo.toLowerCase().includes(search)
    );
    rows.sort((a, b) => {
      if (sortOption === 'description-asc') return a.description.localeCompare(b.description);
      if (sortOption === 'description-desc') return b.description.localeCompare(a.description);
      if (sortOption === 'inquiries-asc') return a.inquiryCount - b.inquiryCount || a.description.localeCompare(b.description);
      if (sortOption === 'qty-desc' || sortOption === 'kiv-folder') {
        return b.totalQty - a.totalQty || a.description.localeCompare(b.description);
      }
      return b.inquiryCount - a.inquiryCount || a.description.localeCompare(b.description);
    });
    return rows;
  }, [partNoInput, sortOption, summaryData]);

  const visibleItemCount = Math.min(visibleCount, sortedSummary.length);
  const visibleSummary = sortedSummary.slice(0, visibleCount);
  const hasMoreRows = visibleItemCount < sortedSummary.length || hasMorePages;
  const selectedItems = useMemo(
    () => sortedSummary.filter((item) => selectedKeys.has(summaryRowKey(item))),
    [selectedKeys, sortedSummary]
  );
  const allVisibleSelected =
    visibleSummary.length > 0 && visibleSummary.every((item) => selectedKeys.has(summaryRowKey(item)));

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
      partNo: partNoInput.trim(),
    });
    setRefreshRequest((current) => current + 1);
  };

  const applyFilters = () => {
    if (!dateFrom || !dateTo || dateFrom > dateTo) return;
    setAppliedFilters({
      dateFrom,
      dateTo,
      customerId: selectedCustomer,
      partNo: partNoInput.trim(),
    });
    setRefreshRequest((current) => current + 1);
  };

  const applyPartNoSearch = () => {
    setAppliedFilters((current) => ({
      ...current,
      partNo: partNoInput.trim(),
    }));
  };

  const resetDateRange = () => {
    const range = getPeriodRange('year');
    setPeriod('year');
    setDateFrom(range.dateFrom);
    setDateTo(range.dateTo);
    setPartNoInput('');
    setAppliedFilters({
      ...range,
      customerId: selectedCustomer,
      partNo: '',
    });
    setRefreshRequest((current) => current + 1);
  };

  const dateRangeError = !dateFrom || !dateTo
    ? 'Choose both a start date and an end date.'
    : dateFrom > dateTo
      ? 'Start date must be on or before end date.'
      : '';

  const toggleSelectRow = (key: string) => {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        visibleSummary.forEach((item) => next.delete(summaryRowKey(item)));
        return next;
      }
      visibleSummary.forEach((item) => next.add(summaryRowKey(item)));
      return next;
    });
  };

  const updatePrQuantity = (item: SuggestedStockItem, value: string) => {
    const parsed = Number(value);
    setPrQuantities((current) => ({
      ...current,
      [item.id]: Number.isFinite(parsed) && parsed > 0 ? parsed : 0,
    }));
  };

  const handleAddSelectedItemsToPr = async () => {
    if (selectedItems.length === 0 || isAddingToPr || isAddingToPrRef.current) return;
    const notCreated = selectedItems.filter((item) => !item.productCreated);
    if (notCreated.length > 0) {
      addToast({ type: 'warning', title: 'Create the product first', description: 'Only rows marked Product Created can be added to a purchase request.' });
      return;
    }
    const invalidQty = selectedItems.find((item) => Number(prQuantities[item.id] ?? item.totalQty) <= 0);
    if (invalidQty) {
      addToast({ type: 'warning', title: 'Enter a PR quantity', description: `Enter a quantity greater than zero for ${invalidQty.partNo || invalidQty.description}.` });
      return;
    }

    isAddingToPrRef.current = true;
    setIsAddingToPr(true);
    try {
      const request = await createPurchaseRequestFromSuggestions(prSelectedItems, prQuantities);
      await markSuggestedStockItemsAddedToPr(prSelectedItems);
      setSelectedKeys(new Set());
      setPrQuantities({});
      await loadReport();
      addToast({
        type: 'success',
        title: 'Items added to purchase request',
        description: `${prSelectedItems.length} item${prSelectedItems.length === 1 ? '' : 's'} added to ${request.pr_number || 'the new PR'}.`,
        durationMs: 7000,
      });
    } catch (error) {
      addToast({ type: 'error', title: 'Unable to add items to PR', description: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      isAddingToPrRef.current = false;
      setIsAddingToPr(false);
    }
  };

  const prSelectedItems = selectedItems.filter((item) => item.productCreated);

  const handleKivSelection = async () => {
    if (selectedItems.length === 0 || isUpdatingKiv) return;
    setIsUpdatingKiv(true);
    try {
      if (kivFolder) {
        const restored = await removeSuggestedStockItemsFromKiv(selectedItems);
        addToast({
          type: 'success',
          title: 'Restored from KIV folder',
          description: `${restored} item${restored === 1 ? '' : 's'} are back on the report.`,
        });
      } else {
        const added = await addSuggestedStockItemsToKiv(selectedItems);
        addToast({
          type: 'success',
          title: 'Moved to KIV folder',
          description: `${added} item${added === 1 ? '' : 's'} will stay off this report until restored.`,
        });
      }
      const movedKeys = new Set(selectedItems.map((item) => summaryRowKey(item)));
      setSelectedKeys(new Set());
      setSummaryData((current) => current.filter((item) => !movedKeys.has(summaryRowKey(item))));
      await loadReport();
    } catch (error) {
      addToast({
        type: 'error',
        title: kivFolder ? 'Unable to restore items' : 'Unable to move items to KIV',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsUpdatingKiv(false);
    }
  };

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
      'KIV',
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
      kivFolder || item.isKiv ? 'Yes' : 'No',
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

  const emptyMessage = kivFolder
    ? 'No items in the KIV folder for this date range.'
    : appliedFilters.partNo || partNoInput.trim()
      ? 'No active items match that part number.'
      : 'No active suggested stock items found.';
  const emptyHint = kivFolder
    ? 'Select items on the main report and move them here when you are not ready to buy.'
    : 'Create the product first, then select the Product Created row to add it to a PR.';

  return (
    <div className="h-full overflow-y-auto bg-[#f7f9fc] text-slate-900">
      <div className="mx-auto max-w-[1500px] p-5 lg:p-8">
        <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-400"><span>Purchasing</span><span>›</span><span>Reports</span><span>›</span><span className="text-slate-700">Item Suggested for Stock Report</span></div>
            <h1 className="text-2xl font-extrabold uppercase tracking-tight text-[#173c83]">Item Suggested for Stock Report</h1>
            <p className="mt-1 text-sm text-slate-500">
              Register a requested product, then select its Product Created row and add it directly to a purchase request.
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
            <button type="button" onClick={() => void handleAddSelectedItemsToPr()} disabled={selectedItems.length === 0 || selectedItems.length !== prSelectedItems.length || isAddingToPr} title={selectedItems.length > prSelectedItems.length ? 'Create every selected product before adding the selection to a PR.' : undefined} className="inline-flex items-center gap-2 rounded-md bg-[#173c83] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#102f76] disabled:cursor-not-allowed disabled:opacity-50">
              {isAddingToPr ? 'Adding to PR...' : `Add Selected Items to PR (${prSelectedItems.length})`}
            </button>
          </div>
        </header>

        <div className="grid items-start gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="rounded-lg border border-slate-200 bg-[#f8fafb] p-4 shadow-sm xl:order-1">
            <h2 className="border-b border-slate-200 pb-3 text-sm font-bold uppercase text-[#173c83]">Workflow</h2>
            <ol className="mt-4 space-y-3 text-sm text-slate-600">
              <li><span className="font-bold text-[#173c83]">1.</span> Review active customer demand below.</li>
              <li><span className="font-bold text-[#173c83]">2.</span> Create the product in Product Database.</li>
              <li><span className="font-bold text-[#173c83]">3.</span> Park items you are not buying now in the KIV folder.</li>
              <li><span className="font-bold text-[#173c83]">4.</span> Select Product Created rows, then add them to a PR.</li>
            </ol>
            <button type="button" onClick={() => void handleAddSelectedItemsToPr()} disabled={selectedItems.length === 0 || selectedItems.length !== prSelectedItems.length || isAddingToPr} title={selectedItems.length > prSelectedItems.length ? 'Create every selected product before adding the selection to a PR.' : undefined} className="mt-5 inline-flex w-full items-center justify-center rounded-md border border-[#173c83] bg-white px-3 py-2 text-xs font-bold text-[#173c83] transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50">
              {isAddingToPr ? 'Adding to PR...' : `Add Selected Items to PR (${prSelectedItems.length})`}
            </button>
          </aside>

          <main className="min-w-0 xl:order-2">
            <section className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{kivFolder ? 'Items in KIV folder' : 'Active items in report'}</p><p className="mt-1 text-2xl font-extrabold text-[#173c83]">{uniqueItemCount}</p></div>
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Total inquiries</p><p className="mt-1 text-2xl font-extrabold text-[#175fd3]">{totalInquiries}</p></div>
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Quantity requested</p><p className="mt-1 text-2xl font-extrabold text-slate-700">{totalQty}</p></div>
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Customers / prospects</p><p className="mt-1 text-2xl font-extrabold text-emerald-700">{uniqueCustomers}</p></div>
            </section>

            <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm" aria-label="Report filters and sorting">
              <div className="grid gap-4 lg:grid-cols-3">
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
                    <option value="qty-desc">Qty requested (total) — highest first</option>
                    <option value="kiv-folder">KIV folder</option>
                    <option value="description-asc">Descriptions</option>
                    <option value="inquiries-desc">Customer requests — highest first</option>
                    <option value="inquiries-asc">Customer requests — lowest first</option>
                    <option value="description-desc">Description — Z to A</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-600">
                    <Search className="h-4 w-4 text-[#175fd3]" /> Search by part number
                  </span>
                  <input
                    aria-label="Search by part number"
                    value={partNoInput}
                    onChange={(event) => setPartNoInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        applyPartNoSearch();
                      }
                    }}
                    placeholder="Type a part number..."
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-[#175fd3] focus:ring-2 focus:ring-blue-100"
                  />
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

                <div className="mt-3 grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
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
                    {appliedFilters.partNo ? ` • Part number: ${appliedFilters.partNo}` : ''}
                    {kivFolder ? ' • KIV folder' : ''}
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-5 py-3 shadow-sm backdrop-blur">
                <p className="text-sm font-bold text-slate-700">
                  {kivFolder
                    ? `${uniqueItemCount} item${uniqueItemCount === 1 ? '' : 's'} in KIV folder`
                    : `${uniqueItemCount} active item${uniqueItemCount === 1 ? '' : 's'} in the product-to-PR workflow`}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleKivSelection()}
                    disabled={selectedItems.length === 0 || isUpdatingKiv}
                    className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    {isUpdatingKiv
                      ? 'Updating...'
                      : kivFolder
                        ? `Restore selected from KIV (${selectedItems.length})`
                        : `Move selected to KIV folder (${selectedItems.length})`}
                  </button>
                  <div className="flex items-center gap-2 rounded bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                    {kivFolder ? (
                      <>
                        <FolderOpen className="h-3.5 w-3.5 text-amber-500" /> Restore items when you are ready to buy them.
                      </>
                    ) : (
                      <>
                        <Lightbulb className="h-3.5 w-3.5 text-amber-500" /> Select items you do not want to buy yet and move them to the KIV folder.
                      </>
                    )}
                  </div>
                </div>
              </div>

              {isLoading ? (
                <div className="flex h-56 items-center justify-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin text-[#175fd3]" /> Loading report data...
                </div>
              ) : visibleSummary.length === 0 ? (
                <div className="flex h-56 flex-col items-center justify-center text-center">
                  <Package className="mb-2 h-10 w-10 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-600">{emptyMessage}</p>
                  <p className="mt-1 text-xs text-slate-400">{emptyHint}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[56rem] border-collapse text-xs">
                    <thead>
                      <tr>
                        <th className="border-b border-slate-200 bg-[#102f76] px-4 py-3 text-center font-bold uppercase tracking-wide text-white">
                          <label className="inline-flex items-center justify-center gap-1">
                            <input
                              type="checkbox"
                              checked={allVisibleSelected}
                              onChange={toggleSelectAllVisible}
                              aria-label="Select all visible items"
                              className="h-4 w-4 rounded border-white/30"
                            />
                            All
                          </label>
                        </th>
                        <th className="border-b border-slate-200 bg-[#102f76] px-4 py-3 text-left font-bold uppercase tracking-wide text-white">Part No</th>
                        <th className="border-b border-slate-200 bg-[#102f76] px-4 py-3 text-left font-bold uppercase tracking-wide text-white">Description</th>
                        <th className="border-b border-slate-200 bg-[#102f76] px-4 py-3 text-center font-bold uppercase tracking-wide text-white">Customer Requests</th>
                        <th className="border-b border-slate-200 bg-[#102f76] px-4 py-3 text-center font-bold uppercase tracking-wide text-white">Qty Requested (Total)</th>
                        <th className="border-b border-slate-200 bg-[#102f76] px-4 py-3 text-center font-bold uppercase tracking-wide text-white">Customers</th>
                        <th className="border-b border-slate-200 bg-[#102f76] px-4 py-3 text-center font-bold uppercase tracking-wide text-white">Last Requested</th>
                        <th className="border-b border-slate-200 bg-[#102f76] px-4 py-3 text-center font-bold uppercase tracking-wide text-white">Status</th>
                        <th className="border-b border-slate-200 bg-[#102f76] px-4 py-3 text-center font-bold uppercase tracking-wide text-white">PR Qty</th>
                        <th className="border-b border-slate-200 bg-[#102f76] px-4 py-3 text-center font-bold uppercase tracking-wide text-white">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleSummary.map((item) => {
                        const rowKey = summaryRowKey(item);
                        return (
                          <tr key={rowKey} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={selectedKeys.has(rowKey)}
                                onChange={() => toggleSelectRow(rowKey)}
                                aria-label={`Select ${item.partNo || item.description || 'item'}`}
                                title={
                                  kivFolder
                                    ? 'Select to restore from KIV'
                                    : item.productCreated
                                      ? 'Select for purchase request or KIV'
                                      : 'Select to move to KIV folder, or create the product first for PR'
                                }
                                className="h-4 w-4 rounded border-slate-300"
                              />
                            </td>
                            <td className="px-4 py-3 font-semibold text-[#e85c41]">{item.partNo || '-'}</td>
                            <td className="px-4 py-3 font-semibold text-[#173c83]">{item.description || '-'}</td>
                            <td className="px-4 py-3 text-center font-bold text-[#175fd3]">{item.inquiryCount} requests</td>
                            <td className="px-4 py-3 text-center font-bold text-slate-700">{item.totalQty} pcs</td>
                            <td className="px-4 py-3 text-center font-semibold text-slate-600">{item.customerCount} customers</td>
                            <td className="px-4 py-3 text-center font-semibold text-slate-600">{item.lastInquiryDate ? new Date(item.lastInquiryDate).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) : '-'}</td>
                            <td className="px-4 py-3 text-center">
                              {item.productCreated ? (
                                <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">Product Created</span>
                              ) : (
                                <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">Needs Product</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {item.productCreated ? (
                                <input
                                  aria-label={`PR quantity for ${item.partNo || item.description || 'item'}`}
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={prQuantities[item.id] ?? (item.totalQty || 1)}
                                  onChange={(event) => updatePrQuantity(item, event.target.value)}
                                  className="h-8 w-20 rounded border border-slate-300 px-2 text-center font-bold text-slate-700 outline-none focus:border-[#175fd3] focus:ring-2 focus:ring-blue-100"
                                />
                              ) : <span className="text-slate-400">—</span>}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {item.productCreated ? (
                                <span className="text-xs font-semibold text-emerald-700">Ready for PR</span>
                              ) : (
                                <button type="button" onClick={() => handleCreateProduct(item)} className="inline-flex items-center gap-1 rounded-md border border-[#175fd3] bg-white px-3 py-1.5 text-xs font-bold text-[#175fd3] transition hover:bg-blue-50">
                                  <Plus className="h-3.5 w-3.5" /> Create
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="sticky left-0 flex min-w-full flex-col gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-500">
                      Showing 1 to {visibleItemCount} of {sortedSummary.length} items
                      {selectedItems.length > 0 ? ` • ${selectedItems.length} selected` : ''}
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
