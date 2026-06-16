import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw, Search, Users } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import { fetchDailyCallMasterList } from '../services/dailyCallMonitoringService';
import { DailyCallMasterCustomerRow, DailyCallMasterListMeta } from '../types';

const fromDate = '2025-10-01';
const viewportHeightPx = 530;

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

const monthLabel = (months: number) => {
  if (months <= 0) return 'This month';
  if (months === 1) return 'Last month';
  return `${months} months ago`;
};

const dayLabel = (days: number) => {
  if (days <= 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
};

const purchaseAgeSections = [
  {
    key: 'two_weeks_to_one_month',
    title: '2 weeks to 1 month',
    description: 'Follow up while the account is still warm',
    priority: 'High',
    accent: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100',
    badge: 'bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-900/60 dark:text-amber-100 dark:ring-amber-700',
  },
  {
    key: 'over_one_month',
    title: 'More than 1 month',
    description: 'Recover customers before sales go cold',
    priority: 'Recover',
    accent: 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-100',
    badge: 'bg-rose-100 text-rose-800 ring-rose-200 dark:bg-rose-900/60 dark:text-rose-100 dark:ring-rose-700',
  },
] as const;

const DailyCallMasterListView: React.FC = () => {
  const [rows, setRows] = useState<DailyCallMasterCustomerRow[]>([]);
  const [meta, setMeta] = useState<DailyCallMasterListMeta>({ fromDate, toDate: '', count: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search, 400);

  const loadRows = useCallback(async (withLoading = true) => {
    if (withLoading) setLoading(true);
    setError(null);
    try {
      const result = await fetchDailyCallMasterList({ fromDate, search: debouncedSearch });
      setRows(result.items);
      setMeta(result.meta);
    } catch {
      setError('Unable to load master list.');
    } finally {
      if (withLoading) setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const totals = useMemo(() => rows.reduce(
    (acc, row) => ({
      sales: acc.sales + row.totalSales,
      current: acc.current + row.currentMonthSales,
      purchases: acc.purchases + row.purchaseCount,
    }),
    { sales: 0, current: 0, purchases: 0 }
  ), [rows]);

  const groupedRows = useMemo(() => purchaseAgeSections.map((section) => {
    const sectionRows = rows.filter((row) => row.purchaseAgeGroup === section.key);
    return {
      ...section,
      rows: sectionRows,
      purchases: sectionRows.reduce((sum, row) => sum + row.purchaseCount, 0),
      totalSales: sectionRows.reduce((sum, row) => sum + row.totalSales, 0),
    };
  }), [rows]);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-3 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading master list...
        </div>
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-11 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">{meta.count || rows.length}</p>
              <p className="text-slate-500">Customers</p>
            </div>
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">{totals.purchases}</p>
              <p className="text-slate-500">Purchases</p>
            </div>
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">{peso.format(totals.sales)}</p>
              <p className="text-slate-500">Since Oct 2025</p>
            </div>
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">{peso.format(totals.current)}</p>
              <p className="text-slate-500">Current</p>
            </div>
          </div>

          <div className="relative w-full lg:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search customer, city, contact"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200">
          <span className="inline-flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </span>
          <button
            type="button"
            onClick={() => loadRows()}
            className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900/40">
          <Users className="mx-auto mb-2 h-8 w-8 opacity-70" />
          <p className="font-semibold">No customers found.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {rows.length} customer{rows.length > 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 lg:w-[460px]">
              {groupedRows.map((section) => (
                <div key={section.key} className={`rounded-lg border px-3 py-2 ${section.accent}`}>
                  <p className="font-semibold text-slate-900 dark:text-white">{section.rows.length}</p>
                  <p className="truncate text-slate-500">{section.title}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {groupedRows.map((section) => (
              <section
                key={section.key}
                className={`flex flex-col rounded-xl border ${section.accent}`}
                style={{ minHeight: `${viewportHeightPx}px` }}
              >
                <div className="border-b border-current/10 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold uppercase tracking-wide">{section.title}</p>
                      <p className="mt-0.5 text-xs opacity-75">{section.description}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${section.badge}`}>
                      {section.rows.length}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="font-bold">{section.purchases}</p>
                      <p className="opacity-70">Purchases</p>
                    </div>
                    <div>
                      <p className="font-bold">{peso.format(section.totalSales)}</p>
                      <p className="opacity-70">Sales</p>
                    </div>
                    <div>
                      <p className="font-bold">{section.priority}</p>
                      <p className="opacity-70">Priority</p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto p-3" style={{ maxHeight: `${viewportHeightPx}px` }}>
                  {section.rows.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-current/20 bg-white/50 px-3 py-8 text-center text-xs opacity-70 dark:bg-slate-950/20">
                      No customers in this stage.
                    </div>
                  ) : section.rows.map((row) => {
                    const location = [row.city, row.province].filter((value) => value && value !== '—').join(', ') || '—';
                    return (
                      <article key={row.id} className="rounded-lg border border-white/80 bg-white p-3 text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-slate-900 dark:text-white" title={row.shopName}>{row.shopName}</p>
                            <p className="mt-1 truncate text-[11px] text-slate-500" title={location}>{location}</p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${section.badge}`}>
                            {section.priority}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <p className="text-slate-500">Last purchase</p>
                            <p className="font-semibold text-slate-900 dark:text-white">{row.lastPurchaseDate}</p>
                            <p className="text-[10px] text-slate-500" title={`${dayLabel(row.daysSinceLastPurchase)} / ${monthLabel(row.monthsSinceLastPurchase)}`}>{dayLabel(row.daysSinceLastPurchase)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-slate-500">Sales</p>
                            <p className="font-bold text-slate-900 dark:text-white">{peso.format(row.totalSales)}</p>
                            <p className="text-[10px] text-slate-500">{row.purchaseCount} purchase{row.purchaseCount === 1 ? '' : 's'}</p>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500 dark:border-slate-800">
                          <span className="truncate" title={row.assignedTo}>{row.assignedTo}</span>
                          <span className="shrink-0">{peso.format(row.currentMonthSales)} current</span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyCallMasterListView;
