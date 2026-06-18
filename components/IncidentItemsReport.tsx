import React, { useCallback, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Download,
  Filter,
  Loader2,
  PackageSearch,
  Printer,
  RefreshCcw,
  Search,
  ShieldAlert,
  Truck,
  X,
} from 'lucide-react';
import {
  fetchIncidentItemsReport,
  IncidentItemsReportData,
  IncidentItemsReportFilters,
  IncidentItemsReportRow,
  IncidentMatchSource,
} from '../services/incidentItemsReportService';

const matchSourceOptions: Array<{ value: IncidentMatchSource; label: string }> = [
  { value: 'all', label: 'All sources' },
  { value: 'manual', label: 'Manual' },
  { value: 'related_transaction', label: 'Related transaction' },
  { value: 'description_match', label: 'Description match' },
  { value: 'imported', label: 'Imported' },
];

const formatDate = (value: string) => {
  if (!value) return '-';
  const date = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
};

const StatBox: React.FC<{ label: string; value: string | number; icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <div className="text-brand-blue">{icon}</div>
    </div>
    <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
  </div>
);

const IncidentItemsReport: React.FC = () => {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().slice(0, 10);
  }, []);

  const [filters, setFilters] = useState<IncidentItemsReportFilters>({
    search: '',
    supplier: '',
    matchSource: 'all',
    dateFrom: monthAgo,
    dateTo: today,
    minCount: 1,
    page: 1,
    perPage: 100,
  });
  const [reportData, setReportData] = useState<IncidentItemsReportData | null>(null);
  const [selectedRow, setSelectedRow] = useState<IncidentItemsReportRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async (nextFilters: IncidentItemsReportFilters = filters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchIncidentItemsReport(nextFilters);
      setReportData(data);
      if (data.items.length > 0) setSelectedRow(data.items[0]);
    } catch (err: any) {
      setError(String(err?.message || 'Unable to load incident items report.'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const updateFilter = <K extends keyof IncidentItemsReportFilters>(key: K, value: IncidentItemsReportFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const clearFilters = () => {
    const next = {
      search: '',
      supplier: '',
      matchSource: 'all' as IncidentMatchSource,
      dateFrom: monthAgo,
      dateTo: today,
      minCount: 1,
      page: 1,
      perPage: 100,
    };
    setFilters(next);
    setReportData(null);
    setSelectedRow(null);
    setError(null);
  };

  const exportCsv = () => {
    if (!reportData?.items.length) return;
    const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const headers = ['Supplier', 'Item Code', 'Part No', 'Description', 'Incident Count', 'Latest Incident', 'Match Sources', 'Confidence'];
    const rows = reportData.items.map((row) => [
      row.supplier_name,
      row.item_code,
      row.part_no,
      row.description,
      row.incident_count,
      formatDate(row.latest_incident_date),
      row.match_sources,
      `${Math.round(row.average_confidence * 100)}%`,
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `incident-items-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const rows = reportData?.items || [];
  const summary = reportData?.summary;

  return (
    <div className="flex h-full flex-col bg-slate-50 p-6 text-slate-800 animate-fadeIn dark:bg-slate-950 dark:text-slate-100 print:bg-white print:p-0">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between print:mb-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white print:text-black">
            <ShieldAlert className="h-6 w-6 text-brand-blue print:text-black" />
            Incident Items Report
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 print:text-gray-600">
            Track recurring product issues by item and supplier.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={exportCsv}
            disabled={!rows.length}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!rows.length}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4 print:hidden">
        <StatBox label="Incident Items" value={summary?.total_incident_items || 0} icon={<AlertTriangle className="h-5 w-5" />} />
        <StatBox label="Suppliers" value={summary?.affected_suppliers || 0} icon={<Truck className="h-5 w-5" />} />
        <StatBox label="Items" value={summary?.affected_items || 0} icon={<PackageSearch className="h-5 w-5" />} />
        <StatBox label="Top Count" value={summary?.top_incident_count || 0} icon={<ShieldAlert className="h-5 w-5" />} />
      </div>

      <div className="mb-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 print:hidden">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-8">
          <label className="lg:col-span-2">
            <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={filters.search || ''}
                onChange={(e) => updateFilter('search', e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                placeholder="Item, part no, issue..."
              />
            </div>
          </label>
          <label className="lg:col-span-2">
            <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Supplier</span>
            <input
              value={filters.supplier || ''}
              onChange={(e) => updateFilter('supplier', e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              placeholder="Supplier name or ID"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Source</span>
            <select
              value={filters.matchSource || 'all'}
              onChange={(e) => updateFilter('matchSource', e.target.value as IncidentMatchSource)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              {matchSourceOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-bold uppercase text-slate-500">From</span>
            <input
              type="date"
              value={filters.dateFrom || ''}
              onChange={(e) => updateFilter('dateFrom', e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-bold uppercase text-slate-500">To</span>
            <input
              type="date"
              value={filters.dateTo || ''}
              onChange={(e) => updateFilter('dateTo', e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Min Count</span>
            <input
              type="number"
              min={1}
              value={filters.minCount || 1}
              onChange={(e) => updateFilter('minCount', Number(e.target.value) || 1)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <RefreshCcw className="h-4 w-4" />
            Reset
          </button>
          <button
            type="button"
            onClick={() => loadReport()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4" />}
            Generate Report
          </button>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px] print:block">
        <div className="min-h-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 print:shadow-none">
          <div className="h-full overflow-auto">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-slate-100 text-xs font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300 print:static print:bg-gray-100 print:text-black">
                <tr>
                  <th className="px-3 py-3">Supplier</th>
                  <th className="px-3 py-3">Item Code</th>
                  <th className="px-3 py-3">Part No</th>
                  <th className="px-3 py-3">Description</th>
                  <th className="px-3 py-3 text-center">Incidents</th>
                  <th className="px-3 py-3">Latest</th>
                  <th className="px-3 py-3">Source</th>
                  <th className="px-3 py-3 text-center">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-12 text-center text-slate-500">
                      <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
                      Loading report...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-12 text-center text-slate-500">
                      Generate the report to view incident items.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const selected = selectedRow === row;
                    const highRisk = row.incident_count >= 4;
                    return (
                      <tr
                        key={`${row.supplier_id}-${row.product_id}-${row.item_code}-${row.part_no}`}
                        onClick={() => setSelectedRow(row)}
                        className={`cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                          selected ? 'bg-blue-50 dark:bg-blue-950/30' : ''
                        }`}
                      >
                        <td className="px-3 py-3 font-semibold text-slate-900 dark:text-white">{row.supplier_name || '-'}</td>
                        <td className="px-3 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">{row.item_code || '-'}</td>
                        <td className="px-3 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">{row.part_no || '-'}</td>
                        <td className="max-w-md px-3 py-3 text-slate-600 dark:text-slate-300">{row.description || '-'}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`inline-flex min-w-10 justify-center rounded-full px-2 py-1 text-xs font-bold ${
                            highRisk ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                          }`}>
                            {row.incident_count}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{formatDate(row.latest_incident_date)}</td>
                        <td className="px-3 py-3 text-xs text-slate-600 dark:text-slate-300">{row.match_sources || '-'}</td>
                        <td className="px-3 py-3 text-center font-mono text-xs text-slate-600 dark:text-slate-300">
                          {Math.round(row.average_confidence * 100)}%
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 print:hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Details</h2>
            {selectedRow ? (
              <button type="button" onClick={() => setSelectedRow(null)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800">
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          {selectedRow ? (
            <div className="space-y-4 p-4">
              <div>
                <p className="text-xs font-bold uppercase text-slate-500">Supplier</p>
                <p className="mt-1 font-semibold text-slate-900 dark:text-white">{selectedRow.supplier_name}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-slate-500">Item</p>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{selectedRow.description}</p>
                <p className="mt-1 text-xs font-mono text-slate-500">{selectedRow.item_code || '-'} / {selectedRow.part_no || '-'}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/70">
                <p className="text-xs font-bold uppercase text-slate-500">Recent Incidents</p>
                <div className="mt-3 space-y-3">
                  {selectedRow.recent_incidents.map((incident) => (
                    <div key={incident.incident_report_id} className="border-l-2 border-brand-blue pl-3">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">{incident.incident_report_id}</p>
                      <p className="text-xs text-slate-500">{formatDate(incident.date)}</p>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{incident.summary || '-'}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-slate-500">Select a row to inspect recent incidents.</div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default IncidentItemsReport;
