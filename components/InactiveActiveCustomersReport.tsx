import React, { useEffect, useMemo, useState } from 'react';
import { Download, Loader2, Printer, RefreshCw, RotateCcw, Search } from 'lucide-react';
import {
  fetchInactiveActiveCustomersReport,
  InactiveActiveCustomerRow,
} from '../services/inactiveActiveCustomersReportService';

const formatDate = (dateValue: string): string => {
  if (!dateValue) return 'N/A';
  const dt = new Date(dateValue);
  if (Number.isNaN(dt.getTime())) return dateValue;
  return dt.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
};

const InactiveActiveCustomersReport: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<InactiveActiveCustomerRow[]>([]);
  const [searchInput, setSearchInput] = useState('');

  const [filters, setFilters] = useState({
    status: 'all' as 'all' | 'active' | 'inactive',
    search: '',
    cutoffMonths: 3,
    page: 1,
    perPage: 100,
  });

  const [summary, setSummary] = useState({
    activeCount: 0,
    inactiveCount: 0,
    totalCount: 0,
    cutoffMonths: 3,
    cutoffDate: '',
  });

  const [meta, setMeta] = useState({
    page: 1,
    perPage: 100,
    total: 0,
    totalPages: 0,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: searchInput.trim(), page: 1 }));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await fetchInactiveActiveCustomersReport(filters);
      setRows(data.items);
      setSummary(data.summary);
      setMeta({
        page: data.meta.page,
        perPage: data.meta.perPage,
        total: data.meta.total,
        totalPages: data.meta.totalPages,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [filters]);

  const grouped = useMemo(() => {
    const active = rows.filter((r) => r.customerStatus === 'active');
    const inactive = rows.filter((r) => r.customerStatus === 'inactive');
    return { active, inactive };
  }, [rows]);

  const handleReset = () => {
    setSearchInput('');
    setFilters({
      status: 'all',
      search: '',
      cutoffMonths: 3,
      page: 1,
      perPage: 100,
    });
  };

  const handleExport = () => {
    if (!rows.length) return;
    const headers = ['Status', 'Customer Name', 'Customer Code', 'Group', 'Sales Person', 'Last Purchase'];
    const esc = (value: string) => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        [
          row.customerStatus,
          row.customerName,
          row.customerCode,
          row.customerGroup,
          row.salesPerson,
          row.lastPurchase,
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
          <td colSpan={4} className="px-3 py-8 text-center text-slate-500">
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
          <td colSpan={4} className="px-3 py-8 text-center text-slate-500">
            {emptyMessage}
          </td>
        </tr>
      );
    }

    return list.map((row) => (
      <tr key={`${row.id}-${row.customerStatus}`} className="border-t border-slate-100 dark:border-slate-800">
        <td className="px-3 py-2">{row.customerName || '-'}</td>
        <td className="px-3 py-2">{row.customerGroup || '-'}</td>
        <td className="px-3 py-2">{row.salesPerson || '-'}</td>
        <td className="px-3 py-2">{formatDate(row.lastPurchase)}</td>
      </tr>
    ));
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950 p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Inactive/Active Customers</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={!rows.length}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button
            onClick={() => window.print()}
            disabled={!rows.length}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            <Printer className="h-4 w-4" /> Print
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-5 dark:border-slate-800 dark:bg-slate-900">
        <select
          value={filters.status}
          onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value as any, page: 1 }))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="all">All Status</option>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive Only</option>
        </select>
        <select
          value={String(filters.cutoffMonths)}
          onChange={(e) => setFilters((prev) => ({ ...prev, cutoffMonths: Number(e.target.value) || 3, page: 1 }))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="3">3 Months Cutoff</option>
          <option value="6">6 Months Cutoff</option>
          <option value="12">12 Months Cutoff</option>
        </select>
        <div className="relative md:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search customer, group, salesperson..."
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
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
        </div>
      </div>

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
        Active customers: last transaction is within the last {summary.cutoffMonths} month(s). Inactive customers: last
        transaction is older than {summary.cutoffMonths} month(s).
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
                <th className="px-3 py-2 text-left">Group</th>
                <th className="px-3 py-2 text-left">Salesman</th>
                <th className="px-3 py-2 text-left">Last Purchase</th>
              </tr>
            </thead>
            <tbody>{renderRows(grouped.active, 'No active customers for selected filters.')}</tbody>
          </table>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-3 py-2 text-sm font-semibold text-rose-700 dark:border-slate-800 dark:text-rose-400">
            Inactive Customers
          </div>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th className="px-3 py-2 text-left">Customer Name</th>
                <th className="px-3 py-2 text-left">Group</th>
                <th className="px-3 py-2 text-left">Salesman</th>
                <th className="px-3 py-2 text-left">Last Purchase</th>
              </tr>
            </thead>
            <tbody>{renderRows(grouped.inactive, 'No inactive customers for selected filters.')}</tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
        <div>
          Showing {rows.length.toLocaleString()} of {meta.total.toLocaleString()} record(s)
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilters((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
            disabled={filters.page <= 1 || loading}
            className="rounded border border-slate-300 px-3 py-1 disabled:opacity-40 dark:border-slate-700"
          >
            Prev
          </button>
          <span>
            Page {meta.page} / {Math.max(1, meta.totalPages)}
          </span>
          <button
            onClick={() => setFilters((prev) => ({ ...prev, page: Math.min(Math.max(1, meta.totalPages), prev.page + 1) }))}
            disabled={filters.page >= Math.max(1, meta.totalPages) || loading}
            className="rounded border border-slate-300 px-3 py-1 disabled:opacity-40 dark:border-slate-700"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default InactiveActiveCustomersReport;

