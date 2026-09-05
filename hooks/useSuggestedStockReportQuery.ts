import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../components/ToastProvider';
import {
  CustomerWithInquiries,
  fetchCustomersWithNotListedInquiries,
  fetchSuggestedStockSummaryPage,
  SuggestedStockFilters,
  SuggestedStockItem,
  SuggestedStockSortOption,
  SUGGESTED_STOCK_DEFAULT_SORT,
} from '../services/suggestedStockService';

type SuggestedStockPeriod = 'today' | 'week' | 'month' | 'year' | 'custom';
type SuggestedStockReportView = 'active' | 'kiv' | 'cart';

interface SuggestedStockAppliedFilters {
  dateFrom: string;
  dateTo: string;
  customerId: string;
  partNo: string;
}

export const suggestedStockRowKey = (
  item: Pick<SuggestedStockItem, 'id' | 'partNo' | 'itemCode' | 'description'>
) => item.id || `${item.partNo}::${item.itemCode}::${item.description}`;

const LOAD_BATCH_SIZE = 20;

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

const getSuggestedStockPeriodRange = (period: Exclude<SuggestedStockPeriod, 'custom'>) => {
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

export const formatSuggestedStockDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

export const useSuggestedStockReportQuery = () => {
  const { addToast } = useToast();
  const initialRange = getSuggestedStockPeriodRange('year');

  const [period, setPeriod] = useState<SuggestedStockPeriod>('year');
  const [dateFrom, setDateFrom] = useState(initialRange.dateFrom);
  const [dateTo, setDateTo] = useState(initialRange.dateTo);
  const [selectedCustomer, setSelectedCustomer] = useState('all');
  const [partNoInput, setPartNoInput] = useState('');
  const [appliedFilters, setAppliedFilters] = useState<SuggestedStockAppliedFilters>({
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
  const [sortOption, setSortOption] = useState<SuggestedStockSortOption>(SUGGESTED_STOCK_DEFAULT_SORT);
  const [reportView, setReportView] = useState<SuggestedStockReportView>('active');
  const kivFolder = reportView === 'kiv';
  const cartFolder = reportView === 'cart';
  const [visibleCount, setVisibleCount] = useState(LOAD_BATCH_SIZE);
  const [refreshRequest, setRefreshRequest] = useState(0);
  const [reportLoadId, setReportLoadId] = useState(0);
  const loadRequestId = useRef(0);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const hasLoadedOnce = useRef(false);
  const fullReloadKey = `${appliedFilters.dateFrom}|${appliedFilters.dateTo}|${appliedFilters.customerId}|${appliedFilters.partNo}|${refreshRequest}`;
  const prevFullReloadKey = useRef(fullReloadKey);

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

  const reportFilters: SuggestedStockFilters = useMemo(
    () => ({
      dateFrom: appliedFilters.dateFrom,
      dateTo: appliedFilters.dateTo,
      customerId: appliedFilters.customerId,
      partNo: appliedFilters.partNo,
      sortBy: sortOption,
      kivFolder,
      cartFolder,
    }),
    [appliedFilters.customerId, appliedFilters.dateFrom, appliedFilters.dateTo, appliedFilters.partNo, cartFolder, kivFolder, sortOption]
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
    setReportLoadId((current) => current + 1);
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
        const seen = new Set(current.map((item) => suggestedStockRowKey(item)));
        const merged = [...current];
        result.items.forEach((item) => {
          const key = suggestedStockRowKey(item);
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

  const visibleItemCount = Math.min(visibleCount, summaryData.length);
  const visibleSummary = summaryData.slice(0, visibleCount);
  const hasMoreRows = visibleItemCount < summaryData.length || hasMorePages;

  useEffect(() => {
    setVisibleCount(LOAD_BATCH_SIZE);
  }, [appliedFilters, cartFolder, kivFolder, sortOption, summaryData.length]);

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || isLoading || !hasMoreRows) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        if (visibleCount < summaryData.length) {
          setVisibleCount((current) => Math.min(current + LOAD_BATCH_SIZE, summaryData.length));
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
  }, [hasMorePages, hasMoreRows, isLoading, isLoadingMore, loadMoreSummary, summaryData.length, visibleCount]);

  const totalInquiries = summaryData.reduce((sum, item) => sum + item.inquiryCount, 0);
  const totalQty = summaryData.reduce((sum, item) => sum + item.totalQty, 0);
  const uniqueCustomers = new Set(
    summaryData.flatMap((item) => item.customers.map((customer) => customer.id))
  ).size;
  const uniqueItemCount = summaryData.length;

  const setPeriodAndRange = (nextPeriod: SuggestedStockPeriod) => {
    setPeriod(nextPeriod);
    if (nextPeriod === 'custom') return;
    const range = getSuggestedStockPeriodRange(nextPeriod);
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
    const range = getSuggestedStockPeriodRange('year');
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

  const removeSummaryKeys = (keys: Set<string>) => {
    setSummaryData((current) => current.filter((item) => !keys.has(suggestedStockRowKey(item))));
  };

  return {
    period,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    setPeriod,
    setPeriodAndRange,
    selectedCustomer,
    setSelectedCustomer,
    partNoInput,
    setPartNoInput,
    appliedFilters,
    customers,
    isLoadingCustomers,
    summaryData,
    removeSummaryKeys,
    isLoading,
    isLoadingMore,
    hasMorePages,
    sortOption,
    setSortOption,
    reportView,
    setReportView,
    kivFolder,
    cartFolder,
    visibleSummary,
    visibleItemCount,
    hasMoreRows,
    loadMoreRef,
    loadReport,
    applyFilters,
    applyPartNoSearch,
    resetDateRange,
    dateRangeError,
    uniqueItemCount,
    totalInquiries,
    totalQty,
    uniqueCustomers,
    reportLoadId,
  };
};
