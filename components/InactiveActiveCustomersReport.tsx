import React, { useEffect, useMemo, useState } from 'react';
import { Download, Loader2, Printer, RefreshCw, RotateCcw, Star } from 'lucide-react';
import {
  fetchInactiveActiveCustomersReport,
  InactiveActiveCustomerRow,
} from '../services/inactiveActiveCustomersReportService';
import CustomerStarIndicator, { useCustomerStarredIds } from './CustomerStarIndicator';
import { fetchDailyCallMasterList } from '../services/dailyCallMonitoringService';
import { setCustomerStarred } from '../services/customerDatabaseLocalApiService';
import { getLocalAuthSession } from '../services/localAuthService';
import { isMasterUserType } from '../constants';
import { getVipTierConfig } from '../services/vipTierSettingsService';
import { resolveVipDiscountLevel } from '../utils/vipStanding';
import { DEFAULT_VIP_TIER_CONFIG } from '../utils/vipTierConfig';
import { isBlockedDailyCallMasterRow } from '../utils/dailyCallBlockedCustomer';
import { resolveDailyCallPurchaseHighlightColor } from '../utils/dailyCallPurchaseHighlight';
import type { DailyCallMasterCustomerRow, VipTierConfig } from '../types';
import { formatAccountingTimestamp } from '../utils/formatUtils';

const formatDate = (dateValue: string): string => {
  if (!dateValue) return 'N/A';
  const dt = new Date(dateValue);
  if (Number.isNaN(dt.getTime())) return dateValue;
  return dt.toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: '2-digit' }).replace(/ /g, '\u2011').replace(',', '').toUpperCase();
};

const formatExactDate = (dateValue: string): string => {
  if (!dateValue) return 'N/A';
  const dateOnly = dateValue.slice(0, 10);
  const dt = new Date(`${dateOnly}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return dateValue;
  return dt.toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' });
};

const purchaseColorClass = (color: string): string => {
  if (color === 'red') return 'bg-[#f94449]/20 text-red-950 hover:bg-[#f94449]/30';
  if (color === 'green') return 'bg-green-100 text-green-950 hover:bg-green-200';
  if (color === 'yellow') return 'bg-yellow-100 text-yellow-950 hover:bg-yellow-200';
  if (color === 'purple') return 'bg-purple-100 text-purple-950 hover:bg-purple-200';
  return 'bg-white text-slate-900 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800';
};

const enrichReportRow = (
  row: InactiveActiveCustomerRow,
  dailyCall: DailyCallMasterCustomerRow | undefined,
  vipConfig: VipTierConfig
): InactiveActiveCustomerRow => {
  if (!dailyCall) return { ...row, vipStatus: 'Unavailable' };
  const isBlocked = isBlockedDailyCallMasterRow(dailyCall);
  return {
    ...row,
    vipStatus: (() => {
      const level = resolveVipDiscountLevel(dailyCall.lastMonthSales || 0, vipConfig);
      return level === 'gold' ? 'VIP Gold' : level === 'silver' ? 'VIP Silver' : 'Regular';
    })(),
    latestSalesReportMessage: dailyCall.latestSalesReportMessage || '',
    latestSalesReportAuthor: dailyCall.latestSalesReportAuthor || '',
    latestSalesReportAt: dailyCall.latestSalesReportAt || '',
    // Keep the report API's ledger date as the displayed date too, so it agrees
    // with the ledger-based active/inactive classification.
    lastPurchaseRaw: row.lastPurchaseRaw || row.lastPurchase,
    isBlocked,
    purchaseAgeGroup: dailyCall.purchaseAgeGroup,
    currentMonthSales: dailyCall.currentMonthSales,
    lastMonthSales: dailyCall.lastMonthSales || 0,
    purchaseCount: dailyCall.purchaseCount,
    monthsSinceLastPurchase: dailyCall.monthsSinceLastPurchase,
    dailyCallColor: resolveDailyCallPurchaseHighlightColor({
      isBlocked,
      lastPurchaseDateRaw: dailyCall.lastPurchaseDateRaw || dailyCall.lastPurchaseDate,
      monthsSinceLastPurchase: dailyCall.monthsSinceLastPurchase,
      currentMonthSales: dailyCall.currentMonthSales,
      purchaseAgeGroup: dailyCall.purchaseAgeGroup,
      purchaseCount: dailyCall.purchaseCount,
    }),
  };
};

const InactiveActiveCustomersReport: React.FC = () => {
  const currentUser = getLocalAuthSession()?.userProfile ?? null;
  const canEditCustomerStars = isMasterUserType(currentUser);
  const starredCustomerIds = useCustomerStarredIds();
  const [loading, setLoading] = useState(false);
  const [hasLoadedReport, setHasLoadedReport] = useState(true);
  const [activeRows, setActiveRows] = useState<InactiveActiveCustomerRow[]>([]);
  const [inactiveRows, setInactiveRows] = useState<InactiveActiveCustomerRow[]>([]);
  const [dailyCallById, setDailyCallById] = useState<Map<string, DailyCallMasterCustomerRow>>(new Map());
  const [vipConfig, setVipConfig] = useState<VipTierConfig>(DEFAULT_VIP_TIER_CONFIG);
  const [dailyCallReady, setDailyCallReady] = useState(false);
  const [reportError, setReportError] = useState('');
  const [dailyCallError, setDailyCallError] = useState('');
  const [dailyCallRefresh, setDailyCallRefresh] = useState(0);
  const [starredOverrides, setStarredOverrides] = useState<Record<string, boolean>>({});
  const [savingStarIds, setSavingStarIds] = useState<Set<string>>(() => new Set());
  const [starError, setStarError] = useState('');
  const [activePage, setActivePage] = useState(1);
  const [inactivePage, setInactivePage] = useState(1);
  const [activeTotal, setActiveTotal] = useState(0);
  const [inactiveTotal, setInactiveTotal] = useState(0);

  const [filters, setFilters] = useState({
    status: 'all' as 'all' | 'active' | 'inactive',
    search: '',
    cutoffMonths: 3,
    perPage: 300,
    yearFrom: null as number | null,
    yearTo: null as number | null,
  });

  const [summary, setSummary] = useState({
    activeCount: 0,
    inactiveCount: 0,
    totalCount: 0,
    cutoffMonths: 3,
    cutoffDate: '',
  });

  const loadReport = async () => {
    if (!dailyCallReady) return;
    setLoading(true);
    try {
      const [activeData, inactiveData] = await Promise.all([
        fetchInactiveActiveCustomersReport({ ...filters, status: 'active', page: activePage }),
        fetchInactiveActiveCustomersReport({ ...filters, status: 'inactive', page: inactivePage }),
      ]);
      setActiveRows(activeData.items.map((row) => enrichReportRow(row, dailyCallById.get(row.id), vipConfig)));
      setInactiveRows(inactiveData.items.map((row) => enrichReportRow(row, dailyCallById.get(row.id), vipConfig)));
      setReportError('');
      setActiveTotal(activeData.meta.total);
      setInactiveTotal(inactiveData.meta.total);
      setSummary({ ...activeData.summary, activeCount: activeData.meta.total, inactiveCount: inactiveData.meta.total, totalCount: activeData.meta.total + inactiveData.meta.total });
    } catch (error) {
      setReportError(error instanceof Error ? error.message : 'Unable to load the customer report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasLoadedReport && dailyCallReady) loadReport();
  }, [hasLoadedReport, filters, dailyCallById, vipConfig, dailyCallReady, activePage, inactivePage]);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchDailyCallMasterList(),
      getVipTierConfig(),
    ]).then(([masterList, config]) => {
      if (!active) return;
      setDailyCallById(new Map(masterList.items.map((row) => [row.id, row])));
      setVipConfig(config);
      setDailyCallReady(true);
      setDailyCallError('');
    }).catch((error) => {
      console.error('Unable to load Daily Call customer details for this report:', error);
      if (active) {
        setDailyCallReady(true);
        setDailyCallError('Daily Call details could not be loaded. VIP status, purchase colors, and Agent Sales Reports are unavailable. Retry to load them.');
      }
    });
    return () => { active = false; };
  }, [dailyCallRefresh]);

  const handleReset = () => {
    setActivePage(1);
    setInactivePage(1);
    setFilters({
      status: 'all',
      search: '',
      cutoffMonths: 3,
      perPage: 300,
      yearFrom: null,
      yearTo: null,
    });
  };

  const handleToggleStar = async (row: InactiveActiveCustomerRow) => {
    if (!canEditCustomerStars || savingStarIds.has(row.id)) return;
    const currentStarred = starredOverrides[row.id]
      ?? starredCustomerIds?.has(row.id)
      ?? Boolean(dailyCallById.get(row.id)?.isStarred);
    setSavingStarIds((current) => new Set(current).add(row.id));
    setStarError('');
    try {
      await setCustomerStarred(row.id, !currentStarred);
      setStarredOverrides((current) => ({ ...current, [row.id]: !currentStarred }));
    } catch (error) {
      console.error('Failed to update customer star:', error);
      setStarError(`Could not update the star for ${row.customerName || 'this customer'}. Please try again.`);
    } finally {
      setSavingStarIds((current) => {
        const next = new Set(current);
        next.delete(row.id);
        return next;
      });
    }
  };

  const handleExport = async () => {
    if (!summary.totalCount) return;
    const requests = (['active', 'inactive'] as const).flatMap((status) => {
      const count = status === 'active' ? activeTotal : inactiveTotal;
      return Array.from({ length: Math.max(1, Math.ceil(count / 300)) }, (_, index) =>
        fetchInactiveActiveCustomersReport({ ...filters, status, page: index + 1, perPage: 300 })
      );
    });
    const pages = await Promise.all(requests);
    const exportRows = pages.flatMap((page) => page.items)
      .map((row) => enrichReportRow(row, dailyCallById.get(row.id), vipConfig));
    const headers = ['Status', 'Customer Name', 'Customer Code', 'VIP Status', 'Sales Agent', 'Last Purchase', 'Last Purchase Timestamp', 'Agent Sales Report', 'Report Author', 'Report Timestamp'];
    const esc = (value: string) => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const csv = [
      headers.join(','),
      ...exportRows.map((row) =>
        [
          row.customerStatus,
          row.customerName,
          row.customerCode,
          row.vipStatus,
          row.salesPerson,
          formatExactDate(row.lastPurchaseRaw || row.lastPurchase),
          formatAccountingTimestamp(row.lastPurchaseAt),
          row.latestSalesReportMessage,
          row.latestSalesReportAuthor,
          row.latestSalesReportAt,
        ]
          .map((v) => esc(String(v || '')))
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inactive-active-customers-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderRows = (list: InactiveActiveCustomerRow[], emptyMessage: string) => {
    if (loading) {
      return (
        <tr>
          <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading...
            </span>
          </td>
        </tr>
      );
    }

    if (!list.length) {
      return (
        <tr>
          <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
            {emptyMessage}
          </td>
        </tr>
      );
    }

    return list.map((row) => {
      const isStarred = starredOverrides[row.id]
        ?? starredCustomerIds?.has(row.id)
        ?? Boolean(dailyCallById.get(row.id)?.isStarred);
      return (
      <tr key={`${row.id}-${row.customerStatus}`} className={`border-t border-slate-100 dark:border-slate-800 ${row.dailyCallColor ? purchaseColorClass(row.dailyCallColor) : ''}`}>
        <td className="whitespace-nowrap px-3 py-2">
          <span className="inline-flex items-center gap-1">
            {row.customerName || '-'}
            {canEditCustomerStars ? (
                <button
                  type="button"
                  onClick={() => void handleToggleStar(row)}
                  disabled={savingStarIds.has(row.id)}
                  aria-label={isStarred ? `Remove star from ${row.customerName}` : `Star ${row.customerName}`}
                  aria-pressed={isStarred}
                  title={isStarred ? 'Remove customer star' : 'Star customer'}
                  className="rounded p-1 text-amber-500 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:cursor-wait disabled:opacity-50 dark:hover:bg-amber-500/10"
                >
                  <Star className="h-4 w-4" fill={isStarred ? 'currentColor' : 'none'} />
                </button>
            ) : <CustomerStarIndicator customerId={row.id} isStarred={dailyCallById.get(row.id)?.isStarred} className="inline h-3.5 w-3.5" />}
          </span>
        </td>
        <td className="whitespace-nowrap px-3 py-2">{row.customerStatus === 'active' ? 'Active' : 'Inactive'}</td>
        <td className="whitespace-nowrap px-3 py-2">{row.vipStatus || 'Regular'}</td>
        <td className="px-3 py-2">{row.salesPerson || '-'}</td>
        <td className="whitespace-nowrap px-3 py-2">{formatExactDate(row.lastPurchaseRaw || row.lastPurchase)}</td>
        <td className="whitespace-nowrap px-3 py-2">{formatAccountingTimestamp(row.lastPurchaseAt)}</td>
        <td className="min-w-64 max-w-md px-3 py-2" title={row.latestSalesReportMessage}>{row.latestSalesReportMessage || '—'}</td>
        <td className="whitespace-nowrap px-3 py-2">{row.latestSalesReportAuthor || '—'}</td>
        <td className="whitespace-nowrap px-3 py-2">{row.latestSalesReportAt ? row.latestSalesReportAt.replace('T', ' ') : '—'}</td>
      </tr>
      );
    });
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950 p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Inactive/Active Customers</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={!summary.totalCount}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button
            onClick={() => window.print()}
            disabled={!summary.totalCount}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            <Printer className="h-4 w-4" /> Print
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-6 dark:border-slate-800 dark:bg-slate-900">
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">From year
          <select aria-label="From year" value={filters.yearFrom ?? ''} onChange={(e) => { const yearFrom = e.target.value ? Number(e.target.value) : null; setActivePage(1); setInactivePage(1); setFilters((prev) => ({ ...prev, yearFrom, yearTo: yearFrom && prev.yearTo && prev.yearTo < yearFrom ? yearFrom : prev.yearTo })); }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
            <option value="">All years</option>{Array.from({ length: new Date().getFullYear() - 1999 }, (_, index) => new Date().getFullYear() - index).map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">To year
          <select aria-label="To year" value={filters.yearTo ?? ''} onChange={(e) => { const yearTo = e.target.value ? Number(e.target.value) : null; setActivePage(1); setInactivePage(1); setFilters((prev) => ({ ...prev, yearTo, yearFrom: yearTo && prev.yearFrom && prev.yearFrom > yearTo ? yearTo : prev.yearFrom })); }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
            <option value="">All years</option>{Array.from({ length: new Date().getFullYear() - 1999 }, (_, index) => new Date().getFullYear() - index).map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (hasLoadedReport && dailyCallReady) void loadReport();
              else setHasLoadedReport(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white dark:bg-slate-700"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </button>
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
        </div>
      </div>

      {dailyCallError && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{dailyCallError}<button type="button" className="rounded border border-rose-300 px-2 py-1 font-semibold" onClick={() => { setDailyCallReady(false); setDailyCallRefresh((value) => value + 1); }}>Retry Daily Call data</button></div>}
      {reportError && <div role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{reportError}</div>}
      {starError && <div role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{starError}</div>}

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs uppercase tracking-wide text-slate-500">Active Customers</div>
          <div className="text-2xl font-bold text-emerald-600">{summary.activeCount.toLocaleString()}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs uppercase tracking-wide text-slate-500">Inactive Customers</div>
          <div className="text-2xl font-bold text-rose-600">{summary.inactiveCount.toLocaleString()}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs uppercase tracking-wide text-slate-500">Total Customers</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{summary.totalCount.toLocaleString()}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs uppercase tracking-wide text-slate-500">Cutoff Date</div>
          <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{formatDate(summary.cutoffDate)}</div>
        </div>
      </div>

      <div className="mb-4 text-xs text-slate-500">
        Active customers: their latest ledger purchase is within the last {summary.cutoffMonths} month(s). Inactive customers: their
        latest ledger purchase is older than {summary.cutoffMonths} month(s), or they have no ledger purchases.
      </div>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-slate-600 dark:text-slate-300" aria-label="Daily Call purchase color legend">
        <span><i className="mr-1 inline-block h-3 w-3 rounded bg-green-500 align-middle" />Bought this month</span>
        <span><i className="mr-1 inline-block h-3 w-3 rounded bg-yellow-400 align-middle" />1 month no purchase</span>
        <span><i className="mr-1 inline-block h-3 w-3 rounded bg-purple-500 align-middle" />2 months no purchase</span>
        <span><i className="mr-1 inline-block h-3 w-3 rounded border border-slate-300 bg-white align-middle" />3+ months / no purchase</span>
        <span><i className="mr-1 inline-block h-3 w-3 rounded bg-[#f94449] align-middle" />Blacklisted / rejected</span>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-3 py-2 text-sm font-semibold text-emerald-700 dark:border-slate-800 dark:text-emerald-400">
            Active Customers
          </div>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th className="px-3 py-2 text-left">Customer Name</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">VIP Status</th>
                <th className="px-3 py-2 text-left">Sales Agent</th>
                <th className="px-3 py-2 text-left">Last Purchase</th>
                <th className="px-3 py-2 text-left">Last Purchase Timestamp</th>
                <th className="px-3 py-2 text-left">Unified Agent Sales Report</th>
                <th className="px-3 py-2 text-left">Report Author</th>
                <th className="px-3 py-2 text-left">Report Timestamp</th>
              </tr>
            </thead>
            <tbody>{renderRows(activeRows, 'No active customers for the selected years.')}</tbody>
          </table>
          <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300">
            <span>Showing {activeRows.length} of {activeTotal.toLocaleString()} active customers</span>
            <div className="flex items-center gap-2"><button onClick={() => setActivePage((page) => Math.max(1, page - 1))} disabled={activePage <= 1 || loading} className="rounded border px-2 py-1 disabled:opacity-40">Prev</button><span>{activePage} / {Math.max(1, Math.ceil(activeTotal / 300))}</span><button onClick={() => setActivePage((page) => Math.min(Math.max(1, Math.ceil(activeTotal / 300)), page + 1))} disabled={activePage >= Math.max(1, Math.ceil(activeTotal / 300)) || loading} className="rounded border px-2 py-1 disabled:opacity-40">Next</button></div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-3 py-2 text-sm font-semibold text-rose-700 dark:border-slate-800 dark:text-rose-400">
            Inactive Customers
          </div>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th className="px-3 py-2 text-left">Customer Name</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">VIP Status</th>
                <th className="px-3 py-2 text-left">Sales Agent</th>
                <th className="px-3 py-2 text-left">Last Purchase</th>
                <th className="px-3 py-2 text-left">Last Purchase Timestamp</th>
                <th className="px-3 py-2 text-left">Unified Agent Sales Report</th>
                <th className="px-3 py-2 text-left">Report Author</th>
                <th className="px-3 py-2 text-left">Report Timestamp</th>
              </tr>
            </thead>
            <tbody>{renderRows(inactiveRows, 'No inactive customers for the selected years.')}</tbody>
          </table>
          <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300">
            <span>Showing {inactiveRows.length} of {inactiveTotal.toLocaleString()} inactive customers</span>
            <div className="flex items-center gap-2"><button onClick={() => setInactivePage((page) => Math.max(1, page - 1))} disabled={inactivePage <= 1 || loading} className="rounded border px-2 py-1 disabled:opacity-40">Prev</button><span>{inactivePage} / {Math.max(1, Math.ceil(inactiveTotal / 300))}</span><button onClick={() => setInactivePage((page) => Math.min(Math.max(1, Math.ceil(inactiveTotal / 300)), page + 1))} disabled={inactivePage >= Math.max(1, Math.ceil(inactiveTotal / 300)) || loading} className="rounded border px-2 py-1 disabled:opacity-40">Next</button></div>
          </div>
        </div>
      </div>

      <div className="mt-4 text-sm text-slate-600 dark:text-slate-300">Total: {summary.totalCount.toLocaleString()} customers ({summary.activeCount.toLocaleString()} active, {summary.inactiveCount.toLocaleString()} inactive)</div>
    </div>
  );
};

export default InactiveActiveCustomersReport;
