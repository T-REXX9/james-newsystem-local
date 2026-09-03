import { CUSTOMER_UPDATED_EVENT } from '../utils/customerWorkflowEvents';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ClipboardList,
  Crown,
  Info,
  Loader2,
  Phone,
  RefreshCw,
  Search,
  Star,
  UserRoundCheck,
  Users,
  XCircle,
} from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import { fetchCustomersForDailyCall, fetchDailyCallMasterList, getCachedDailyCallMasterList } from '../services/dailyCallMonitoringService';
import { createContact, fetchSalesAgents, updateContact } from '../services/customerDatabaseLocalApiService';
import { getVipTierConfig } from '../services/vipTierSettingsService';
import { Contact, CustomerStatus, DailyCallCustomerRow, DailyCallMasterCustomerRow, DailyCallMasterListMeta, UserProfile, VipTierConfig } from '../types';
import { DEFAULT_VIP_TIER_CONFIG } from '../utils/vipTierConfig';
import { resolveVipDiscountLevel } from '../utils/vipStanding';
import AddContactModal from './AddContactModal';
import DailyCallCustomerDetailModal from './DailyCallCustomerDetailModal';
import DailyCallInlineAgentSelect, { formatAssignmentDateLabel } from './DailyCallInlineAgentSelect';
import { useToast } from './ToastProvider';
import type { DetailTabId } from './DailyCallCustomerDetailExpansion';

const fromDate = '2025-10-01';
const INITIAL_VISIBLE_ROWS = 30;
const VISIBLE_ROWS_STEP = 30;

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

type CategoryId = 'priority' | 'recovery' | 'verified' | 'unverified' | 'all';

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
    matches: (row) => row.listCategory ? row.listCategory === 'priority' : row.purchaseCount > 0,
  },
  {
    id: 'recovery',
    label: 'Recovery List',
    note: 'Ledger history before October 2025, with no activity since',
    state: 'Recovery',
    accent: 'text-rose-700',
    iconBg: 'bg-rose-600',
    border: 'border-rose-200',
    softBg: 'bg-rose-50/60',
    dot: 'bg-rose-500',
    matches: (row) => row.listCategory ? row.listCategory === 'recovery' : row.purchaseAgeGroup === 'over_one_month',
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
  {
    id: 'all',
    label: 'All Customers',
    note: 'Complete master list',
    state: 'All Customers',
    accent: 'text-slate-800',
    iconBg: 'bg-slate-600',
    border: 'border-slate-200',
    softBg: 'bg-slate-50',
    dot: 'bg-slate-500',
    matches: () => true,
  },
];

const isProspectRow = (row: DailyCallMasterCustomerRow) => {
  const profileType = String(row.profileType || '').trim().toLowerCase();
  return profileType.includes('prospect');
};

const sumBy = (rows: DailyCallMasterCustomerRow[], field: 'totalSales' | 'currentMonthSales' | 'purchaseCount') =>
  rows.reduce((sum, row) => sum + row[field], 0);

const ageLabel = (row: DailyCallMasterCustomerRow) => {
  if (!row.lastPurchaseDateRaw || (row.ledgerTransactionCount ?? row.purchaseCount) === 0) return 'No purchase yet';
  return row.daysSinceLastPurchase === 1 ? '1 day ago' : `${row.daysSinceLastPurchase} days ago`;
};

const purchaseHighlight = (row: DailyCallMasterCustomerRow) => {
  const blocked = Number(row.customerStatus) === 4 || String(row.debtType || '').toLowerCase() === 'bad';
  if (blocked) {
    return {
      color: 'red',
      row: 'bg-[#f94449]/20 text-red-950 backdrop-blur-sm hover:bg-[#f94449]/30',
      muted: 'text-red-800',
      label: 'blacklisted/rejected -do not contact',
    };
  }

  const rawDate = String(row.lastPurchaseDateRaw || '').trim();
  const lastPurchase = rawDate ? new Date(`${rawDate.slice(0, 10)}T00:00:00`) : null;
  const monthsSincePurchase = lastPurchase && !Number.isNaN(lastPurchase.getTime())
    ? ((new Date().getFullYear() - lastPurchase.getFullYear()) * 12) + (new Date().getMonth() - lastPurchase.getMonth())
    : row.monthsSinceLastPurchase;

  if (row.currentMonthSales > 0 || monthsSincePurchase <= 0) {
    return { color: 'green', row: 'bg-green-100 hover:bg-green-200', muted: 'text-green-800', label: 'Bought this month' };
  }
  if (!rawDate || row.purchaseAgeGroup === 'no_purchase' || monthsSincePurchase >= 3) {
    return { color: 'white', row: 'bg-white hover:bg-slate-50', muted: 'text-slate-500', label: 'No purchase for 3+ months' };
  }
  if (monthsSincePurchase === 2) {
    return { color: 'purple', row: 'bg-purple-100 hover:bg-purple-200', muted: 'text-purple-800', label: 'No purchase for 2 months' };
  }
  return { color: 'yellow', row: 'bg-yellow-100 hover:bg-yellow-200', muted: 'text-yellow-800', label: 'No purchase for 1 month' };
};

const masterRowFallback = (row: DailyCallMasterCustomerRow): DailyCallCustomerRow => ({
  id: row.id,
  source: 'Master List',
  assignedTo: row.assignedTo,
  assignedDate: row.assignedDate,
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
  lastMonthOrder: row.lastMonthSales || 0,
  weeklyRangeTotals: [],
  dailyActivity: [],
});

const vipDetails = (row: DailyCallMasterCustomerRow, config: VipTierConfig) => {
  const level = resolveVipDiscountLevel(row.lastMonthSales || 0, config);
  if (level === 'gold') {
    return {
      label: 'VIP Gold',
      sublabel: `(${config.discount_percentage}% Unlimited)`,
      Icon: Crown,
      className: 'border-amber-200 bg-amber-50 text-amber-700',
    };
  }
  if (level === 'silver') {
    return {
      label: 'VIP Silver',
      sublabel: `(${config.discount_percentage}% One-Time)`,
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

interface DailyCallMasterListViewProps {
  currentUser?: UserProfile | null;
}

const DailyCallMasterListView: React.FC<DailyCallMasterListViewProps> = ({ currentUser }) => {
  const { addToast } = useToast();
  const initialCachedResult = useMemo(() => getCachedDailyCallMasterList({ fromDate }), []);
  const [rows, setRows] = useState<DailyCallMasterCustomerRow[]>(() => initialCachedResult?.items || []);
  const [meta, setMeta] = useState<DailyCallMasterListMeta>(() => initialCachedResult?.meta || { fromDate, toDate: '', count: 0 });
  const rowsRef = useRef<DailyCallMasterCustomerRow[]>(initialCachedResult?.items || []);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(!initialCachedResult);
  const [error, setError] = useState<string | null>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const fullCustomerRowsRef = useRef<DailyCallCustomerRow[] | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<DailyCallCustomerRow | null>(null);
  const [showAddProspectModal, setShowAddProspectModal] = useState(false);
  const [detailInitialTab, setDetailInitialTab] = useState<DetailTabId>('overview');
  const [loadingCustomerId, setLoadingCustomerId] = useState<string | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<CategoryId>('priority');
  const [visibleLimit, setVisibleLimit] = useState(INITIAL_VISIBLE_ROWS);
  const [currentVipFilter, setCurrentVipFilter] = useState('all');
  const [nextVipFilter, setNextVipFilter] = useState('all');
  const [lastPurchaseFilter, setLastPurchaseFilter] = useState('all');
  const [colorFilter, setColorFilter] = useState('all');
  const [vipConfig, setVipConfig] = useState<VipTierConfig>(DEFAULT_VIP_TIER_CONFIG);
  const [salesAgents, setSalesAgents] = useState<UserProfile[]>([]);
  const [loadingSalesAgents, setLoadingSalesAgents] = useState(true);
  const [assigningCustomerId, setAssigningCustomerId] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search, 400);

  const handleSelectCategory = useCallback((categoryId: CategoryId) => {
    setActiveCategoryId(categoryId);
    setVisibleLimit(INITIAL_VISIBLE_ROWS);
  }, []);

  const openCustomerDetails = useCallback(async (row: DailyCallMasterCustomerRow, initialTab: DetailTabId = 'overview') => {
    setLoadingCustomerId(row.id);
    setDetailInitialTab(initialTab);
    try {
      if (!fullCustomerRowsRef.current) {
        fullCustomerRowsRef.current = await fetchCustomersForDailyCall({});
      }
      const detailRow =
        fullCustomerRowsRef.current.find((customer) => customer.id === row.id) || masterRowFallback(row);
      setSelectedCustomer(detailRow);
    } finally {
      setLoadingCustomerId(null);
    }
  }, []);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const loadRows = useCallback(async (withLoading = true, forceRefresh = false) => {
    if (withLoading && (forceRefresh || rowsRef.current.length === 0)) setLoading(true);
    setError(null);
    try {
      const result = await fetchDailyCallMasterList({ fromDate, search: debouncedSearch, forceRefresh });
      setRows(result.items);
      setMeta(result.meta);
    } catch {
      setError('Unable to load master list.');
    } finally {
      if (withLoading) setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    let active = true;
    const refreshCustomer = (event: Event) => {
      const contactId = (event as CustomEvent<{ contactId: string }>).detail.contactId;
      fullCustomerRowsRef.current = null;
      void loadRows(false, true);
      if (selectedCustomer?.id === contactId) {
        void fetchCustomersForDailyCall({}).then(customers => {
          if (!active) return;
          fullCustomerRowsRef.current = customers;
          setSelectedCustomer(current => current?.id === contactId ? customers.find(row => row.id === contactId) || current : current);
        }).catch(() => setError('The request was saved, but customer details could not be refreshed.'));
      }
    };
    window.addEventListener(CUSTOMER_UPDATED_EVENT, refreshCustomer);
    return () => { active = false; window.removeEventListener(CUSTOMER_UPDATED_EVENT, refreshCustomer); };
  }, [loadRows, selectedCustomer?.id]);

  const handleSubmitProspect = useCallback(async (data: Omit<Contact, 'id'>) => {
    const created = await createContact({
      ...data,
      status: CustomerStatus.PROSPECTIVE,
      verification: 'Unverified',
    });
    await loadRows(false, true);
    setShowAddProspectModal(false);
    return created;
  }, [loadRows]);

  const handleVerifyExistingProspect = useCallback(async (row: DailyCallMasterCustomerRow) => {
    await updateContact(row.id, { verification: 'Verified' });
    setRows((prev) => prev.map((item) =>
      item.id === row.id ? { ...item, verification: 'Verified' } : item
    ));
    await loadRows(false, true);
  }, [loadRows]);

  const handleRejectExistingProspect = useCallback(async (row: DailyCallMasterCustomerRow) => {
    await updateContact(row.id, {
      status: CustomerStatus.BLACKLISTED,
      debtType: 'Bad',
      verification: 'Rejected',
    });
    setRows((prev) => prev.filter((item) => item.id !== row.id));
    await loadRows(false, true);
  }, [loadRows]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    void getVipTierConfig().then(setVipConfig);
  }, []);

  useEffect(() => {
    let active = true;
    setLoadingSalesAgents(true);
    void fetchSalesAgents()
      .then((agents) => {
        if (active) setSalesAgents(agents);
      })
      .catch(() => {
        if (active) {
          addToast({
            type: 'error',
            title: 'Unable to load sales agents',
            description: 'Agent assignment dropdown may be unavailable until you refresh.',
          });
        }
      })
      .finally(() => {
        if (active) setLoadingSalesAgents(false);
      });

    return () => {
      active = false;
    };
  }, [addToast]);

  const handleAssignAgent = useCallback(async (customerId: string, agent: UserProfile | null) => {
    const previousRows = rowsRef.current;
    const assignedTo = agent?.full_name?.trim() || 'Unassigned';
    const assignedAgentId = agent?.id || '';
    const assignedDate = agent ? formatAssignmentDateLabel() : undefined;

    setAssigningCustomerId(customerId);
    setRows((prev) =>
      prev.map((row) =>
        row.id === customerId
          ? {
              ...row,
              assignedTo,
              assignedAgentId,
              assignedDate,
            }
          : row
      )
    );

    if (fullCustomerRowsRef.current) {
      fullCustomerRowsRef.current = fullCustomerRowsRef.current.map((row) =>
        row.id === customerId ? { ...row, assignedTo, assignedDate } : row
      );
    }

    try {
      await updateContact(
        customerId,
        {
          __salesPersonId: assignedAgentId,
          salesman: assignedTo === 'Unassigned' ? '' : assignedTo,
          assignedAgent: assignedTo === 'Unassigned' ? '' : assignedTo,
        },
        currentUser?.id
      );
      addToast({
        type: 'success',
        title: agent ? 'Agent assigned' : 'Agent cleared',
        description: agent
          ? `${assignedTo} is now assigned to this customer.`
          : 'This customer is now unassigned.',
      });
    } catch {
      setRows(previousRows);
      addToast({
        type: 'error',
        title: 'Unable to update agent',
        description: 'Please try again or assign from Customer Database.',
      });
    } finally {
      setAssigningCustomerId(null);
    }
  }, [addToast, currentUser?.id]);

  const getCurrentVip = (row: DailyCallMasterCustomerRow) => {
    return resolveVipDiscountLevel(row.lastMonthSales || 0, vipConfig);
  };

  const getNextVip = (row: DailyCallMasterCustomerRow) => {
    const current = getCurrentVip(row);
    return current === 'regular' ? 'silver' : current === 'silver' ? 'gold' : 'top';
  };

  const filteredRows = useMemo(() => rows.filter((row) => {
    if (currentVipFilter !== 'all' && getCurrentVip(row) !== currentVipFilter) return false;
    if (nextVipFilter !== 'all' && getNextVip(row) !== nextVipFilter) return false;
    if (lastPurchaseFilter === 'none' && row.purchaseAgeGroup !== 'no_purchase') return false;
    if (lastPurchaseFilter === '7' && (row.daysSinceLastPurchase < 0 || row.daysSinceLastPurchase > 7)) return false;
    if (lastPurchaseFilter === '30' && (row.daysSinceLastPurchase < 8 || row.daysSinceLastPurchase > 30)) return false;
    if (lastPurchaseFilter === 'older' && row.daysSinceLastPurchase <= 30) return false;
    if (colorFilter !== 'all' && purchaseHighlight(row).color !== colorFilter) return false;
    return true;
  }), [colorFilter, currentVipFilter, lastPurchaseFilter, nextVipFilter, rows, vipConfig]);

  const categoryData = useMemo(() => categories.map((category) => {
    const categoryRows = filteredRows.filter(category.matches);
    const currentSales = sumBy(categoryRows, 'currentMonthSales');
    const potentialSales = category.id === 'verified'
      ? categoryRows.length * 5_000
      : category.id === 'priority' || category.id === 'recovery'
        ? sumBy(categoryRows, 'averageMonthlySales')
        : 0;
    const averageSales = sumBy(categoryRows, 'averageMonthlySales');
    return { ...category, rows: categoryRows, currentSales, potentialSales, averageSales };
  }), [filteredRows]);
  const summaryCategoryData = categoryData.filter((category) => category.id !== 'all');
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const daysSinceMonday = (now.getDay() + 6) % 7;
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday).getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const unverifiedRows = categoryData.find((category) => category.id === 'unverified')?.rows || [];
  const unverifiedCreatedCounts = {
    today: unverifiedRows.filter((row) => row.createdAt && new Date(row.createdAt).getTime() >= startOfToday).length,
    week: unverifiedRows.filter((row) => row.createdAt && new Date(row.createdAt).getTime() >= startOfWeek).length,
    month: unverifiedRows.filter((row) => row.createdAt && new Date(row.createdAt).getTime() >= startOfMonth).length,
  };
  const totalPotentialSales = summaryCategoryData.reduce((sum, category) => sum + category.potentialSales, 0);

  const amountToNextVip = (row: DailyCallMasterCustomerRow) => {
    const current = getCurrentVip(row);
    if (current === 'gold') return 0;
    const threshold = current === 'silver'
      ? vipConfig.unlimited_discount_threshold
      : vipConfig.one_time_discount_threshold;
    return Math.max(0, threshold - (row.lastMonthSales || 0));
  };

  const activeCategory = categoryData.find((category) => category.id === activeCategoryId) || categoryData[0];
  const visibleRows = activeCategory.rows.slice(0, visibleLimit);
  const hasMoreRows = visibleRows.length < activeCategory.rows.length;

  useEffect(() => {
    setVisibleLimit(INITIAL_VISIBLE_ROWS);
  }, [activeCategoryId, colorFilter, currentVipFilter, debouncedSearch, lastPurchaseFilter, nextVipFilter]);

  const loadMoreRows = useCallback(() => {
    setVisibleLimit((currentLimit) => Math.min(activeCategory.rows.length, currentLimit + VISIBLE_ROWS_STEP));
  }, [activeCategory.rows.length]);

  const loadMoreOnScrollEnd = useCallback((container: HTMLElement) => {
    if (hasMoreRows && container.scrollTop + container.clientHeight >= container.scrollHeight - 160) {
      loadMoreRows();
    }
  }, [hasMoreRows, loadMoreRows]);

  const handleTableScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    loadMoreOnScrollEnd(event.currentTarget);
  }, [loadMoreOnScrollEnd]);

  const handleMasterListScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    loadMoreOnScrollEnd(event.currentTarget);
  }, [loadMoreOnScrollEnd]);

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
    <div
      className="h-full min-h-0 overflow-y-auto overflow-x-hidden"
      data-testid="master-list-scroll-region"
      onScroll={handleMasterListScroll}
    >
    <div
      ref={dashboardRef}
      tabIndex={-1}
      className="w-full min-w-0 space-y-3 bg-white text-[#0f1f46] outline-none"
      data-testid="master-list-dashboard"
    >
      <AddContactModal
        isOpen={showAddProspectModal}
        onClose={() => setShowAddProspectModal(false)}
        onSubmit={handleSubmitProspect}
        mode="create"
        defaultVerification="Unverified"
        title="Add Prospect"
        submitLabel="Save Prospect"
      />
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Management & Agent View</p>
          <h2 className="mt-1 flex items-center gap-2 text-2xl font-bold">
            <ClipboardList className="h-6 w-6 text-blue-700" /> Daily Call Monitoring Dashboard
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
          onClick={() => setShowAddProspectModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
        >
          <UserRoundCheck className="h-4 w-4" /> Add Prospect
        </button>
      </header>

      <section className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-4" aria-label="Monitoring filters">
        <label className="text-xs font-bold text-slate-600">Current VIP Status
          <select value={currentVipFilter} onChange={(event) => setCurrentVipFilter(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal">
            <option value="all">All current VIP levels</option><option value="regular">Regular</option><option value="silver">VIP Silver</option><option value="gold">VIP Gold</option>
          </select>
        </label>
        <label className="text-xs font-bold text-slate-600">Next VIP Status
          <select value={nextVipFilter} onChange={(event) => setNextVipFilter(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal">
            <option value="all">All next VIP levels</option><option value="silver">Next: VIP Silver</option><option value="gold">Next: VIP Gold</option><option value="top">Highest tier reached</option>
          </select>
        </label>
        <label className="text-xs font-bold text-slate-600">Last Purchase
          <select value={lastPurchaseFilter} onChange={(event) => setLastPurchaseFilter(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal">
            <option value="all">Any date</option><option value="7">Within 7 days</option><option value="30">8–30 days ago</option><option value="older">More than 30 days</option><option value="none">No purchase yet</option>
          </select>
        </label>
        <label className="text-xs font-bold text-slate-600">Color status
          <select value={colorFilter} onChange={(event) => setColorFilter(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal">
            <option value="all">All color statuses</option>
            <option value="green">Green — bought this month</option>
            <option value="yellow">Yellow — 1 month no purchase</option>
            <option value="purple">Purple — 2 months no purchase</option>
            <option value="white">White — 3+ months / no purchase</option>
            <option value="red">Red — blacklisted/rejected -do not contact</option>
          </select>
        </label>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-xs text-slate-600">
        <p data-testid="potential-sales-formula">
          Potential Sales = Priority average monthly sales + Recovery average monthly sales + ₱5,000 per verified prospect. Unverified prospects are excluded.
        </p>
        <p className="font-bold text-blue-900" data-testid="total-potential-sales">
          Total Potential Sales: {compactPeso.format(totalPotentialSales)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3 px-1 text-xs font-semibold text-slate-600" aria-label="Automatic purchase highlight legend">
        <span><i className="mr-1 inline-block h-3 w-3 rounded bg-green-500 align-middle" />Bought this month</span>
        <span><i className="mr-1 inline-block h-3 w-3 rounded bg-yellow-400 align-middle" />1 month no purchase</span>
        <span><i className="mr-1 inline-block h-3 w-3 rounded bg-purple-500 align-middle" />2 months no purchase</span>
        <span><i className="mr-1 inline-block h-3 w-3 rounded border border-slate-300 bg-white align-middle" />3+ months / no purchase</span>
        <span><i className="mr-1 inline-block h-3 w-3 rounded bg-[#f94449] align-middle" />blacklisted/rejected -do not contact</span>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{error}</span>
          <button type="button" onClick={() => loadRows()} className="flex items-center gap-1 font-bold">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      )}

      <section className="grid grid-cols-4 gap-3 2xl:gap-4" aria-label="Customer category summaries">
        {summaryCategoryData.map((category) => (
          <article key={category.id} className={`rounded-xl border ${category.border} ${category.softBg} p-3 shadow-sm 2xl:p-4`}>
            <h3 className={`text-sm font-bold uppercase ${category.accent}`}>
              {category.label} <span className="text-xs normal-case">({category.note})</span>
            </h3>
            <div className="mt-2 grid grid-cols-[2.75rem_1fr_1.2fr] items-center gap-3">
              <div className={`grid h-10 w-10 place-items-center rounded-full text-white ${category.iconBg}`}>
                <Users className="h-5 w-5" />
              </div>
              <div className="border-r border-slate-200 pr-3">
                <p className="text-xl font-bold">{category.rows.length}</p>
                <p className="text-xs">Customers</p>
              </div>
              <div className="space-y-2 text-right text-xs">
                <div>
                  <p>{category.id === 'priority' || category.id === 'recovery' ? 'Current Month Sales' : 'Average Monthly Purchase'}</p>
                  <p className={`text-base font-bold ${category.accent}`}>
                    {compactPeso.format(category.id === 'priority' || category.id === 'recovery' ? category.currentSales : category.averageSales)}
                  </p>
                </div>
                <div>
                  <p>{category.id === 'priority' || category.id === 'recovery' ? 'Average Monthly Sales' : 'Potential Sales'}</p>
                  <p className={`text-base font-bold ${category.accent}`}>{compactPeso.format(category.id === 'priority' || category.id === 'recovery' ? category.averageSales : category.potentialSales)}</p>
                </div>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-xs">
              <span>{category.id === 'priority' || category.id === 'recovery' ? 'Monthly Sales Potential' : 'Potential Sales'}</span>
              <strong className={`text-base ${category.accent}`}>
                {compactPeso.format(category.id === 'priority' || category.id === 'recovery' ? category.averageSales : category.potentialSales)}
              </strong>
            </div>
            {category.id === 'unverified' && (
              <p className="mt-2 border-t border-orange-200 pt-2 text-xs font-semibold text-orange-700">Found: {unverifiedCreatedCounts.today} today · {unverifiedCreatedCounts.week} this week · {unverifiedCreatedCounts.month} this month</p>
            )}
          </article>
        ))}
      </section>

      <nav className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm" aria-label="Quick Go To">
        <strong className="block text-xs font-bold uppercase text-slate-500">Quick Go To:</strong>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {categoryData.map((category) => {
            const isActive = category.id === activeCategory.id;
            return (
              <button
                key={category.id}
                type="button"
                aria-label={`${category.label} (${category.rows.length})`}
                aria-pressed={isActive}
                onClick={() => handleSelectCategory(category.id)}
                className={`inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-bold transition ${
                  isActive
                    ? `${category.border} ${category.softBg} ${category.accent} shadow-sm ring-2 ring-blue-100`
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>{category.label}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs text-white ${isActive ? category.iconBg : 'bg-slate-500'}`}>
                  {category.rows.length}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <section aria-label="Customer category table">
        {activeCategory && (
          <article
            key={activeCategory.id}
            tabIndex={-1}
            data-testid={`category-table-${activeCategory.id}`}
            className="flex min-h-[430px] scroll-mt-4 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500 2xl:min-h-[500px]"
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3">
              <h3 className={`text-xl font-bold uppercase ${activeCategory.accent}`}>
                {activeCategory.label} <span className="ml-2 text-sm normal-case">({activeCategory.note})</span>
              </h3>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-2 text-sm"><i className={`h-3 w-3 rounded-full ${activeCategory.dot}`} />{activeCategory.state}</span>
                <button type="button" onClick={() => loadRows(false, true)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-bold hover:bg-slate-50">
                  <RefreshCw className="h-4 w-4" /> Refresh
                </button>
              </div>
            </div>
            <div
              className="min-h-0 flex-1 overflow-auto"
              data-testid="daily-call-table-scroll"
              onScroll={handleTableScroll}
            >
              <table className="w-full table-fixed text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-600">
                  <tr>
                    <th className="w-12 px-3 py-2.5">#</th>
                    <th className="w-[250px] px-2 py-2.5">Customer / Mobile</th>
                    <th className="w-[135px] px-2 py-2.5 text-center">VIP Status</th>
                    <th className="w-[220px] px-2 py-2.5">
                      <span className="inline-flex items-center gap-2">
                        Avg. Purchase per Month (Ledger)
                        <Info className="h-4 w-4 text-slate-400" />
                      </span>
                    </th>
                    <th className="w-[150px] px-2 py-2.5 text-center">
                      <span className="inline-flex items-center justify-center gap-2">
                        Sales (Current Month)
                        <Info className="h-4 w-4 text-slate-400" />
                      </span>
                    </th>
                    <th className="w-[135px] px-2 py-2.5">Last Purchase</th>
                    <th className="w-[135px] px-2 py-2.5">Agent</th>
                    <th className="w-[150px] px-2 py-2.5">Verified By</th>
                    <th className="w-[105px] px-2 py-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row, index) => {
                    const highlight = purchaseHighlight(row);
                    const vip = vipDetails(row, vipConfig);
                    const trend = trendDetails(row);
                    const VipIcon = vip.Icon;
                    const TrendIcon = trend.Icon;
                    return (
                      <tr key={row.id} title={highlight.label} className={`border-t border-slate-100 align-top transition-colors ${highlight.row}`}>
                        <td className="px-3 py-2.5 text-sm font-bold">{index + 1}</td>
                        <td className="px-2 py-2.5">
                          <button
                            type="button"
                            onClick={() => openCustomerDetails(row)}
                            disabled={loadingCustomerId === row.id}
                            aria-label={`View details for ${row.shopName}`}
                            className="line-clamp-2 text-left text-sm font-bold leading-tight text-blue-950 underline-offset-2 hover:text-blue-700 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-60"
                          >
                            {loadingCustomerId === row.id && <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />}
                            {row.shopName}
                          </button>
                          <p className={`mt-0.5 truncate text-xs font-semibold ${highlight.muted}`}>{row.contactNumber}</p>
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <div className={`mx-auto inline-flex min-w-24 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[12px] font-bold uppercase ${vip.className}`}>
                            {VipIcon && <VipIcon className="h-3.5 w-3.5" />}
                            {vip.label}
                          </div>
                            <p className="mt-1 text-xs text-slate-500">{vip.sublabel}</p>
                          {(activeCategory.id === 'priority' || activeCategory.id === 'recovery') && (
                            <p className="mt-1 text-xs font-semibold text-blue-700">{amountToNextVip(row) > 0 ? `${peso.format(amountToNextVip(row))} to next VIP` : 'Highest VIP reached'}</p>
                          )}
                        </td>
                        <td className="px-2 py-2.5">
                          <p className="text-base font-bold text-blue-950">{peso.format(row.averageMonthlySales)} <span className="text-[12px] font-medium text-slate-500">/ month</span></p>
                          <p className="mt-0.5 text-[11px] text-slate-500">(Based on {row.averageMonthlySalesMonthCount} months{row.averageMonthlySalesYear ? ` in ${row.averageMonthlySalesYear}` : ''})</p>
                            <p className={`mt-0.5 inline-flex items-center gap-1 text-xs font-bold ${trend.className}`}>
                            <TrendIcon className="h-3.5 w-3.5 fill-current" />
                            {trend.label}
                          </p>
                        </td>
                        <td className="px-2 py-2.5 text-center text-base font-bold text-emerald-700">{peso.format(row.currentMonthSales)}</td>
                        <td className="px-2 py-2.5">
                          <p className="text-sm font-medium">{row.lastPurchaseDate}</p>
                          <p className="mt-0.5 text-[11px] text-slate-500">{ageLabel(row)}</p>
                        </td>
                        <td className="break-words px-2 py-2.5 text-sm">
                          <DailyCallInlineAgentSelect
                            customerId={row.id}
                            shopName={row.shopName}
                            assignedTo={row.assignedTo}
                            assignedAgentId={row.assignedAgentId}
                            assignedDate={row.assignedDate}
                            agents={salesAgents}
                            loadingAgents={loadingSalesAgents}
                            saving={assigningCustomerId === row.id}
                            onAssign={handleAssignAgent}
                          />
                        </td>
                        <td className="break-words px-2 py-2.5 text-sm font-semibold text-slate-600">
                          {row.verification === 'Verified' ? (row.verifiedBy || 'Verification recorded') : '—'}
                        </td>
                        <td className="px-2 py-2.5">
                          <div className="flex justify-center gap-1.5">
                            {activeCategory.id === 'unverified' && (
                              <><button
                                type="button"
                                aria-label={`Approve verification for ${row.shopName}`}
                                title={`Verify ${row.shopName} prospect`}
                                onClick={() => handleVerifyExistingProspect(row)}
                                disabled={loadingCustomerId === row.id}
                                className="rounded-full border border-blue-200 p-1.5 text-blue-600 transition hover:bg-blue-50 disabled:opacity-60"
                              >
                                <UserRoundCheck className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                aria-label={`Reject ${row.shopName} to Blacklisted`}
                                title={`Reject ${row.shopName} to Blacklisted`}
                                onClick={() => handleRejectExistingProspect(row)}
                                disabled={loadingCustomerId === row.id}
                                className="rounded-full border border-rose-200 p-1.5 text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
                              >
                                <XCircle className="h-4 w-4" />
                              </button></>
                            )}
                            <button
                              type="button"
                              aria-label={`Call ${row.shopName}`}
                              title={`Open call details for ${row.shopName}`}
                              onClick={() => openCustomerDetails(row, 'overview')}
                              disabled={loadingCustomerId === row.id}
                              className="rounded-full border border-emerald-200 p-1.5 text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-60"
                            >
                              <Phone className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {activeCategory.rows.length === 0 && (
                    <tr><td colSpan={9} className="px-3 py-12 text-center text-xs text-slate-400">No customers in this category.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
        )}
      </section>

      <footer className="flex items-center justify-between px-2 pb-2 text-[11px] text-slate-500">
        <span>© 2026 TND-OPC. All rights reserved.</span><span>Version 1.0.0</span>
      </footer>

      <DailyCallCustomerDetailModal
        isOpen={Boolean(selectedCustomer)}
        customer={selectedCustomer}
        currentUser={currentUser || null}
        initialTab={detailInitialTab}
        onClose={() => setSelectedCustomer(null)}
      />
    </div>
    </div>
  );
};

export default DailyCallMasterListView;
