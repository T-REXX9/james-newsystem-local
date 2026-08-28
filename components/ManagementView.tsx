import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { formatCurrency } from '../utils/formatUtils';
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  ChevronDown,
  DollarSign,
  RefreshCw,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  UserRound,
  Users,
  WalletCards,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fetchManagementDashboardData, ManagementDashboardData } from '../services/managementDashboardLocalApiService';
import CallAccountabilityPanel from './CallAccountabilityPanel';

interface ManagementViewProps {
  currentUser?: any;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_SHORT_NAMES = MONTH_NAMES.map((month) => month.slice(0, 3));
// Using shared formatCurrency for consistency
const NUMBER = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 });

const emptyDashboard: ManagementDashboardData = {
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  kpis: { totalSalesYtd: 0, totalCollectionsYtd: 0, outstandingReceivables: 0, activeCustomers: 0 },
  monthlySales: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, sales: 0, collections: 0 })),
  topCustomers: [],
  topSalespeople: [],
  bestItems: [],
  worstItems: [],
  team: [], city: [], status: [], payment: [], inactive: [], criticalInactive: [], inquiryOnly: [],
};

const isMasterUser = (user?: any): boolean => {
  const role = String(user?.role || '').trim().toLowerCase();
  const userType = String(user?.user_type ?? '').trim();
  return userType === '1' || ['master user', 'company owner', 'owner', 'main'].includes(role);
};

const formatCurrencyLocal = (value: number) => formatCurrency(Number.isFinite(value) ? value : 0, true);
const formatNumber = (value: number) => NUMBER.format(Number.isFinite(value) ? value : 0);

const MetricCard = ({ label, value, helper, icon: Icon, tone }: { label: string; value: string; helper: string; icon: React.ComponentType<{ className?: string }>; tone: string }) => (
  <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-2 truncate text-2xl font-extrabold text-slate-900" title={value}>{value}</p>
        <p className="mt-2 text-xs font-medium text-slate-500">{helper}</p>
      </div>
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white ${tone}`}>
        <Icon className="h-5 w-5" />
      </span>
    </div>
  </article>
);

const EmptyTable = ({ columns }: { columns: number }) => (
  <tr><td colSpan={columns} className="px-3 py-8 text-center text-sm text-slate-400">No records for the selected period.</td></tr>
);

export const ManagementView: React.FC<ManagementViewProps> = ({ currentUser }) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [dashboard, setDashboard] = useState<ManagementDashboardData>(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  const mainId = Number(currentUser?.main_id || currentUser?.main_userid || 1);
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const monthLabel = MONTH_NAMES[Math.max(0, Math.min(11, dashboard.month - 1))];
  const userName = String(currentUser?.full_name || currentUser?.name || 'Master User');

  const loadDashboard = useCallback(async () => {
    if (!isMasterUser(currentUser)) return;
    setLoading(true);
    setLoadError('');
    try {
      const data = await fetchManagementDashboardData(mainId, selectedYear, currentMonth);
      setDashboard(data);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load the Sales Performance Dashboard.');
    } finally {
      setLoading(false);
    }
  }, [currentMonth, currentUser, mainId, reloadToken, selectedYear]);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  const monthlyChartData = useMemo(() => dashboard.monthlySales.map((row) => ({
    ...row,
    label: MONTH_SHORT_NAMES[row.month - 1] || String(row.month),
  })), [dashboard.monthlySales]);

  const selectedMonthSales = dashboard.monthlySales.find((row) => row.month === dashboard.month)?.sales || 0;
  const selectedMonthCollections = dashboard.monthlySales.find((row) => row.month === dashboard.month)?.collections || 0;

  if (!isMasterUser(currentUser)) {
    return (
      <div className="grid min-h-full place-items-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-10 w-10 text-rose-500" />
          <h1 className="mt-4 text-xl font-bold text-slate-900">Master User access required</h1>
          <p className="mt-2 text-sm text-slate-600">The Sales Performance Dashboard is restricted to the Master User account.</p>
        </div>
      </div>
    );
  }

  if (loading && !dashboard.topCustomers.length && !loadError) {
    return <div className="grid min-h-full place-items-center bg-slate-50 text-sm font-semibold text-slate-500">Loading Sales Performance Dashboard…</div>;
  }

  return (
    <div className="min-h-full overflow-y-auto bg-slate-50 p-4 text-slate-900 md:p-6">

      <div className="mx-auto max-w-[1500px] space-y-4">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Management-only analytics</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold tracking-tight md:text-3xl"><BarChart3 className="h-7 w-7 text-blue-700" /> Sales Performance Dashboard</h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-slate-600"><CalendarDays className="h-4 w-4" /> Welcome, <strong>{userName}</strong>. Today is {new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: '2-digit', year: 'numeric' })}.</p>
          </div>
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold shadow-sm">
            <span className="text-slate-600">Filter by Year</span>
            <span className="relative">
              <select value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))} className="appearance-none bg-transparent py-1 pl-2 pr-7 font-extrabold outline-none">
                {Array.from({ length: 6 }, (_, index) => currentYear - index).map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </span>
          </label>
        </header>

        {loadError && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span>{loadError}</span>
            <button type="button" onClick={() => setReloadToken((token) => token + 1)} className="inline-flex items-center gap-2 rounded-md border border-rose-200 bg-white px-3 py-1.5 font-bold hover:bg-rose-100"><RefreshCw className="h-4 w-4" /> Retry</button>
          </div>
        )}

        <CallAccountabilityPanel title="Staff phone and call accountability" compact />

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Sales performance KPIs">
          <MetricCard label="Total Sales (YTD)" value={formatCurrencyLocal(dashboard.kpis.totalSalesYtd)} helper={`Selected year: ${selectedYear}`} icon={DollarSign} tone="bg-emerald-500" />
          <MetricCard label="Total Collections (YTD)" value={formatCurrencyLocal(dashboard.kpis.totalCollectionsYtd)} helper={`Selected year: ${selectedYear}`} icon={WalletCards} tone="bg-blue-500" />
          <MetricCard label="Outstanding Receivables" value={formatCurrencyLocal(dashboard.kpis.outstandingReceivables)} helper="Current ledger balance" icon={TrendingDown} tone="bg-violet-600" />
          <MetricCard label="Active Customers" value={formatNumber(dashboard.kpis.activeCustomers)} helper="Active non-prospect accounts" icon={Users} tone="bg-orange-500" />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="text-sm font-extrabold uppercase tracking-wide text-emerald-700">Monthly Sales for {selectedYear}</h2><p className="mt-1 text-xs text-slate-500">Ledger debits and credits by calendar month.</p></div>
              <div className="text-right text-xs text-slate-500"><p>{monthLabel} sales <strong className="text-slate-800">{formatCurrencyLocal(selectedMonthSales)}</strong></p><p>{monthLabel} collections <strong className="text-slate-800">{formatCurrencyLocal(selectedMonthCollections)}</strong></p></div>
            </div>
            <div className="mt-4 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <LineChart data={monthlyChartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" opacity={0.7} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#64748b" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#64748b" tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
                  <Tooltip formatter={(value: any) => formatCurrencyLocal(Number(value))} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <Legend />
                  <Line type="monotone" dataKey="sales" name="Total Sales" stroke="#16a34a" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="collections" name="Collections" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-600 sm:grid-cols-3 lg:grid-cols-4">
              {monthlyChartData.map((row) => <div key={row.month} className="flex justify-between gap-2"><span>{MONTH_NAMES[row.month - 1]}</span><strong className="text-slate-800">{formatCurrencyLocal(row.sales)}</strong></div>)}
            </div>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-blue-700">Top 10 Customers of the Month ({monthLabel})</h2>
            <div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead className="border-b border-slate-200 text-left text-[11px] uppercase text-slate-500"><tr><th className="px-2 py-2">#</th><th className="px-2 py-2">Customer Name</th><th className="px-2 py-2 text-right">Amount</th></tr></thead><tbody>{dashboard.topCustomers.length ? dashboard.topCustomers.map((row, index) => <tr key={`${row.customerName}-${index}`} className="border-b border-slate-100"><td className="px-2 py-2 text-slate-500">{index + 1}</td><td className="px-2 py-2 font-semibold">{row.customerName}</td><td className="px-2 py-2 text-right font-bold">{formatCurrencyLocal(row.amount)}</td></tr>) : <EmptyTable columns={3} />}</tbody></table></div>
          </article>
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.9fr_1.2fr_1.2fr]">
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-emerald-700">Top Salesperson of the Month ({monthLabel})</h2>
            <div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead className="border-b border-slate-200 text-left text-[11px] uppercase text-slate-500"><tr><th className="px-2 py-2">Salesperson</th><th className="px-2 py-2 text-right">Amount</th></tr></thead><tbody>{dashboard.topSalespeople.length ? dashboard.topSalespeople.map((row, index) => <tr key={`${row.salesperson}-${index}`} className="border-b border-slate-100"><td className="px-2 py-2 font-semibold">{index === 0 && <TrendingUp className="mr-1 inline h-3.5 w-3.5 text-emerald-600" />}{row.salesperson}</td><td className="px-2 py-2 text-right font-bold">{formatCurrencyLocal(row.amount)}</td></tr>) : <EmptyTable columns={2} />}</tbody></table></div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 text-sm font-bold"><span>Total Sales</span><span className="text-emerald-700">{formatCurrencyLocal(dashboard.topSalespeople.reduce((sum, row) => sum + row.amount, 0))}</span></div>
          </article>

          <PerformanceItemsTable title="List of Best Performance Part Number" subtitle={`YTD / MTD (${monthLabel})`} rows={dashboard.bestItems} tone="emerald" />
          <PerformanceItemsTable title="List of Worst Performance Part Number" subtitle={`YTD / MTD (${monthLabel})`} rows={dashboard.worstItems} tone="rose" />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-700">Salesperson Details</h2><p className="mt-1 text-xs text-slate-500">Double-click a customer in the dashboard's call-monitoring view for account details.</p></div><span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600"><UserRound className="h-3.5 w-3.5" /> Master User only</span></div>
        </section>
      </div>
    </div>
  );
};

const PerformanceItemsTable = ({ title, subtitle, rows, tone }: { title: string; subtitle: string; rows: ManagementDashboardData['bestItems']; tone: 'emerald' | 'rose' }) => {
  const headingClass = tone === 'emerald' ? 'text-emerald-700' : 'text-rose-700';
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className={`text-sm font-extrabold uppercase tracking-wide ${headingClass}`}>{title}</h2>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[420px] text-xs"><thead className="border-b border-slate-200 text-left text-[10px] uppercase text-slate-500"><tr><th className="px-2 py-2">#</th><th className="px-2 py-2">Item Code</th><th className="px-2 py-2">Part No.</th><th className="px-2 py-2">Description</th><th className="px-2 py-2 text-right">Qty (YTD)</th><th className="px-2 py-2 text-right">Qty (MTD)</th></tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={`${row.itemCode}-${row.partNo}-${index}`} className="border-b border-slate-100"><td className="px-2 py-2 text-slate-500">{index + 1}</td><td className="px-2 py-2 font-semibold">{row.itemCode}</td><td className="px-2 py-2">{row.partNo}</td><td className="max-w-[150px] truncate px-2 py-2" title={row.description}>{row.description}</td><td className="px-2 py-2 text-right font-bold">{formatNumber(row.qtyYtd)}</td><td className="px-2 py-2 text-right font-semibold">{formatNumber(row.qtyMtd)}</td></tr>) : <EmptyTable columns={6} />}</tbody></table></div>
      <p className="mt-2 text-[10px] text-slate-500">Based on quantity sold from approved, posted, and non-cancelled sales documents.</p>
    </article>
  );
};

export default ManagementView;
