import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Loader2, Printer, RefreshCw, RotateCcw, Search } from 'lucide-react';
import {
  fetchSalesReturnReport,
  fetchSalesReturnReportOptions,
  SalesReturnReportFilters,
  SalesReturnReportRow,
} from '../services/salesReturnReportService';
import { formatAccountingTimestamp } from '../utils/formatUtils';

import { shouldSuppressAuthError } from '../services/localApiAuth';
const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

interface SalesReturnReportProps {
  initialSearch?: string;
  initialDateFrom?: string;
  initialDateTo?: string;
  initialItemRefno?: string;
  initialItemCode?: string;
  initialStatus?: string;
}

type DatePreset = 'today' | 'week' | 'month' | 'year' | 'all' | 'custom';

const toLocalDateValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDateRange = (preset: Exclude<DatePreset, 'custom'>) => {
  const today = new Date();
  const dateTo = toLocalDateValue(today);
  if (preset === 'all') return { dateFrom: '', dateTo: '' };

  const dateFrom = new Date(today);
  if (preset === 'week') {
    const daysSinceMonday = (today.getDay() + 6) % 7;
    dateFrom.setDate(today.getDate() - daysSinceMonday);
  } else if (preset === 'month') {
    dateFrom.setDate(1);
  } else if (preset === 'year') {
    dateFrom.setMonth(0, 1);
  }

  return { dateFrom: toLocalDateValue(dateFrom), dateTo };
};

const SalesReturnReport: React.FC<SalesReturnReportProps> = ({
  initialSearch = '',
  initialDateFrom = '',
  initialDateTo = '',
  initialItemRefno = '',
  initialItemCode = '',
  initialStatus = '',
}) => {
  const today = useMemo(() => toLocalDateValue(new Date()), []);
  const [loading, setLoading] = useState(false);
  const [hasLoadedReport, setHasLoadedReport] = useState(false);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [rows, setRows] = useState<SalesReturnReportRow[]>([]);
  const [summary, setSummary] = useState({ totalQty: 0, totalAmount: 0 });
  const [meta, setMeta] = useState({ page: 1, perPage: 100, total: 0, totalPages: 0 });

  const [filters, setFilters] = useState<SalesReturnReportFilters>({
    dateFrom: initialDateFrom || today,
    dateTo: initialDateTo || today,
    status: initialStatus,
    search: initialItemRefno || initialItemCode ? '' : initialSearch,
    itemRefno: initialItemRefno,
    itemCode: initialItemCode,
    page: 1,
    perPage: 100,
  });
  const [datePreset, setDatePreset] = useState<DatePreset>(initialDateFrom || initialDateTo ? 'custom' : 'today');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: searchInput, page: 1 }));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const optionData = await fetchSalesReturnReportOptions();
      if (mounted) {
        setStatuses(optionData.statuses);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchSalesReturnReport(filters);
      setRows(data.items);
      setSummary(data.summary);
      setMeta(data.meta);
    } catch (loadError) {
      if (shouldSuppressAuthError(loadError)) return;
      setError(loadError instanceof Error ? loadError.message : 'Unable to load the sales return report.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (hasLoadedReport) loadReport();
  }, [hasLoadedReport, loadReport]);

  const handleClear = () => {
    setSearchInput('');
    setDatePreset('today');
    setFilters({
      dateFrom: today,
      dateTo: today,
      status: '',
      search: '',
      itemRefno: '',
      itemCode: '',
      page: 1,
      perPage: 100,
    });
  };

  const applyDatePreset = (preset: Exclude<DatePreset, 'custom'>) => {
    setDatePreset(preset);
    setFilters((prev) => ({ ...prev, ...getDateRange(preset), page: 1 }));
  };

  const handleExport = () => {
    if (rows.length === 0) return;
    const headers = ['Return No', 'Date', 'Timestamp', 'Transaction No', 'Customer', 'Status', 'Item Code', 'Part No', 'Brand', 'Price', 'Qty', 'Total'];
    const esc = (value: string | number) => {
      const str = String(value ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    const csvRows = [
      headers.join(','),
      ...rows.map((r) =>
        [
          r.returnNo,
          r.returnDate,
          formatAccountingTimestamp(r.createdAt),
          r.transactionNo,
          r.customer,
          r.status,
          r.itemCode,
          r.partNo,
          r.brand,
          r.price.toFixed(2),
          r.qty,
          r.total.toFixed(2),
        ]
          .map(esc)
          .join(',')
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sales-return-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950 p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Sales Return Report</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button
            onClick={() => window.print()}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            <Printer className="h-4 w-4" /> Print
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="md:col-span-6">
          <span className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Date range</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Quick date ranges">
            {([
              ['today', 'Today'],
              ['week', 'This week'],
              ['month', 'This month'],
              ['year', 'This year'],
              ['all', 'All dates'],
            ] as const).map(([preset, label]) => (
              <button
                key={preset}
                type="button"
                aria-pressed={datePreset === preset}
                onClick={() => applyDatePreset(preset)}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 ${datePreset === preset
                  ? 'border-brand-blue bg-brand-blue text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'}`}
              >
                {label}
              </button>
            ))}
            <span className={`self-center px-2 text-sm font-medium ${datePreset === 'custom' ? 'text-brand-blue' : 'text-slate-500 dark:text-slate-400'}`} aria-current={datePreset === 'custom' ? 'true' : undefined}>
              Custom range
            </span>
          </div>
        </div>
        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
          From
          <input
            type="date"
            aria-label="Date from"
            value={filters.dateFrom || ''}
            onChange={(e) => {
              setDatePreset('custom');
              setFilters((prev) => ({ ...prev, dateFrom: e.target.value, page: 1 }));
            }}
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
        </label>
        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
          To
          <input
            type="date"
            aria-label="Date to"
            value={filters.dateTo || ''}
            onChange={(e) => {
              setDatePreset('custom');
              setFilters((prev) => ({ ...prev, dateTo: e.target.value, page: 1 }));
            }}
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
        </label>
        <select
          value={filters.status || ''}
          onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value, page: 1 }))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="">All Status</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <div className="relative md:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setFilters((prev) => ({ ...prev, itemRefno: '', itemCode: '', page: 1 }));
            }}
            placeholder="Search return no, customer, item code..."
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (hasLoadedReport) loadReport();
              else setHasLoadedReport(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white dark:bg-slate-700"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </button>
          <button
            onClick={handleClear}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900">
          <span className="text-slate-500">Rows</span>
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{meta.total.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900">
          <span className="text-slate-500">Total Qty</span>
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{summary.totalQty.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900">
          <span className="text-slate-500">Total Amount</span>
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{peso.format(summary.totalAmount)}</p>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          Sales return records could not be loaded: {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-xs uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <tr>
              <th className="px-3 py-2 text-left">Return No</th>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Timestamp</th>
              <th className="px-3 py-2 text-left">Transaction No</th>
              <th className="px-3 py-2 text-left">Customer</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Item Code</th>
              <th className="px-3 py-2 text-left">Part No</th>
              <th className="px-3 py-2 text-left">Brand</th>
              <th className="px-3 py-2 text-right">Price</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={12} className="px-3 py-8 text-center text-slate-500">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading report...
                  </span>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-3 py-8 text-center text-slate-500">
                  No sales returns found for selected filters.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={`${row.id}-${row.itemCode}-${row.partNo}`} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">{row.returnNo || '-'}</td>
                  <td className="px-3 py-2">{row.returnDate || '-'}</td>
                  <td className="whitespace-nowrap px-3 py-2">{formatAccountingTimestamp(row.createdAt)}</td>
                  <td className="px-3 py-2">{row.transactionNo || '-'}</td>
                  <td className="px-3 py-2">{row.customer || '-'}</td>
                  <td className="px-3 py-2">{row.status || '-'}</td>
                  <td className="px-3 py-2">{row.itemCode || '-'}</td>
                  <td className="px-3 py-2">{row.partNo || '-'}</td>
                  <td className="px-3 py-2">{row.brand || '-'}</td>
                  <td className="px-3 py-2 text-right">{peso.format(row.price || 0)}</td>
                  <td className="px-3 py-2 text-right">{row.qty.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right font-semibold">{peso.format(row.total || 0)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          disabled={meta.page <= 1 || loading}
          onClick={() => setFilters((prev) => ({ ...prev, page: Math.max(1, (prev.page || 1) - 1) }))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          Prev
        </button>
        <span className="text-sm text-slate-600 dark:text-slate-300">
          Page {meta.page} / {Math.max(meta.totalPages, 1)}
        </span>
        <button
          disabled={meta.page >= meta.totalPages || meta.totalPages === 0 || loading}
          onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page || 1) + 1 }))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default SalesReturnReport;
