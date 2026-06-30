import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Bot,
  CheckCircle2,
  ClipboardList,
  Crown,
  FileSearch,
  Headphones,
  Info,
  Loader2,
  MessageSquare,
  PackageCheck,
  Phone,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Star,
  Truck,
  UserRoundCheck,
  Users,
  Wrench,
  X,
  XCircle,
} from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import { fetchCustomersForDailyCall, fetchDailyCallMasterList } from '../services/dailyCallMonitoringService';
import { createContact, updateContact } from '../services/customerDatabaseLocalApiService';
import { Contact, DailyCallCustomerRow, DailyCallMasterCustomerRow, DailyCallMasterListMeta } from '../types';
import DashboardViewportFit from './DashboardViewportFit';
import AddContactModal from './AddContactModal';
import DailyCallCustomerDetailModal from './DailyCallCustomerDetailModal';
import type { DetailTabId } from './DailyCallCustomerDetailExpansion';

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
    note: 'Any ledger activity since October 2025 onwards',
    state: 'Active Buyers',
    accent: 'text-emerald-700',
    iconBg: 'bg-emerald-600',
    border: 'border-emerald-200',
    softBg: 'bg-emerald-50/60',
    dot: 'bg-emerald-500',
    matches: (row) => row.purchaseCount > 0,
  },
  {
    id: 'recovery',
    label: 'Recovery List',
    note: 'Over 1 month since last purchase',
    state: 'Recovery',
    accent: 'text-rose-700',
    iconBg: 'bg-rose-600',
    border: 'border-rose-200',
    softBg: 'bg-rose-50/60',
    dot: 'bg-rose-500',
    matches: (row) => row.purchaseAgeGroup === 'over_one_month',
  },
  {
    id: 'verified',
    label: 'Verified Prospects',
    note: 'Verified, awaiting first purchase',
    state: 'Verified',
    accent: 'text-blue-700',
    iconBg: 'bg-blue-600',
    border: 'border-blue-200',
    softBg: 'bg-blue-50/60',
    dot: 'bg-blue-500',
    matches: (row) => row.purchaseAgeGroup === 'no_purchase' && isProspectRow(row) && row.verification === 'Verified',
  },
  {
    id: 'unverified',
    label: 'Unverified Prospects',
    note: 'No purchases yet',
    state: 'Need Verification',
    accent: 'text-orange-600',
    iconBg: 'bg-orange-500',
    border: 'border-orange-200',
    softBg: 'bg-orange-50/60',
    dot: 'bg-orange-400',
    matches: (row) => row.purchaseAgeGroup === 'no_purchase' && isProspectRow(row) && row.verification !== 'Verified',
  },
];

const isProspectRow = (row: DailyCallMasterCustomerRow) => {
  const profileType = String(row.profileType || '').trim().toLowerCase();
  return profileType.includes('prospect');
};

const sumBy = (rows: DailyCallMasterCustomerRow[], field: 'totalSales' | 'currentMonthSales' | 'purchaseCount') =>
  rows.reduce((sum, row) => sum + row[field], 0);

const ageLabel = (row: DailyCallMasterCustomerRow) => {
  if (!row.lastPurchaseDateRaw || row.purchaseCount === 0) return 'No purchase yet';
  return row.daysSinceLastPurchase === 1 ? '1 day ago' : `${row.daysSinceLastPurchase} days ago`;
};

const caseOverviewItems = [
  { label: 'Inquiry & Orders', Icon: Users, open: 12, pending: 6, tone: 'text-blue-700 border-blue-200 bg-blue-50' },
  { label: 'Delivery Issues', Icon: Truck, open: 3, pending: 1, tone: 'text-orange-600 border-orange-200 bg-orange-50' },
  { label: 'Quality Issues', Icon: Wrench, open: 5, pending: 2, tone: 'text-rose-600 border-rose-200 bg-rose-50' },
  { label: 'Incident Reports', Icon: ShieldAlert, open: 4, pending: 2, tone: 'text-violet-700 border-violet-200 bg-violet-50' },
  { label: 'Sales Returns', Icon: RotateCcw, open: 3, pending: 2, tone: 'text-emerald-700 border-emerald-200 bg-emerald-50' },
] as const;

type CaseOverviewItem = typeof caseOverviewItems[number];

const masterRowFallback = (row: DailyCallMasterCustomerRow): DailyCallCustomerRow => ({
  id: row.id,
  source: 'Master List',
  assignedTo: row.assignedTo,
  clientSince: '—',
  province: row.province,
  city: row.city,
  shopName: row.shopName,
  contactNumber: row.contactNumber,
  codeDate: '—',
  ishinomotoDealerSince: '—',
  ishinomotoSignageSince: '—',
  quota: 0,
  modeOfPayment: '—',
  courier: [row.city, row.province].filter((value) => value && value !== '—').join(', ') || '—',
  status: (row.purchaseAgeGroup === 'no_purchase' ? 'Prospective' : row.purchaseAgeGroup === 'over_one_month' ? 'Inactive' : 'Active') as DailyCallCustomerRow['status'],
  statusDate: row.lastPurchaseDate,
  outstandingBalance: 0,
  averageMonthlyOrder: row.purchaseCount ? row.totalSales / row.purchaseCount : 0,
  monthlyOrder: row.currentMonthSales,
  weeklyRangeTotals: [],
  dailyActivity: [],
});

const vipDetails = (row: DailyCallMasterCustomerRow) => {
  const group = String(row.priceGroup || '').trim().toLowerCase();
  if (group === 'vip2') {
    return {
      label: 'VIP Gold',
      sublabel: '(10% Discount)',
      Icon: Crown,
      className: 'border-amber-200 bg-amber-50 text-amber-700',
    };
  }
  if (group === 'vip1') {
    return {
      label: 'VIP Silver',
      sublabel: '(10% Discount)',
      Icon: Star,
      className: 'border-slate-200 bg-slate-50 text-slate-600',
    };
  }
  return {
    label: 'Regular',
    sublabel: '(No Discount)',
    Icon: null,
    className: 'border-slate-200 bg-white text-slate-600',
  };
};

const trendDetails = (row: DailyCallMasterCustomerRow) => {
  const trend = row.salesTrendPercent || 0;
  if (Math.abs(trend) < 1) {
    return { Icon: ArrowRight, label: 'Stable', className: 'text-orange-500' };
  }
  if (trend > 0) {
    return { Icon: ArrowUp, label: `${Math.round(Math.abs(trend))}% vs last 3 months`, className: 'text-emerald-600' };
  }
  return { Icon: ArrowDown, label: `${Math.round(Math.abs(trend))}% vs last 3 months`, className: 'text-rose-600' };
};

const DailyCallMasterListView: React.FC = () => {
  const [rows, setRows] = useState<DailyCallMasterCustomerRow[]>([]);
  const [meta, setMeta] = useState<DailyCallMasterListMeta>({ fromDate, toDate: '', count: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const categoryTableRefs = useRef<Partial<Record<CategoryId, HTMLElement>>>({});
  const fullCustomerRowsRef = useRef<DailyCallCustomerRow[] | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<DailyCallCustomerRow | null>(null);
  const [showAddVerifiedProspectModal, setShowAddVerifiedProspectModal] = useState(false);
  const [detailInitialTab, setDetailInitialTab] = useState<DetailTabId>('overview');
  const [loadingCustomerId, setLoadingCustomerId] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<CaseOverviewItem | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<CategoryId>('priority');
  const debouncedSearch = useDebounce(search, 400);

  const scrollTo = useCallback((target: HTMLElement | null | undefined) => {
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target.focus({ preventScroll: true });
  }, []);

  const openCustomerDetails = useCallback(async (row: DailyCallMasterCustomerRow, initialTab: DetailTabId = 'overview') => {
    setLoadingCustomerId(row.id);
    setDetailInitialTab(initialTab);
    try {
      if (!fullCustomerRowsRef.current) {
        fullCustomerRowsRef.current = await fetchCustomersForDailyCall({});
      }
      setSelectedCustomer(
        fullCustomerRowsRef.current.find((customer) => customer.id === row.id) || masterRowFallback(row)
      );
    } finally {
      setLoadingCustomerId(null);
    }
  }, []);

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

  const handleSubmitVerifiedProspect = useCallback(async (data: Omit<Contact, 'id'>) => {
    const created = await createContact({
      ...data,
      verification: 'Verified',
    });
    await loadRows(false);
    setShowAddVerifiedProspectModal(false);
    return created;
  }, [loadRows]);

  const handleVerifyExistingProspect = useCallback(async (row: DailyCallMasterCustomerRow) => {
    await updateContact(row.id, { verification: 'Verified' });
    setRows((prev) => prev.map((item) =>
      item.id === row.id ? { ...item, verification: 'Verified' } : item
    ));
    await loadRows(false);
  }, [loadRows]);

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

  const activeCategory = categoryData.find((category) => category.id === activeCategoryId) || categoryData[0];
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
    <div
      ref={dashboardRef}
      tabIndex={-1}
      className="min-w-[1180px] space-y-4 bg-white text-[#0f1f46] outline-none"
      data-testid="master-list-dashboard"
    >
      <AddContactModal
        isOpen={showAddVerifiedProspectModal}
        onClose={() => setShowAddVerifiedProspectModal(false)}
        onSubmit={handleSubmitVerifiedProspect}
        mode="create"
        defaultVerification="Verified"
        title="Add Verified Prospect"
        submitLabel="Save Verified Prospect"
      />
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
        <button
          type="button"
          onClick={() => setShowAddVerifiedProspectModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700"
        >
          <UserRoundCheck className="h-4 w-4" /> Verified Prospect
        </button>
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

      <nav className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm" aria-label="Quick Go To">
        <strong className="block text-xs font-bold uppercase text-slate-500">Quick Go To:</strong>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {categoryData.map((category) => {
            const isActive = category.id === activeCategory.id;
            return (
              <button
                key={category.id}
                type="button"
                aria-label={`${category.label} (${category.rows.length})`}
                aria-pressed={isActive}
                onClick={() => setActiveCategoryId(category.id)}
                className={`inline-flex h-11 items-center gap-3 rounded-lg border px-5 text-base font-bold transition ${
                  isActive
                    ? `${category.border} ${category.softBg} ${category.accent} shadow-sm ring-2 ring-blue-100`
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>{category.label}</span>
                <span className={`rounded-full px-3 py-1 text-sm text-white ${isActive ? category.iconBg : 'bg-slate-500'}`}>
                  {category.rows.length}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            aria-label={`All Customers (${meta.count || rows.length})`}
            onClick={() => scrollTo(dashboardRef.current)}
            className="inline-flex h-11 items-center gap-3 rounded-lg border border-slate-200 bg-white px-5 text-base font-bold text-slate-800 transition hover:bg-slate-50"
          >
            <span>All Customers</span>
            <span className="rounded-full bg-slate-500 px-3 py-1 text-sm text-white">{meta.count || rows.length}</span>
          </button>
        </div>
      </nav>

      <section aria-label="Customer category table">
        {activeCategory && (
          <article
            key={activeCategory.id}
            ref={(element) => {
              if (element) categoryTableRefs.current[activeCategory.id] = element;
            }}
            tabIndex={-1}
            data-testid={`category-table-${activeCategory.id}`}
            className="flex min-h-[560px] scroll-mt-4 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <h3 className={`text-2xl font-bold uppercase ${activeCategory.accent}`}>
                {activeCategory.label} <span className="ml-2 text-base normal-case">({activeCategory.note})</span>
              </h3>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-2 text-sm"><i className={`h-3 w-3 rounded-full ${activeCategory.dot}`} />{activeCategory.state}</span>
                <button type="button" onClick={() => loadRows(false)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold hover:bg-slate-50">
                  <RefreshCw className="h-4 w-4" /> Refresh
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-x-auto">
              <table className="w-full table-fixed text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-600">
                  <tr>
                    <th className="w-16 px-5 py-4">#</th>
                    <th className="w-80 px-3 py-4">Customer / Mobile</th>
                    <th className="w-48 px-3 py-4 text-center">VIP Status</th>
                    <th className="w-64 px-3 py-4">
                      <span className="inline-flex items-center gap-2">
                        Avg. Purchase per Month (Ledger)
                        <Info className="h-4 w-4 text-slate-400" />
                      </span>
                    </th>
                    <th className="w-48 px-3 py-4 text-center">
                      <span className="inline-flex items-center justify-center gap-2">
                        Sales (Current Month)
                        <Info className="h-4 w-4 text-slate-400" />
                      </span>
                    </th>
                    <th className="w-44 px-3 py-4">Last Purchase</th>
                    <th className="w-44 px-3 py-4">Agent</th>
                    <th className="w-36 px-3 py-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activeCategory.rows.slice(0, 10).map((row, index) => {
                    const vip = vipDetails(row);
                    const trend = trendDetails(row);
                    const VipIcon = vip.Icon;
                    const TrendIcon = trend.Icon;
                    return (
                      <tr key={row.id} className="border-t border-slate-100 align-top">
                        <td className="px-5 py-4 font-bold">{index + 1}</td>
                        <td className="px-3 py-4">
                          <button
                            type="button"
                            onClick={() => openCustomerDetails(row)}
                            disabled={loadingCustomerId === row.id}
                            aria-label={`View details for ${row.shopName}`}
                            className="line-clamp-2 text-left font-bold leading-tight text-blue-950 underline-offset-2 hover:text-blue-700 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-60"
                          >
                            {loadingCustomerId === row.id && <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />}
                            {row.shopName}
                          </button>
                          <p className="mt-1 truncate text-sm text-blue-700">{row.contactNumber}</p>
                        </td>
                        <td className="px-3 py-4 text-center">
                          <div className={`mx-auto inline-flex min-w-28 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold uppercase ${vip.className}`}>
                            {VipIcon && <VipIcon className="h-4 w-4" />}
                            {vip.label}
                          </div>
                          <p className="mt-2 text-xs text-slate-500">{vip.sublabel}</p>
                        </td>
                        <td className="px-3 py-4">
                          <p className="text-lg font-bold text-blue-950">{peso.format(row.averageMonthlySales)} <span className="text-sm font-medium text-slate-500">/ month</span></p>
                          <p className="mt-1 text-sm text-slate-500">(Based on {row.averageMonthlySalesMonthCount} months)</p>
                          <p className={`mt-1 inline-flex items-center gap-1 text-sm font-bold ${trend.className}`}>
                            <TrendIcon className="h-4 w-4 fill-current" />
                            {trend.label}
                          </p>
                        </td>
                        <td className="px-3 py-4 text-center text-lg font-bold text-emerald-700">{peso.format(row.currentMonthSales)}</td>
                        <td className="px-3 py-4">
                          <p className="font-medium">{row.lastPurchaseDate}</p>
                          <p className="mt-1 text-xs text-slate-500">{ageLabel(row)}</p>
                        </td>
                        <td className="break-words px-3 py-4 font-bold">{row.assignedTo}</td>
                        <td className="px-3 py-4">
                          <div className="flex justify-center gap-3">
                            {activeCategory.id === 'unverified' && (
                              <button
                                type="button"
                                aria-label={`Approve verification for ${row.shopName}`}
                                title={`Approve ${row.shopName} into Verified Prospects`}
                                onClick={() => handleVerifyExistingProspect(row)}
                                disabled={loadingCustomerId === row.id}
                                className="rounded-full border border-blue-200 p-2 text-blue-600 transition hover:bg-blue-50 disabled:opacity-60"
                              >
                                <UserRoundCheck className="h-5 w-5" />
                              </button>
                            )}
                            <button
                              type="button"
                              aria-label={`Call ${row.shopName}`}
                              title={`Open call details for ${row.shopName}`}
                              onClick={() => openCustomerDetails(row, 'overview')}
                              disabled={loadingCustomerId === row.id}
                              className="rounded-full border border-emerald-200 p-2 text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-60"
                            >
                              <Phone className="h-5 w-5" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Message ${row.shopName}`}
                              title={`Open communication history for ${row.shopName}`}
                              onClick={() => openCustomerDetails(row, 'communication')}
                              disabled={loadingCustomerId === row.id}
                              className="rounded-full border border-blue-200 p-2 text-blue-600 transition hover:bg-blue-50 disabled:opacity-60"
                            >
                              <MessageSquare className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {activeCategory.rows.length === 0 && (
                    <tr><td colSpan={8} className="px-3 py-12 text-center text-xs text-slate-400">No customers in this category.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-sm">
              <span>Showing 1 to {Math.min(10, activeCategory.rows.length)} of {activeCategory.rows.length} entries</span>
              <button type="button" className={`font-bold ${activeCategory.accent}`}>View all {activeCategory.rows.length} customers ›</button>
            </div>
          </article>
        )}
      </section>

      <section className="grid grid-cols-[1.25fr_1.3fr_0.6fr] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-r border-slate-200 p-4">
          <h3 className="text-sm font-bold uppercase">Customer Case Overview <span className="text-xs font-normal normal-case">(This Month)</span></h3>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {caseOverviewItems.map((item) => (
              <div key={item.label} className={`rounded-lg border p-2 text-center ${item.tone}`}>
                <item.Icon className="mx-auto h-5 w-5" />
                <p className="mt-2 min-h-8 text-[9px] font-bold uppercase">{item.label}</p>
                <div className="mt-2 flex justify-around text-[9px]"><span>Open<br/><b className="text-base">{item.open}</b></span><span>Pending<br/><b className="text-base">{item.pending}</b></span></div>
                <button
                  type="button"
                  aria-label={`View ${item.label} details`}
                  onClick={() => setSelectedCase(item)}
                  className="mt-2 text-[9px] font-bold text-blue-700 hover:underline"
                >
                  View Details
                </button>
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

      <footer className="flex items-center justify-between px-2 pb-2 text-[10px] text-slate-500">
        <span>© 2026 TND-OPC. All rights reserved.</span><span>Version 1.0.0</span>
      </footer>

      <DailyCallCustomerDetailModal
        isOpen={Boolean(selectedCustomer)}
        customer={selectedCustomer}
        currentUser={null}
        initialTab={detailInitialTab}
        onClose={() => setSelectedCustomer(null)}
      />

      {selectedCase && createPortal((
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm" onClick={() => setSelectedCase(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedCase.label} Details`}
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 text-[#0f1f46] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Customer Case Overview</p>
                <h2 className="mt-1 text-xl font-bold">{selectedCase.label} Details</h2>
              </div>
              <button type="button" aria-label="Close case details" onClick={() => setSelectedCase(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-xs font-bold uppercase text-blue-700">Open</p>
                <p className="mt-1 text-3xl font-bold text-blue-950">{selectedCase.open}</p>
                <p className="mt-1 text-sm text-slate-600">{selectedCase.open} open cases</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-bold uppercase text-amber-700">Pending</p>
                <p className="mt-1 text-3xl font-bold text-amber-950">{selectedCase.pending}</p>
                <p className="mt-1 text-sm text-slate-600">{selectedCase.pending} pending cases</p>
              </div>
            </div>
            <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              This summary covers the current month. Open and pending records are grouped under {selectedCase.label.toLowerCase()}.
            </p>
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={() => setSelectedCase(null)} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800">Close</button>
            </div>
          </section>
        </div>
      ), document.body)}
    </div>
    </DashboardViewportFit>
  );
};

export default DailyCallMasterListView;
