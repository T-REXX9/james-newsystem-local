import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ClipboardList,
  FileSearch,
  Headphones,
  Loader2,
  MessageSquare,
  PackageCheck,
  Phone,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Truck,
  UserRoundCheck,
  Users,
  Wrench,
  XCircle,
} from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import { fetchDailyCallMasterList } from '../services/dailyCallMonitoringService';
import { DailyCallMasterCustomerRow, DailyCallMasterListMeta } from '../types';
import DashboardViewportFit from './DashboardViewportFit';

const fromDate = '2025-10-01';
const monthlyTarget = 3_000_000;

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

const compactPeso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  notation: 'compact',
  maximumFractionDigits: 2,
});

type CategoryId = 'priority' | 'recovery' | 'verified' | 'unverified';

interface CategoryDefinition {
  id: CategoryId;
  label: string;
  note: string;
  state: string;
  accent: string;
  iconBg: string;
  border: string;
  softBg: string;
  dot: string;
  matches: (row: DailyCallMasterCustomerRow) => boolean;
}

const categories: CategoryDefinition[] = [
  {
    id: 'priority',
    label: 'Priority List',
    note: 'Apr 2026 – Current',
    state: 'Active Buyers',
    accent: 'text-emerald-700',
    iconBg: 'bg-emerald-600',
    border: 'border-emerald-200',
    softBg: 'bg-emerald-50/60',
    dot: 'bg-emerald-500',
    matches: (row) => row.purchaseAgeGroup === 'recent',
  },
  {
    id: 'recovery',
    label: 'Recovery List',
    note: 'Oct 2025 – Mar 2026',
    state: 'Recovery',
    accent: 'text-rose-700',
    iconBg: 'bg-rose-600',
    border: 'border-rose-200',
    softBg: 'bg-rose-50/60',
    dot: 'bg-rose-500',
    matches: (row) => row.purchaseAgeGroup === 'over_one_month' && row.assignedTo !== 'Unassigned',
  },
  {
    id: 'verified',
    label: 'Verified Prospects',
    note: 'By Agent',
    state: 'Verified',
    accent: 'text-blue-700',
    iconBg: 'bg-blue-600',
    border: 'border-blue-200',
    softBg: 'bg-blue-50/60',
    dot: 'bg-blue-500',
    matches: (row) => row.purchaseAgeGroup === 'two_weeks_to_one_month',
  },
  {
    id: 'unverified',
    label: 'Unverified Prospects',
    note: 'Need Call',
    state: 'Need Verification',
    accent: 'text-orange-600',
    iconBg: 'bg-orange-500',
    border: 'border-orange-200',
    softBg: 'bg-orange-50/60',
    dot: 'bg-orange-400',
    matches: (row) => row.purchaseAgeGroup === 'over_one_month' && row.assignedTo === 'Unassigned',
  },
];

const sumBy = (rows: DailyCallMasterCustomerRow[], field: 'totalSales' | 'currentMonthSales' | 'purchaseCount') =>
  rows.reduce((sum, row) => sum + row[field], 0);

const ageLabel = (days: number) => days === 1 ? '1 day ago' : `${days} days ago`;

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

  const totals = useMemo(() => ({
    sales: sumBy(rows, 'totalSales'),
    current: sumBy(rows, 'currentMonthSales'),
    purchases: sumBy(rows, 'purchaseCount'),
  }), [rows]);

  const categoryData = useMemo(() => categories.map((category) => {
    const categoryRows = rows.filter(category.matches);
    const currentSales = sumBy(categoryRows, 'currentMonthSales');
    const potentialSales = sumBy(categoryRows, 'totalSales');
    const averageSales = categoryRows.length ? potentialSales / categoryRows.length : 0;
    return { ...category, rows: categoryRows, currentSales, potentialSales, averageSales };
  }), [rows]);

  const totalPotential = categoryData.reduce((sum, category) => sum + category.potentialSales, 0);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading master list...
        </div>
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <DashboardViewportFit revision={rows.length}>
    <div className="min-w-[1180px] space-y-4 bg-white text-[#0f1f46]" data-testid="master-list-dashboard">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Owner Daily Call Monitoring</p>
          <h2 className="mt-1 flex items-center gap-2 text-2xl font-bold">
            <ClipboardList className="h-6 w-6 text-blue-700" /> Master List
          </h2>
        </div>
        <label className="relative block w-[340px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search customer, city, contact..."
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500"
          />
        </label>
      </header>

      {error && (
        <div className="flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{error}</span>
          <button type="button" onClick={() => loadRows()} className="flex items-center gap-1 font-bold">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      )}

      <section className="grid grid-cols-4 gap-4" aria-label="Customer category summaries">
        {categoryData.map((category) => (
          <article key={category.id} className={`rounded-xl border ${category.border} ${category.softBg} p-4 shadow-sm`}>
            <h3 className={`text-sm font-bold uppercase ${category.accent}`}>
              {category.label} <span className="text-[10px] normal-case">({category.note})</span>
            </h3>
            <div className="mt-3 grid grid-cols-[3rem_1fr_1.2fr] items-center gap-3">
              <div className={`grid h-11 w-11 place-items-center rounded-full text-white ${category.iconBg}`}>
                <Users className="h-6 w-6" />
              </div>
              <div className="border-r border-slate-200 pr-3">
                <p className="text-2xl font-bold">{category.rows.length}</p>
                <p className="text-xs">Customers</p>
              </div>
              <div className="space-y-2 text-right text-[10px]">
                <div>
                  <p>{category.id === 'priority' || category.id === 'recovery' ? 'Current Month Sales' : 'Average Monthly Purchase'}</p>
                  <p className={`text-lg font-bold ${category.accent}`}>
                    {compactPeso.format(category.id === 'priority' || category.id === 'recovery' ? category.currentSales : category.averageSales)}
                  </p>
                </div>
                <div>
                  <p>{category.id === 'priority' || category.id === 'recovery' ? 'Average Monthly Sales' : 'Potential Sales'}</p>
                  <p className={`text-lg font-bold ${category.accent}`}>{compactPeso.format(category.potentialSales)}</p>
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2 text-xs">
              <span>Potential Sales</span>
              <strong className={`text-lg ${category.accent}`}>{compactPeso.format(category.potentialSales)}</strong>
            </div>
          </article>
        ))}
      </section>

      <section className="grid grid-cols-4 gap-3" aria-label="Customer category tables">
        {categoryData.map((category) => (
          <article key={category.id} className="flex min-h-[370px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-3">
              <h3 className={`text-sm font-bold uppercase ${category.accent}`}>
                {category.label} <span className="text-[9px] normal-case">({category.note})</span>
              </h3>
              <span className="flex items-center gap-1 text-[10px]"><i className={`h-2 w-2 rounded-full ${category.dot}`} />{category.state}</span>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <table className="w-full table-fixed text-left text-[9px]">
                <thead className="bg-slate-50 text-[8px] text-slate-600">
                  <tr>
                    <th className="w-6 px-2 py-2">#</th>
                    <th className="px-1 py-2">Customer / Mobile</th>
                    <th className="w-[62px] px-1 py-2">Last Purchase</th>
                    <th className="w-[58px] px-1 py-2">Sales</th>
                    <th className="w-[62px] px-1 py-2">Agent</th>
                    <th className="w-12 px-1 py-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {category.rows.slice(0, 5).map((row, index) => (
                    <tr key={row.id} className="border-t border-slate-100 align-top">
                      <td className="px-2 py-2.5 font-bold">{index + 1}</td>
                      <td className="px-1 py-2.5">
                        <p className="line-clamp-2 font-bold leading-tight">{row.shopName}</p>
                        <p className="mt-1 truncate text-[8px] text-slate-500">{row.contactNumber}</p>
                      </td>
                      <td className="px-1 py-2.5">
                        <p className="font-medium">{row.lastPurchaseDate}</p>
                        <p className="mt-1 text-[8px] text-slate-500">{ageLabel(row.daysSinceLastPurchase)}</p>
                      </td>
                      <td className="px-1 py-2.5 font-bold">{compactPeso.format(row.currentMonthSales || row.totalSales)}</td>
                      <td className="break-words px-1 py-2.5">{row.assignedTo}</td>
                      <td className="px-1 py-2.5">
                        <div className="flex justify-center gap-1">
                          <button type="button" aria-label={`Call ${row.shopName}`} className="rounded-full border border-emerald-200 p-1 text-emerald-600"><Phone className="h-3 w-3" /></button>
                          <button type="button" aria-label={`Message ${row.shopName}`} className="rounded-full border border-blue-200 p-1 text-blue-600"><MessageSquare className="h-3 w-3" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {category.rows.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-12 text-center text-xs text-slate-400">No customers in this category.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2 text-[10px]">
              <span>Showing 1 to {Math.min(5, category.rows.length)} of {category.rows.length} entries</span>
              <button type="button" className={`font-bold ${category.accent}`}>View all {category.rows.length} customers ›</button>
            </div>
          </article>
        ))}
      </section>

      <section className="grid grid-cols-[1.25fr_1.3fr_0.6fr] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-r border-slate-200 p-4">
          <h3 className="text-sm font-bold uppercase">Customer Case Overview <span className="text-xs font-normal normal-case">(This Month)</span></h3>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {[
              ['Inquiry & Orders', Users, 12, 6, 'text-blue-700 border-blue-200 bg-blue-50'],
              ['Delivery Issues', Truck, 3, 1, 'text-orange-600 border-orange-200 bg-orange-50'],
              ['Quality Issues', Wrench, 5, 2, 'text-rose-600 border-rose-200 bg-rose-50'],
              ['Incident Reports', ShieldAlert, 4, 2, 'text-violet-700 border-violet-200 bg-violet-50'],
              ['Sales Returns', RotateCcw, 3, 2, 'text-emerald-700 border-emerald-200 bg-emerald-50'],
            ].map(([label, Icon, open, pending, tone]) => (
              <div key={String(label)} className={`rounded-lg border p-2 text-center ${tone}`}>
                {React.createElement(Icon as React.ComponentType<{ className?: string }>, { className: 'mx-auto h-5 w-5' })}
                <p className="mt-2 min-h-8 text-[9px] font-bold uppercase">{String(label)}</p>
                <div className="mt-2 flex justify-around text-[9px]"><span>Open<br/><b className="text-base">{String(open)}</b></span><span>Pending<br/><b className="text-base">{String(pending)}</b></span></div>
                <button type="button" className="mt-2 text-[9px] font-bold text-blue-700">View Details</button>
              </div>
            ))}
          </div>
        </div>

        <div className="border-r border-slate-200 p-4">
          <h3 className="text-sm font-bold uppercase">Incident Report Flow</h3>
          <div className="mt-7 flex items-start justify-between gap-1 text-center">
            {[
              [Phone, 'Customer Calls / SMS'],
              [Bot, 'AI Records Complaint'],
              [FileSearch, 'AI Extracts Customer'],
              [UserRoundCheck, 'Management Approves'],
              [CheckCircle2, 'If Approved'],
              [XCircle, 'If Rejected'],
              [Truck, 'Shipment Posted'],
              [PackageCheck, 'AI Sends Tracking'],
              [Headphones, 'Customer Calls Agent'],
            ].map(([Icon, label], index) => (
              <React.Fragment key={String(label)}>
                <div className="w-14 shrink-0">
                  <span className="mx-auto grid h-6 w-6 place-items-center rounded-full bg-slate-100 text-[10px] font-bold">{index + 1}</span>
                  <div className="mx-auto mt-3 grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-blue-900">
                    {React.createElement(Icon as React.ComponentType<{ className?: string }>, { className: 'h-5 w-5' })}
                  </div>
                  <p className="mt-2 text-[8px] leading-tight">{String(label)}</p>
                </div>
                {index < 8 && <span className="mt-12 text-xs font-bold">→</span>}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="p-4">
          <h3 className="text-sm font-bold uppercase">Quick Summary (MTD)</h3>
          <dl className="mt-3 space-y-3 text-xs">
            {[
              ['Current Month Sales', totals.current],
              ['Monthly Target', monthlyTarget],
              ['Remaining to Target', Math.max(0, monthlyTarget - totals.current)],
              ['Total Potential Sales', totalPotential],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex justify-between gap-3 border-b border-slate-100 pb-2"><dt>{String(label)}</dt><dd className="font-bold">{peso.format(Number(value))}</dd></div>
            ))}
            <div className="flex justify-between"><dt>Pipeline vs Target</dt><dd className="font-bold text-emerald-700">{monthlyTarget ? ((totalPotential / monthlyTarget) * 100).toFixed(2) : '0'}%</dd></div>
          </dl>
        </div>
      </section>

      <nav className="flex items-center gap-3 rounded-lg bg-slate-50 px-5 py-3 text-xs" aria-label="Quick Go To">
        <strong className="uppercase">Quick Go To:</strong>
        {categoryData.map((category) => (
          <button key={category.id} type="button" className={`rounded-md border ${category.border} ${category.softBg} px-5 py-2 font-bold ${category.accent}`}>
            {category.label} ({category.rows.length})
          </button>
        ))}
        <button type="button" className="rounded-md border border-slate-200 bg-white px-5 py-2 font-bold">All Customers ({meta.count || rows.length})</button>
      </nav>

      <footer className="flex items-center justify-between px-2 pb-2 text-[10px] text-slate-500">
        <span>© 2026 TND-OPC. All rights reserved.</span><span>Version 1.0.0</span>
      </footer>
    </div>
    </DashboardViewportFit>
  );
};

export default DailyCallMasterListView;
