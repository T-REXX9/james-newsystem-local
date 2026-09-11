import { CUSTOMER_UPDATED_EVENT } from '../utils/customerWorkflowEvents';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ClipboardList,
  Crown,
  Eye,
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
import { createCustomerLogForDailyCall, fetchCustomersForDailyCall, fetchDailyCallMasterList, getCachedDailyCallMasterList } from '../services/dailyCallMonitoringService';
import { bulkUpdateContacts, createContact, fetchSalesAgents, updateContact } from '../services/customerDatabaseLocalApiService';
import { fetchTeams, TeamRecord } from '../services/teamLocalApiService';
import { getVipTierConfig } from '../services/vipTierSettingsService';
import { Contact, CustomerStatus, DailyCallCustomerRow, DailyCallMasterCustomerRow, DailyCallMasterListMeta, UserProfile, VipTierConfig } from '../types';
import { DEFAULT_VIP_TIER_CONFIG } from '../utils/vipTierConfig';
import { resolveVipDiscountLevel } from '../utils/vipStanding';
import { DO_NOT_CONTACT_LABEL, isBlockedDailyCallMasterRow } from '../utils/dailyCallBlockedCustomer';
import { hasActionPermission, isMasterUserAccount } from '../constants';
import { VERIFIED_PROSPECT_POTENTIAL } from '../utils/dailyCallPotentialSales';
import AddContactModal from './AddContactModal';
import DailyCallCustomerDetailModal from './DailyCallCustomerDetailModal';
import DailyCallInlineAgentSelect, { formatAssignmentDateLabel } from './DailyCallInlineAgentSelect';
import { useToast } from './ToastProvider';
import type { DetailTabId } from './DailyCallCustomerDetailExpansion';

const fromDate = '2025-10-01';
const INITIAL_VISIBLE_ROWS = 30;
const VISIBLE_ROWS_STEP = 30;
const DO_NOT_CONTACT_CUSTOMER_STATUS = 4;

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

type CategoryId = 'priority' | 'recovery' | 'verified' | 'unverified' | 'blocked' | 'all';

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
    matches: (row) => !isBlockedDailyCallMasterRow(row) && (
      row.listCategory === 'priority'
      || (row.priorityTransactionCount ?? 0) > 0
      || (!row.listCategory && row.purchaseCount > 0)
    ),
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
    matches: (row) => !isBlockedDailyCallMasterRow(row)
      && (row.priorityTransactionCount ?? 0) === 0
      && (row.listCategory ? row.listCategory === 'recovery' : row.purchaseAgeGroup === 'over_one_month'),
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
    matches: (row) => !isBlockedDailyCallMasterRow(row)
      && row.purchaseCount === 0
      && (row.priorityTransactionCount ?? 0) === 0
      && row.purchaseAgeGroup === 'no_purchase'
      && isProspectRow(row)
      && row.verification === 'Verified',
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
    matches: (row) => !isBlockedDailyCallMasterRow(row)
      && row.purchaseCount === 0
      && (row.priorityTransactionCount ?? 0) === 0
      && row.purchaseAgeGroup === 'no_purchase'
      && isProspectRow(row)
      && row.verification !== 'Verified',
  },
  {
    id: 'blocked',
    label: DO_NOT_CONTACT_LABEL,
    note: 'View only — no contact or sales inquiry',
    state: 'Do Not Contact',
    accent: 'text-red-700',
    iconBg: 'bg-[#f94449]',
    border: 'border-red-200',
    softBg: 'bg-red-50/60',
    dot: 'bg-[#f94449]',
    matches: (row) => isBlockedDailyCallMasterRow(row),
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

const canUseMasterDailyCallActions = (user?: UserProfile | null) => {
  const role = String(user?.role || '').trim().toLowerCase();
  const userType = String(user?.user_type || '').trim();
  return role === 'master user' || role === 'company owner' || role === 'owner' || role === 'main' || role === 'developer' || userType === '1';
};

const sumBy = (rows: DailyCallMasterCustomerRow[], field: 'totalSales' | 'currentMonthSales' | 'purchaseCount' | 'averageMonthlySales') =>
  rows.reduce((sum, row) => sum + row[field], 0);

const ageLabel = (row: DailyCallMasterCustomerRow) => {
  if (!row.lastPurchaseDateRaw || (row.ledgerTransactionCount ?? row.purchaseCount) === 0) return 'No purchase yet';
  return row.daysSinceLastPurchase === 1 ? '1 day ago' : `${row.daysSinceLastPurchase} days ago`;
};

const purchaseHighlight = (row: DailyCallMasterCustomerRow) => {
  if (isBlockedDailyCallMasterRow(row)) {
    return {
      color: 'red',
      row: 'bg-[#f94449]/20 text-red-950 backdrop-blur-sm hover:bg-[#f94449]/30',
      muted: 'text-red-800',
      label: DO_NOT_CONTACT_LABEL,
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
  contactPersonName: row.contactPersonName,
  codeDate: '—',
  ishinomotoDealerSince: '—',
  ishinomotoSignageSince: '—',
  preferredBrand: '',
  quota: 0,
  modeOfPayment: '—',
  courier: [row.city, row.province].filter((value) => value && value !== '—').join(', ') || '—',
  status: isBlockedDailyCallMasterRow(row)
    ? CustomerStatus.BLACKLISTED
    : ((row.purchaseAgeGroup === 'no_purchase' ? 'Prospective' : row.purchaseAgeGroup === 'over_one_month' ? 'Inactive' : 'Active') as DailyCallCustomerRow['status']),
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
  const [detailViewOnly, setDetailViewOnly] = useState(false);
  const [loadingCustomerId, setLoadingCustomerId] = useState<string | null>(null);
  const [pendingDoNotContactRow, setPendingDoNotContactRow] = useState<DailyCallMasterCustomerRow | null>(null);
  const [doNotContactReason, setDoNotContactReason] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<CategoryId>('priority');
  const [visibleLimit, setVisibleLimit] = useState(INITIAL_VISIBLE_ROWS);
  const [currentVipFilter, setCurrentVipFilter] = useState('all');
  const [nextVipFilter, setNextVipFilter] = useState('all');
  const [lastPurchaseFilter, setLastPurchaseFilter] = useState('all');
  const [colorFilter, setColorFilter] = useState('all');
  const [vipConfig, setVipConfig] = useState<VipTierConfig>(DEFAULT_VIP_TIER_CONFIG);
  const [salesAgents, setSalesAgents] = useState<UserProfile[]>([]);
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [selectedAssignmentAgentId, setSelectedAssignmentAgentId] = useState('');
  const [selectedAssignmentTeamId, setSelectedAssignmentTeamId] = useState('');
  const [loadingSalesAgents, setLoadingSalesAgents] = useState(true);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [assigningCustomerId, setAssigningCustomerId] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search, 400);

  const handleSelectCategory = useCallback((categoryId: CategoryId) => {
    setActiveCategoryId(categoryId);
    setVisibleLimit(INITIAL_VISIBLE_ROWS);
  }, []);

  const openCustomerDetails = useCallback(async (row: DailyCallMasterCustomerRow, initialTab: DetailTabId = 'overview') => {
    setLoadingCustomerId(row.id);
    setDetailInitialTab(initialTab);
    setDetailViewOnly(isBlockedDailyCallMasterRow(row));
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
    setShowAddProspectModal(false);
    // Do not keep the modal open while the analytics-heavy master list refreshes.
    // The background refresh updates the dashboard once it completes.
    void loadRows(false, true);
    return created;
  }, [loadRows]);

  const handleVerifyExistingProspect = useCallback(async (row: DailyCallMasterCustomerRow) => {
    await updateContact(row.id, { verification: 'Verified' });
    setRows((prev) => prev.map((item) =>
      item.id === row.id ? { ...item, verification: 'Verified' } : item
    ));
    await loadRows(false, true);
  }, [loadRows]);

  const handleConfirmDoNotContact = useCallback(async () => {
    const row = pendingDoNotContactRow;
    if (!row) return;
    const reason = doNotContactReason.trim();
    if (!reason) {
      addToast({
        type: 'error',
        title: 'Reason required',
        description: 'Enter a reason before marking the customer as Do Not Contact.',
      });
      return;
    }
    const shouldRejectProspect = isProspectRow(row) && row.verification !== 'Verified';
    const updates = {
      status: CustomerStatus.BLACKLISTED,
      debtType: 'Bad' as const,
      ...(shouldRejectProspect ? { verification: 'Rejected' } : {}),
    };

    setLoadingCustomerId(row.id);
    try {
      await updateContact(row.id, updates, currentUser?.id);
      await createCustomerLogForDailyCall({
        contact_id: row.id,
        entry_type: 'Status',
        topic: 'Status',
        status: 'Do Not Contact',
        note: reason,
      });
      setRows((prev) => prev.map((item) =>
        item.id === row.id
          ? {
              ...item,
              customerStatus: DO_NOT_CONTACT_CUSTOMER_STATUS,
              debtType: 'Bad',
              ...(shouldRejectProspect ? { verification: 'Rejected' } : {}),
            }
          : item
      ));
      await loadRows(false, true);
      setDoNotContactReason('');
      setPendingDoNotContactRow(null);
    } catch {
      addToast({
        type: 'error',
        title: 'Unable to update customer',
        description: 'Please try again or update Status from Customer Database.',
      });
    } finally {
      setLoadingCustomerId(null);
    }
  }, [addToast, currentUser?.id, doNotContactReason, loadRows, pendingDoNotContactRow]);

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

  useEffect(() => {
    let active = true;
    setLoadingTeams(true);
    void fetchTeams()
      .then((response) => {
        if (active) setTeams(response.items || []);
      })
      .catch(() => {
        if (active) addToast({ type: 'error', title: 'Unable to load teams', description: 'Team assignment may be unavailable until you refresh.' });
      })
      .finally(() => {
        if (active) setLoadingTeams(false);
      });
    return () => { active = false; };
  }, [addToast]);

  const handleAssignAgent = useCallback(async (customerId: string, agent: UserProfile | null) => {
    if (!isMasterUserAccount(currentUser)) {
      addToast({
        type: 'error',
        title: 'Assignment restricted',
        description: 'Only the Master User can assign a sales agent.',
      });
      return;
    }
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
  }, [addToast, currentUser]);

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
      ? categoryRows.length * VERIFIED_PROSPECT_POTENTIAL
      : category.id === 'unverified'
        ? 0
        : category.id === 'priority' || category.id === 'recovery' || category.id === 'blocked'
          ? sumBy(categoryRows, 'averageMonthlySales')
          : 0;
    return { ...category, rows: categoryRows, currentSales, potentialSales };
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
  const showMasterActions = canUseMasterDailyCallActions(currentUser);
  // Daily Call actions follow the explicit Customer Database edit grant. Keep
  // the legacy master-user access, but do not treat missing action metadata as
  // permission (the shared helper defaults missing metadata to allow).
  const canEditCustomerDatabase = showMasterActions || Boolean(currentUser?.action_permissions)
    && hasActionPermission(currentUser, 'can_edit', 'Customer Database');

  const handleAssignTeamToCategory = useCallback(async () => {
    if (!selectedAssignmentTeamId || activeCategory.rows.length === 0) return;
    const team = teams.find((item) => String(item.id) === selectedAssignmentTeamId);
    if (!team) return;
    const ids = activeCategory.rows.map((row) => row.id);
    const previousRows = rowsRef.current;
    setRows((prev) => prev.map((row) => ids.includes(row.id)
      ? { ...row, assignedTeamId: selectedAssignmentTeamId, assignedTeam: team.name }
      : row));
    setAssigningCustomerId('__team__');
    try {
      await bulkUpdateContacts(ids, { __salesTeamId: selectedAssignmentTeamId } as any);
      if (fullCustomerRowsRef.current) {
        fullCustomerRowsRef.current = fullCustomerRowsRef.current.map((row) => ids.includes(row.id)
          ? { ...row, assignedTeam: team.name }
          : row);
      }
      addToast({ type: 'success', title: 'Team assigned', description: `${team.name} is now assigned to ${activeCategory.label}.` });
      setSelectedAssignmentTeamId('');
      await loadRows(false, true);
    } catch {
      setRows(previousRows);
      addToast({ type: 'error', title: 'Unable to assign team', description: 'Please try again.' });
    } finally {
      setAssigningCustomerId(null);
    }
  }, [activeCategory, addToast, loadRows, selectedAssignmentTeamId, teams]);

  const handleAssignAgentToCategory = useCallback(async () => {
    if (!selectedAssignmentAgentId || activeCategory.rows.length === 0) return;
    const shouldClearAssignment = selectedAssignmentAgentId === '__unassigned__';
    const agent = shouldClearAssignment
      ? null
      : salesAgents.find((item) => String(item.id) === selectedAssignmentAgentId);
    if (!agent && !shouldClearAssignment) return;

    const ids = activeCategory.rows.map((row) => row.id);
    const previousRows = rowsRef.current;
    const assignedTo = agent?.full_name?.trim() || 'Unassigned';
    const assignedAgentId = agent?.id || '';
    const assignedDate = agent ? formatAssignmentDateLabel() : undefined;
    setRows((prev) => prev.map((row) => ids.includes(row.id)
      ? { ...row, assignedTo, assignedAgentId, assignedDate }
      : row));
    setAssigningCustomerId('__agent__');

    try {
      await bulkUpdateContacts(ids, {
        __salesPersonId: assignedAgentId,
        salesman: assignedTo === 'Unassigned' ? '' : assignedTo,
        assignedAgent: assignedTo === 'Unassigned' ? '' : assignedTo,
      } as any);
      if (fullCustomerRowsRef.current) {
        fullCustomerRowsRef.current = fullCustomerRowsRef.current.map((row) => ids.includes(row.id)
          ? { ...row, assignedTo, assignedDate }
          : row);
      }
      addToast({
        type: 'success',
        title: agent ? 'Agent assigned' : 'Agent assignment cleared',
        description: agent
          ? `${agent.full_name} is now assigned to ${activeCategory.label}.`
          : `Agent assignment cleared for ${activeCategory.label}.`,
      });
      setSelectedAssignmentAgentId('');
      await loadRows(false, true);
    } catch {
      setRows(previousRows);
      addToast({ type: 'error', title: 'Unable to assign agent', description: 'Please try again.' });
    } finally {
      setAssigningCustomerId(null);
    }
  }, [activeCategory, addToast, loadRows, salesAgents, selectedAssignmentAgentId]);

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
          Potential Sales = Priority avg monthly (last 12 months) + Recovery avg monthly (last 12 months of active year) + Blacklisted avg monthly (same as Recovery) + ₱5,000 per verified prospect. Unverified prospects are ₱0.
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

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5 2xl:gap-4" aria-label="Customer category summaries">
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
                {category.id === 'priority' && (
                  <div>
                    <p>Current Month Sales</p>
                    <p className={`text-base font-bold ${category.accent}`}>{compactPeso.format(category.currentSales)}</p>
                  </div>
                )}
                {(category.id === 'priority' || category.id === 'recovery') && (
                  <div>
                    <p>Monthly Sales Potential</p>
                    <p className={`text-base font-bold ${category.accent}`}>{compactPeso.format(category.potentialSales)}</p>
                  </div>
                )}
                {(category.id === 'verified' || category.id === 'blocked') && (
                  <div>
                    <p>Monthly Potential Sales</p>
                    <p className={`text-base font-bold ${category.accent}`}>{compactPeso.format(category.potentialSales)}</p>
                  </div>
                )}
                {category.id === 'unverified' && (
                  <div>
                    <p>Potential Sales</p>
                    <p className={`text-base font-bold ${category.accent}`}>{compactPeso.format(category.potentialSales)}</p>
                  </div>
                )}
              </div>
            </div>
            {activeCategory.id === 'blocked' && (
              <p className="mt-2 border-t border-red-200 pt-2 text-xs font-semibold text-red-700">View only. Contact and sales inquiry actions are disabled.</p>
            )}
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
            className="flex min-h-[430px] scroll-mt-4 flex-col overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500 2xl:min-h-[500px]"
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3">
              <h3 className={`text-xl font-bold uppercase ${activeCategory.accent}`}>
                {activeCategory.label} <span className="ml-2 text-sm normal-case">({activeCategory.note})</span>
              </h3>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-2 text-sm"><i className={`h-3 w-3 rounded-full ${activeCategory.dot}`} />{activeCategory.state}</span>
                {showMasterActions && activeCategory.id !== 'blocked' && (
                  <div className="flex items-center gap-2">
                    <select
                      aria-label={`Assign sales agent to ${activeCategory.label}`}
                      value={selectedAssignmentAgentId}
                      onChange={(event) => setSelectedAssignmentAgentId(event.target.value)}
                      disabled={loadingSalesAgents || assigningCustomerId === '__agent__' || assigningCustomerId === '__team__'}
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold"
                    >
                      <option value="">Assign sales agent to list...</option>
                      <option value="__unassigned__">Clear sales agent from list</option>
                      {salesAgents.map((agent) => <option key={agent.id} value={agent.id}>{agent.full_name}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => void handleAssignAgentToCategory()}
                      disabled={!selectedAssignmentAgentId || activeCategory.rows.length === 0 || assigningCustomerId === '__agent__' || assigningCustomerId === '__team__'}
                      className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Assign agent
                    </button>
                    <select
                      aria-label={`Assign team to ${activeCategory.label}`}
                      value={selectedAssignmentTeamId}
                      onChange={(event) => setSelectedAssignmentTeamId(event.target.value)}
                      disabled={loadingTeams || assigningCustomerId === '__agent__' || assigningCustomerId === '__team__'}
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold"
                    >
                      <option value="">Assign team to list...</option>
                      {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => void handleAssignTeamToCategory()}
                      disabled={!selectedAssignmentTeamId || activeCategory.rows.length === 0 || assigningCustomerId === '__agent__' || assigningCustomerId === '__team__'}
                      className="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Assign {activeCategory.label}
                    </button>
                  </div>
                )}
                <button type="button" onClick={() => loadRows(false, true)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-bold hover:bg-slate-50">
                  <RefreshCw className="h-4 w-4" /> Refresh
                </button>
              </div>
            </div>
            <div
              className="min-h-0 flex-1"
              data-testid="daily-call-table-scroll"
              onScroll={handleTableScroll}
            >
              <table className="w-full table-fixed border-separate border-spacing-0 text-left text-sm">
                <thead className="sticky top-0 z-20 bg-slate-50 text-xs text-slate-600 shadow-sm [&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:border-b [&_th]:border-slate-200 [&_th]:bg-slate-50">
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
                    <th className="min-w-[220px] px-2 py-2.5">Staff comment</th>
                    <th className="w-[150px] px-2 py-2.5">Verified By</th>
                    <th className="w-[105px] px-2 py-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row, index) => {
                    const rowBlocked = isBlockedDailyCallMasterRow(row);
                    const viewOnlyRow = activeCategory.id === 'blocked' || rowBlocked;
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
                          <p className={`mt-0.5 truncate text-xs font-semibold ${highlight.muted}`}>
                            {row.contactNumber}
                            {row.contactPersonName && <span className="font-normal"> · {row.contactPersonName}</span>}
                          </p>
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
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {isBlockedDailyCallMasterRow(row) || row.listCategory === 'recovery'
                              ? `(Based on ${row.averageMonthlySalesMonthCount} months in last 12 months of active year${row.averageMonthlySalesYear ? ` ${row.averageMonthlySalesYear}` : ''})`
                              : `(Based on ${row.averageMonthlySalesMonthCount} months in the last 12 months)`}
                          </p>
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
                            disabled={viewOnlyRow || !isMasterUserAccount(currentUser)}
                            onAssign={handleAssignAgent}
                          />
                          {row.assignedTeam && <p className="mt-1 text-[10px] font-bold text-indigo-700">Team: {row.assignedTeam}</p>}
                        </td>
                        <td className="max-w-[280px] break-words px-2 py-2.5 text-sm">
                          {row.prospectComment ? (
                            <span className="block whitespace-pre-wrap text-slate-700" title={row.prospectComment}>{row.prospectComment}</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="break-words px-2 py-2.5 text-sm font-semibold text-slate-600">
                          {row.verification === 'Verified' ? (row.verifiedBy || 'Verification recorded') : '—'}
                        </td>
                        <td className="px-2 py-2.5">
                          <div className="flex justify-center gap-1.5">
                            {activeCategory.id === 'unverified' && canEditCustomerDatabase && (
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
                              </>
                            )}
                            {viewOnlyRow ? (
                              <button
                                type="button"
                                aria-label={`View ${row.shopName}`}
                                title={`View-only record for ${row.shopName}`}
                                onClick={() => openCustomerDetails(row, 'overview')}
                                disabled={loadingCustomerId === row.id}
                                className="rounded-full border border-red-200 p-1.5 text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            ) : canEditCustomerDatabase ? (
                              <>
                                <button
                                  type="button"
                                  aria-label={`Mark ${row.shopName} as Do Not Contact`}
                                  title={`Mark ${row.shopName} as Do Not Contact`}
                                  onClick={() => {
                                    setDoNotContactReason('');
                                    setPendingDoNotContactRow(row);
                                  }}
                                  disabled={loadingCustomerId === row.id}
                                  className="rounded-full border border-rose-200 p-1.5 text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
                                >
                                  <XCircle className="h-4 w-4" />
                                </button>
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
                              </>
                            ) : (
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
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {activeCategory.rows.length === 0 && (
                    <tr><td colSpan={10} className="px-3 py-12 text-center text-xs text-slate-400">No customers in this category.</td></tr>
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

      {pendingDoNotContactRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="do-not-contact-confirm-title"
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-rose-50 p-2 text-rose-600">
                <XCircle className="h-5 w-5" />
              </div>
              <div>
                <h2 id="do-not-contact-confirm-title" className="text-base font-bold text-slate-950">Mark as Do Not Contact</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Confirm that <span className="font-semibold text-slate-900">{pendingDoNotContactRow.shopName}</span> should be moved to Do Not Contact.
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  This sets the customer status to Blacklisted and debt type to Bad. Unverified prospects will also be marked Rejected.
                </p>
                <label className="mt-4 block text-xs font-semibold text-slate-700" htmlFor="do-not-contact-reason">
                  Reason for Do Not Contact <span className="text-rose-600">*</span>
                  <textarea
                    id="do-not-contact-reason"
                    aria-label="Reason for Do Not Contact"
                    value={doNotContactReason}
                    onChange={(event) => setDoNotContactReason(event.target.value)}
                    placeholder="Explain why this customer should not be contacted"
                    rows={3}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                  />
                </label>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDoNotContactRow(null)}
                disabled={loadingCustomerId === pendingDoNotContactRow.id}
                className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDoNotContact}
                disabled={loadingCustomerId === pendingDoNotContactRow.id || !doNotContactReason.trim()}
                className="inline-flex items-center rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
              >
                {loadingCustomerId === pendingDoNotContactRow.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Mark Do Not Contact
              </button>
            </div>
          </div>
        </div>
      )}

      <DailyCallCustomerDetailModal
        isOpen={Boolean(selectedCustomer)}
        customer={selectedCustomer}
        currentUser={currentUser || null}
        initialTab={detailInitialTab}
        viewOnlyDoNotContact={detailViewOnly}
        onClose={() => {
          setSelectedCustomer(null);
          setDetailViewOnly(false);
        }}
      />
    </div>
    </div>
  );
};

export default DailyCallMasterListView;
