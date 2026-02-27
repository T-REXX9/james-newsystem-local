import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Loader2, Printer, RefreshCw, RotateCcw, Search } from 'lucide-react';
import {
  fetchSalesReturnReport,
  fetchSalesReturnReportOptions,
  SalesReturnReportFilters,
  SalesReturnReportRow,
} from '../services/salesReturnReportService';

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

const SalesReturnReport: React.FC = () => {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [statuses, setStatuses] = useState<string[]>([]);
  const [rows, setRows] = useState<SalesReturnReportRow[]>([]);
  const [summary, setSummary] = useState({ totalQty: 0, totalAmount: 0 });
  const [meta, setMeta] = useState({ page: 1, perPage: 100, total: 0, totalPages: 0 });

  const [filters, setFilters] = useState<SalesReturnReportFilters>({
    dateFrom: today,
    dateTo: today,
    status: '',
    search: '',
    page: 1,
    perPage: 100,
  });

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
    try {
      const data = await fetchSalesReturnReport(filters);
      setRows(data.items);
      setSummary(data.summary);
      setMeta(data.meta);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleClear = () => {
    setSearchInput('');
    setFilters({
      dateFrom: today,
      dateTo: today,
      status: '',
      search: '',
      page: 1,
      perPage: 100,
    });
  };

  const handleExport = () => {
    if (rows.length === 0) return;
    const headers = ['Return No', 'Date', 'Transaction No', 'Customer', 'Status', 'Item Code', 'Part No', 'Brand', 'Price', 'Qty', 'Total'];
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
        <input
          type="date"
          value={filters.dateFrom || ''}
          onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value, page: 1 }))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        />
        <input
          type="date"
          value={filters.dateTo || ''}
          onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value, page: 1 }))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        />
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
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search return no, customer, item code..."
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadReport}
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

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-xs uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <tr>
              <th className="px-3 py-2 text-left">Return No</th>
              <th className="px-3 py-2 text-left">Date</th>
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
                <td colSpan={11} className="px-3 py-8 text-center text-slate-500">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading report...
                  </span>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-slate-500">
                  No sales returns found for selected filters.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={`${row.id}-${row.itemCode}-${row.partNo}`} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">{row.returnNo || '-'}</td>
                  <td className="px-3 py-2">{row.returnDate || '-'}</td>
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
