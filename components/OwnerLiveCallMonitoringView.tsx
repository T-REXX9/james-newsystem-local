import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import OwnerDashboardTemplate, {
  CustomerCategoryId,
  CustomerCategorySummary,
} from './OwnerDashboardTemplate';
import { buildOwnerDashboardMetrics } from './ownerDashboardMetrics';
import DashboardViewportFit from './DashboardViewportFit';
import {
  differenceInDays,
  format,
  getDate,
  isSameDay,
  parseISO,
  startOfMonth,
  subDays,
} from 'date-fns';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { UserProfile } from '../types';
import type { DailyCallMasterCustomerRow } from '../types';
import { fetchDailyCallMasterList } from '../services/dailyCallMonitoringService';

interface OwnerLiveCallMonitoringViewProps {
  currentUser: UserProfile | null;
}

type Outcome = 'Successful' | 'Follow-up' | 'No Answer' | 'Rejected' | 'Pending';
type InteractionType = 'call' | 'text' | 'inquiry' | 'purchase' | 'return';
type DealStatus = 'Open' | 'Won' | 'Lost' | 'Follow-up';
type ReportType = 'Incident Reports' | 'Returns' | 'Sales Reports';
type CustomerCategory =
  | 'active-buyers-no-purchase'
  | 'inactive-positives'
  | 'prospective-positives'
  | 'inactive-negatives'
  | 'blacklisted'
  | 'negative-prospects';

interface Agent {
  id: string;
  name: string;
  quota: number;
  salesMTD: number;
  callsToday: number;
  textsToday: number;
  successRate: number;
  online: boolean;
}

interface Customer {
  id: string;
  name: string;
  locationArea: string;
  agentId: string;
  category: CustomerCategory;
  lastContactAt: string;
  rtoCount: number;
  creditLimit: number;
  ledgerBalance: number;
  dealStatus: DealStatus;
}

interface InteractionItem {
  id: string;
  customerId: string;
  agentId: string;
  type: InteractionType;
  outcome: Outcome;
  date: string;
  amount?: number;
  itemName?: string;
}

interface ReportItem {
  id: string;
  type: ReportType;
  title: string;
  submittedBy: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected';
  read: boolean;
}

interface AlertItem {
  id: string;
  type: 'reassignment' | 'price';
  title: string;
  customers: Customer[];
}

interface OutcomeRow {
  id: string;
  customer: string;
  agent: string;
  outcome: Outcome;
  date: string;
  customerId: string;
}

interface DealStatusRow {
  id: string;
  customer: string;
  area: string;
  agent: string;
  status: DealStatus;
  lastContactAt: string;
  customerId: string;
}

const NOTES_KEY = 'owner-daily-call-notes';
const REPORTS_KEY = 'owner-daily-call-reports-state';
const MONTHLY_TARGET_KEY_PREFIX = 'owner-dashboard-monthly-target';

const CATEGORY_LABEL: Record<CustomerCategory, string> = {
  'active-buyers-no-purchase': 'Active buyer',
  'inactive-positives': 'Inactive positive',
  'prospective-positives': 'Prospective positive',
  'inactive-negatives': 'Inactive negative',
  blacklisted: 'Blacklisted',
  'negative-prospects': 'Negative prospect',
};

const toCurrency = (value: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value);

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

interface ContactSnapshotRow {
  id: string;
  company: string | null;
  province: string | null;
  city: string | null;
  assignedAgent: string | null;
  salesman: string | null;
  status: string | null;
  lastContactDate: string | null;
  created_at: string | null;
  creditLimit: number | null;
  balance: number | null;
  is_deleted: boolean | null;
}

interface CallLogSnapshotRow {
  id: string;
  contact_id: string;
  agent_name: string | null;
  channel: string | null;
  outcome: string | null;
  occurred_at: string | null;
}

interface PurchaseSnapshotRow {
  id: string;
  contact_id: string;
  total_amount: number | null;
  purchase_date: string | null;
}

interface InquirySnapshotRow {
  id: string;
  contact_id: string;
  sales_person: string | null;
  status: string | null;
  sales_date: string | null;
  is_deleted: boolean | null;
}

interface ReturnSnapshotRow {
  id: string;
  contact_id: string;
  return_date: string | null;
  total_refund: number | null;
  reason: string | null;
}

interface DealSnapshotRow {
  id: string;
  company: string | null;
  stageId?: string | null;
  stageid?: string | null;
  title: string | null;
  is_deleted: boolean;
  [key: string]: unknown;
}

interface ProfileSnapshotRow {
  id: string;
  full_name: string | null;
  monthly_quota: number | null;
}

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const toDateKey = (value?: string | null) => {
  if (!value) return format(new Date(), 'yyyy-MM-dd');
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return format(new Date(), 'yyyy-MM-dd');
  return format(parsed, 'yyyy-MM-dd');
};

const mapCallOutcome = (value?: string | null): Outcome => {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized.includes('success') || normalized.includes('won') || normalized.includes('answered')) return 'Successful';
  if (normalized.includes('follow')) return 'Follow-up';
  if (normalized.includes('no answer') || normalized.includes('unanswered') || normalized.includes('missed')) return 'No Answer';
  if (normalized.includes('reject') || normalized.includes('decline') || normalized.includes('cancel')) return 'Rejected';
  return 'Pending';
};

const mapInquiryOutcome = (value?: string | null): Outcome => {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized.includes('approved') || normalized.includes('convert')) return 'Successful';
  if (normalized.includes('cancel') || normalized.includes('reject')) return 'Rejected';
  if (normalized.includes('draft') || normalized.includes('pending')) return 'Pending';
  return 'Follow-up';
};

const mapDealStatus = (value?: string | null): DealStatus => {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized.includes('won') || normalized.includes('closed_won') || normalized.includes('closed won')) return 'Won';
  if (normalized.includes('lost') || normalized.includes('closed_lost') || normalized.includes('closed lost')) return 'Lost';
  if (normalized.includes('follow')) return 'Follow-up';
  return 'Open';
};

const seedReports = (): ReportItem[] => {
  const today = new Date();
  const base: Omit<ReportItem, 'read' | 'status'>[] = [
    { id: 'r1', type: 'Incident Reports', title: 'Client dispute: pricing mismatch', submittedBy: 'Sarah Reyes', createdAt: format(subDays(today, 1), 'yyyy-MM-dd') },
    { id: 'r2', type: 'Returns', title: 'Bulk return request #RT-113', submittedBy: 'Miguel Cruz', createdAt: format(subDays(today, 2), 'yyyy-MM-dd') },
    { id: 'r3', type: 'Sales Reports', title: 'Week 5 field conversion summary', submittedBy: 'John Lim', createdAt: format(subDays(today, 3), 'yyyy-MM-dd') },
    { id: 'r4', type: 'Incident Reports', title: 'Failed follow-up callback escalation', submittedBy: 'Alyssa Santos', createdAt: format(subDays(today, 4), 'yyyy-MM-dd') },
    { id: 'r5', type: 'Sales Reports', title: 'Underperforming territory update', submittedBy: 'Ella Dizon', createdAt: format(subDays(today, 5), 'yyyy-MM-dd') },
  ];

  return base.map((item, index) => ({
    ...item,
    read: false,
    status: index % 3 === 0 ? 'pending' : 'approved',
  }));
};

const STORAGE_HELPER = {
  readNotes(): Record<string, string> {
    try {
      const value = localStorage.getItem(NOTES_KEY);
      return value ? JSON.parse(value) : {};
    } catch {
      return {};
    }
  },
  saveNotes(notes: Record<string, string>) {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  },
  readReports(defaultReports: ReportItem[]): ReportItem[] {
    try {
      const value = localStorage.getItem(REPORTS_KEY);
      if (!value) return defaultReports;
      const parsed = JSON.parse(value) as Record<string, Pick<ReportItem, 'read' | 'status'>>;
      return defaultReports.map((report) => ({
        ...report,
        read: parsed[report.id]?.read ?? report.read,
        status: parsed[report.id]?.status ?? report.status,
      }));
    } catch {
      return defaultReports;
    }
  },
  saveReports(reports: ReportItem[]) {
    const compact = reports.reduce<Record<string, Pick<ReportItem, 'read' | 'status'>>>((acc, report) => {
      acc[report.id] = { read: report.read, status: report.status };
      return acc;
    }, {});
    localStorage.setItem(REPORTS_KEY, JSON.stringify(compact));
  },
};

const OwnerLiveCallMonitoringView: React.FC<OwnerLiveCallMonitoringViewProps> = ({ currentUser }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [masterListRows, setMasterListRows] = useState<DailyCallMasterCustomerRow[]>([]);
  const [interactions, setInteractions] = useState<InteractionItem[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(true);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [agentFilter, setAgentFilter] = useState<string | null>(null);
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showDealStatusDialog, setShowDealStatusDialog] = useState(false);
  const [selectedDealStatus, setSelectedDealStatus] = useState<DealStatus | null>(null);
  const [showOutcomeDialog, setShowOutcomeDialog] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<Outcome | null>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [activeReport, setActiveReport] = useState<ReportItem | null>(null);
  const [showQueueDialog, setShowQueueDialog] = useState(false);
  const [selectedQueueType, setSelectedQueueType] = useState<ReportType | null>(null);
  const [showAlertDialog, setShowAlertDialog] = useState(false);
  const [activeAlert, setActiveAlert] = useState<AlertItem | null>(null);
  const [showAttendanceDialog, setShowAttendanceDialog] = useState(false);

  const [notesByCustomer, setNotesByCustomer] = useState<Record<string, string>>(() => STORAGE_HELPER.readNotes());
  const [reports, setReports] = useState<ReportItem[]>(() => STORAGE_HELPER.readReports(seedReports()));
  const [monthlyTargetOverride, setMonthlyTargetOverride] = useState<number | null>(null);

  const normalizedRole = String(currentUser?.role || '').trim().toLowerCase();
  const hasGlobalAccess = Boolean(currentUser?.access_rights?.includes('*'));
  const canEditMonthlyTarget =
    !currentUser ||
    !normalizedRole ||
    hasGlobalAccess ||
    normalizedRole === 'owner' ||
    normalizedRole === 'master' ||
    normalizedRole === 'master user';
  const monthlyTargetStorageKey = `${MONTHLY_TARGET_KEY_PREFIX}:${(currentUser as any)?.main_id || (currentUser as any)?.main_userid || API_MAIN_ID}`;

  const loadSnapshot = useCallback(async () => {
    setIsLoadingSnapshot(true);
    setSnapshotError(null);

    try {
      const params = new URLSearchParams({
        main_id: String((currentUser as any)?.main_id || (currentUser as any)?.main_userid || API_MAIN_ID),
      });
      const [response, masterListResult] = await Promise.all([
        fetch(`${API_BASE_URL}/daily-call-monitoring/owner-snapshot?${params.toString()}`),
        fetchDailyCallMasterList({ fromDate: '2025-10-01' }),
      ]);
      if (!response.ok) throw new Error(`API request failed (${response.status})`);

      const payload = await response.json();
      const snapshot = payload?.data || {};

      const contacts = ((snapshot.contacts as ContactSnapshotRow[]) || []).filter((row) => !row.is_deleted);
      const callLogs = (snapshot.callLogs as CallLogSnapshotRow[]) || [];
      const purchases = (snapshot.purchases as PurchaseSnapshotRow[]) || [];
      const inquiries = ((snapshot.inquiries as InquirySnapshotRow[]) || []).filter((row) => !row.is_deleted);
      const returns = (snapshot.returns as ReturnSnapshotRow[]) || [];
      const deals = ((snapshot.deals as DealSnapshotRow[]) || []).filter((row) => !row.is_deleted);
      const profiles = (snapshot.profiles as ProfileSnapshotRow[]) || [];

      const profileById = new Map(profiles.map((row) => [row.id, row]));
      const profileByName = new Map(
        profiles
          .filter((row) => row.full_name)
          .map((row) => [row.full_name!.trim().toLowerCase(), row])
      );

      const contactById = new Map(contacts.map((row) => [row.id, row]));
      const contactAgentId = new Map<string, string>();
      const dealStatusByCompany = new Map<string, DealStatus>();

      deals.forEach((deal) => {
        const key = (deal.company || '').trim().toLowerCase();
        if (!key) return;
        const stageValue = (deal.stageId ?? deal.stageid) as string | null | undefined;
        dealStatusByCompany.set(key, mapDealStatus(stageValue || deal.title));
      });

      const resolveAgent = (raw: string | null | undefined, fallback = 'Unassigned') => {
        const value = (raw || '').trim();
        if (!value) {
          const id = 'agent:unassigned';
          return { id, name: fallback };
        }
        const profile = profileById.get(value) || profileByName.get(value.toLowerCase());
        if (profile) {
          return {
            id: profile.id,
            name: profile.full_name?.trim() || value,
          };
        }
        return { id: `agent:${slugify(value) || 'unknown'}`, name: value };
      };

      const derivedCustomers: Customer[] = contacts.map((contact) => {
        const agent = resolveAgent(contact.assignedAgent || contact.salesman, 'Unassigned');
        contactAgentId.set(contact.id, agent.id);
        return {
          id: contact.id,
          name: contact.company || 'Unnamed Customer',
          locationArea: contact.province || contact.city || 'Unknown',
          agentId: agent.id,
          category: 'active-buyers-no-purchase',
          lastContactAt: toDateKey(contact.lastContactDate || contact.created_at),
          rtoCount: returns.filter((row) => row.contact_id === contact.id).length,
          creditLimit: Number(contact.creditLimit || 0),
          ledgerBalance: Number(contact.balance || 0),
          dealStatus: dealStatusByCompany.get((contact.company || '').trim().toLowerCase()) || 'Open',
        };
      });

      const generatedInteractions: InteractionItem[] = [
        ...callLogs.map((log): InteractionItem => {
          const contact = contactById.get(log.contact_id);
          const fallbackAgent = contact ? contactAgentId.get(contact.id) : undefined;
          const resolvedAgent = resolveAgent(log.agent_name, 'Unassigned');
          const channelType: InteractionType =
            (log.channel || '').toLowerCase().includes('text') || (log.channel || '').toLowerCase().includes('sms')
              ? 'text'
              : 'call';
          return {
            id: `call-${log.id}`,
            customerId: log.contact_id,
            agentId: log.agent_name ? resolvedAgent.id : fallbackAgent || resolvedAgent.id,
            type: channelType,
            outcome: mapCallOutcome(log.outcome),
            date: toDateKey(log.occurred_at),
          };
        }),
        ...inquiries.map((inquiry): InteractionItem => {
          const fallbackAgent = contactAgentId.get(inquiry.contact_id);
          const resolvedAgent = resolveAgent(inquiry.sales_person, 'Unassigned');
          return {
            id: `inq-${inquiry.id}`,
            customerId: inquiry.contact_id,
            agentId: inquiry.sales_person ? resolvedAgent.id : fallbackAgent || resolvedAgent.id,
            type: 'inquiry',
            outcome: mapInquiryOutcome(inquiry.status),
            date: toDateKey(inquiry.sales_date),
          };
        }),
        ...purchases.map((purchase): InteractionItem => ({
          id: `purchase-${purchase.id}`,
          customerId: purchase.contact_id,
          agentId: contactAgentId.get(purchase.contact_id) || 'agent:unassigned',
          type: 'purchase' as const,
          outcome: 'Successful' as const,
          date: toDateKey(purchase.purchase_date),
          amount: Number(purchase.total_amount || 0),
        })),
        ...returns.map((item): InteractionItem => ({
          id: `return-${item.id}`,
          customerId: item.contact_id,
          agentId: contactAgentId.get(item.contact_id) || 'agent:unassigned',
          type: 'return' as const,
          outcome: 'Rejected' as const,
          date: toDateKey(item.return_date),
          amount: Number(item.total_refund || 0),
          itemName: item.reason || 'Return',
        })),
      ];

      const metricsByCustomer = new Map<string, { inquiries: number; purchases: number; successful: number; lastDate: string }>();
      generatedInteractions.forEach((item) => {
        const current = metricsByCustomer.get(item.customerId) || {
          inquiries: 0,
          purchases: 0,
          successful: 0,
          lastDate: item.date,
        };
        current.lastDate = current.lastDate > item.date ? current.lastDate : item.date;
        if (item.type === 'inquiry') current.inquiries += 1;
        if (item.type === 'purchase') current.purchases += 1;
        if (item.outcome === 'Successful') current.successful += 1;
        metricsByCustomer.set(item.customerId, current);
      });

      const categorizedCustomers = derivedCustomers.map((customer) => {
        const contact = contactById.get(customer.id);
        const status = (contact?.status || '').toLowerCase();
        const metrics = metricsByCustomer.get(customer.id) || { inquiries: 0, purchases: 0, successful: 0, lastDate: customer.lastContactAt };
        const category: CustomerCategory =
          status.includes('blacklist')
            ? 'blacklisted'
            : status.includes('inactive')
              ? metrics.successful > 0
                ? 'inactive-positives'
                : 'inactive-negatives'
              : status.includes('prospective')
                ? metrics.successful > 0
                  ? 'prospective-positives'
                  : 'negative-prospects'
                : metrics.purchases === 0
                  ? 'active-buyers-no-purchase'
                  : 'active-buyers-no-purchase';
        const dealStatus: DealStatus = customer.dealStatus === 'Open'
          ? metrics.purchases > 0
            ? 'Won'
            : metrics.inquiries > 0
              ? 'Follow-up'
              : 'Open'
          : customer.dealStatus;
        return {
          ...customer,
          category,
          dealStatus,
          lastContactAt: metrics.lastDate || customer.lastContactAt,
        };
      });

      const monthStart = startOfMonth(new Date());
      const todayKey = format(new Date(), 'yyyy-MM-dd');
      const agentNames = new Map<string, string>();
      categorizedCustomers.forEach((row) => {
        if (!agentNames.has(row.agentId)) {
          const profile = profileById.get(row.agentId);
          agentNames.set(row.agentId, profile?.full_name?.trim() || row.agentId.replace(/^agent:/, '').replace(/-/g, ' '));
        }
      });
      generatedInteractions.forEach((interaction) => {
        if (!agentNames.has(interaction.agentId)) {
          const profile = profileById.get(interaction.agentId);
          agentNames.set(interaction.agentId, profile?.full_name?.trim() || interaction.agentId.replace(/^agent:/, '').replace(/-/g, ' '));
        }
      });

      const derivedAgents: Agent[] = Array.from(agentNames.entries()).map(([agentId, rawName]) => {
        const rows = generatedInteractions.filter((item) => item.agentId === agentId);
        const callTextRows = rows.filter((item) => item.type === 'call' || item.type === 'text');
        const successful = callTextRows.filter((item) => item.outcome === 'Successful').length;
        const salesMTD = rows
          .filter((item) => item.type === 'purchase' && parseISO(item.date) >= monthStart)
          .reduce((sum, item) => sum + (item.amount || 0), 0);
        const latestDate = rows.reduce((latest, row) => (row.date > latest ? row.date : latest), '');
        const profile = profileById.get(agentId);

        return {
          id: agentId,
          name: rawName
            .split(' ')
            .filter(Boolean)
            .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
            .join(' '),
          quota: Number(profile?.monthly_quota || 0),
          salesMTD,
          callsToday: rows.filter((item) => item.type === 'call' && item.date === todayKey).length,
          textsToday: rows.filter((item) => item.type === 'text' && item.date === todayKey).length,
          successRate: callTextRows.length ? successful / callTextRows.length : 0,
          online: latestDate === todayKey,
        };
      });

      setCustomers(categorizedCustomers);
      setMasterListRows(masterListResult.items);
      setInteractions(generatedInteractions);
      setAgents(derivedAgents.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Error loading owner live call monitoring snapshot:', error);
      setCustomers([]);
      setMasterListRows([]);
      setInteractions([]);
      setAgents([]);
      setSnapshotError('Unable to load live monitoring data from local MySQL API.');
    } finally {
      setIsLoadingSnapshot(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  useEffect(() => {
    STORAGE_HELPER.saveNotes(notesByCustomer);
  }, [notesByCustomer]);

  useEffect(() => {
    STORAGE_HELPER.saveReports(reports);
  }, [reports]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(monthlyTargetStorageKey);
      if (!saved) {
        setMonthlyTargetOverride(null);
        return;
      }
      const parsed = Number(saved);
      setMonthlyTargetOverride(Number.isFinite(parsed) && parsed >= 0 ? parsed : null);
    } catch {
      setMonthlyTargetOverride(null);
    }
  }, [monthlyTargetStorageKey]);

  const agentById = useMemo(() => {
    return agents.reduce<Record<string, Agent>>((acc, agent) => {
      acc[agent.id] = agent;
      return acc;
    }, {});
  }, [agents]);

  const customerById = useMemo(() => {
    return customers.reduce<Record<string, Customer>>((acc, customer) => {
      acc[customer.id] = customer;
      return acc;
    }, {});
  }, [customers]);

  const baseFilteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const matchesAgent = !agentFilter || customer.agentId === agentFilter;
      const matchesArea = !areaFilter || customer.locationArea === areaFilter;
      const matchesSearch = !search || `${customer.name} ${customer.locationArea}`.toLowerCase().includes(search.toLowerCase());
      return matchesAgent && matchesArea && matchesSearch;
    });
  }, [customers, agentFilter, areaFilter, search]);

  const masterListCategoryRows = useMemo(() => {
    const selectedAgentName = agentFilter ? agentById[agentFilter]?.name.toLowerCase() : '';
    const normalizedArea = areaFilter?.toLowerCase() || '';
    const normalizedSearch = search.trim().toLowerCase();

    const rows = masterListRows.filter((row) => {
      const haystack = [
        row.shopName,
        row.province,
        row.city,
        row.contactNumber,
        row.assignedTo,
      ].join(' ').toLowerCase();
      const matchesSearch = !normalizedSearch || haystack.includes(normalizedSearch);
      const matchesArea =
        !normalizedArea ||
        row.province.toLowerCase() === normalizedArea ||
        row.city.toLowerCase() === normalizedArea;
      const matchesAgent = !selectedAgentName || row.assignedTo.toLowerCase() === selectedAgentName;
      return matchesSearch && matchesArea && matchesAgent;
    });

    return {
      priority: rows.filter((row) => row.purchaseAgeGroup === 'two_weeks_to_one_month'),
      recovery: rows.filter((row) => row.purchaseAgeGroup === 'over_one_month'),
      verified: [],
      unverified: [],
    };
  }, [masterListRows, agentById, agentFilter, areaFilter, search]);

  const filteredInteractions = useMemo(() => {
    const customerSet = new Set(baseFilteredCustomers.map((customer) => customer.id));
    return interactions.filter((item) => customerSet.has(item.customerId));
  }, [interactions, baseFilteredCustomers]);

  const monthStart = startOfMonth(new Date());

  const kpis = useMemo(() => {
    const quota = agents.reduce((sum, agent) => sum + agent.quota, 0);
    const actualSales = filteredInteractions
      .filter((item) => item.type === 'purchase' && parseISO(item.date) >= monthStart)
      .reduce((sum, item) => sum + (item.amount || 0), 0);

    const activeDeals = baseFilteredCustomers.filter((customer) => customer.dealStatus === 'Open' || customer.dealStatus === 'Follow-up').length;

    const callText = filteredInteractions.filter((item) => item.type === 'call' || item.type === 'text');
    const success = callText.filter((item) => item.outcome === 'Successful').length;
    const today = new Date();

    const callsToday = filteredInteractions.filter((item) => item.type === 'call' && isSameDay(parseISO(item.date), today)).length;
    const callsMTD = filteredInteractions.filter((item) => item.type === 'call' && parseISO(item.date) >= monthStart).length;
    const textsToday = filteredInteractions.filter((item) => item.type === 'text' && isSameDay(parseISO(item.date), today)).length;
    const textsMTD = filteredInteractions.filter((item) => item.type === 'text' && parseISO(item.date) >= monthStart).length;

    return {
      quota,
      actualSales,
      totalRevenue: actualSales,
      activeDeals,
      successPercent: callText.length ? Math.round((success / callText.length) * 100) : 0,
      callsToday,
      callsMTD,
      textsToday,
      textsMTD,
    };
  }, [agents, filteredInteractions, baseFilteredCustomers, monthStart]);

  const effectiveMonthlyTarget = monthlyTargetOverride ?? kpis.quota;

  const categoryLists = useMemo(() => {
    const mapCategory = (category: CustomerCategory) => baseFilteredCustomers.filter((customer) => customer.category === category);

    return {
      activeNoPurchase: mapCategory('active-buyers-no-purchase'),
      inactivePositive: mapCategory('inactive-positives'),
      prospectivePositive: mapCategory('prospective-positives'),
      inactiveNegative: mapCategory('inactive-negatives'),
      blacklisted: baseFilteredCustomers.filter((c) => c.category === 'blacklisted'),
      negativeProspects: baseFilteredCustomers.filter((c) => c.category === 'negative-prospects'),
    };
  }, [baseFilteredCustomers]);

  const templateRevenueTrendData = useMemo(() => {
    const today = new Date();
    const days = Array.from({ length: 30 }, (_, index) => subDays(today, 29 - index));
    const dayKeys = days.map((day) => format(day, 'yyyy-MM-dd'));
    const dayLabels = days.map((day) => format(day, 'MMM d'));

    const categoryIds = {
      priority: new Set(categoryLists.activeNoPurchase.map((customer) => customer.id)),
      recovery: new Set(categoryLists.inactivePositive.map((customer) => customer.id)),
      verified: new Set(categoryLists.prospectivePositive.map((customer) => customer.id)),
    };

    const dailySum = (customerIds: Set<string>, dateKey: string) =>
      filteredInteractions
        .filter(
          (item) =>
            item.type === 'purchase' && item.date === dateKey && customerIds.has(item.customerId)
        )
        .reduce((sum, item) => sum + (item.amount || 0), 0);

    const toCumulative = (values: number[]) => {
      let running = 0;
      return values.map((value) => {
        running += value;
        return running;
      });
    };

    const priorityDaily = dayKeys.map((dateKey) => dailySum(categoryIds.priority, dateKey));
    const recoveryDaily = dayKeys.map((dateKey) => dailySum(categoryIds.recovery, dateKey));
    const verifiedDaily = dayKeys.map((dateKey) => dailySum(categoryIds.verified, dateKey));
    const totalDaily = dayKeys.map((dateKey) =>
      filteredInteractions
        .filter((item) => item.type === 'purchase' && item.date === dateKey)
        .reduce((sum, item) => sum + (item.amount || 0), 0)
    );

    return {
      dayLabels,
      series: [
        {
          id: 'priority',
          label: 'Priority List Sales',
          data: toCumulative(priorityDaily),
          color: '#078b3e',
        },
        {
          id: 'recovery',
          label: 'Recovery List Sales',
          data: toCumulative(recoveryDaily),
          color: '#e31219',
        },
        {
          id: 'verified',
          label: 'Verified Prospects Converted',
          data: toCumulative(verifiedDaily),
          color: '#1262d6',
        },
        {
          id: 'total',
          label: 'Total Actual Sales',
          data: toCumulative(totalDaily),
          color: '#7c3aed',
        },
      ],
    };
  }, [filteredInteractions, categoryLists]);

  const selectedCustomer = selectedCustomerId ? customerById[selectedCustomerId] : null;

  const selectedCustomerInteractions = useMemo(() => {
    if (!selectedCustomer) return [];
    return interactions
      .filter((item) => item.customerId === selectedCustomer.id)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [selectedCustomer, interactions]);

  const purchaseHistory = selectedCustomerInteractions.filter((item) => item.type === 'purchase');
  const returnHistory = selectedCustomerInteractions.filter((item) => item.type === 'return');
  const inquiryHistory = selectedCustomerInteractions.filter((item) => item.type === 'inquiry');

  const groupedReports = useMemo(() => {
    return {
      'Incident Reports': reports.filter((report) => report.type === 'Incident Reports'),
      Returns: reports.filter((report) => report.type === 'Returns'),
      'Sales Reports': reports.filter((report) => report.type === 'Sales Reports'),
    };
  }, [reports]);

  const queueReports = useMemo(() => {
    if (!selectedQueueType) return reports;
    return reports.filter((report) => report.type === selectedQueueType);
  }, [reports, selectedQueueType]);

  const attendance = useMemo(() => {
    const online = agents.filter((agent) => agent.online);
    return {
      online,
      offline: agents.filter((agent) => !agent.online),
    };
  }, [agents]);

  const alerts = useMemo<AlertItem[]>(() => {
    const noActivityCustomers = baseFilteredCustomers.filter((customer) => differenceInDays(new Date(), parseISO(customer.lastContactAt)) > 30);
    const inquiriesNoPurchase = baseFilteredCustomers.filter((customer) => {
      const customerInquiries = interactions.filter((item) => item.customerId === customer.id && item.type === 'inquiry').length;
      const purchasesCount = interactions.filter((item) => item.customerId === customer.id && item.type === 'purchase').length;
      return customerInquiries > 2 && purchasesCount === 0;
    });

    const generated: AlertItem[] = [];

    if (noActivityCustomers.length) {
      generated.push({
        id: 'alert-reassign',
        type: 'reassignment',
        title: `${noActivityCustomers.length} customers with no activity > 30 days`,
        customers: noActivityCustomers,
      });
    }

    if (inquiriesNoPurchase.length) {
      generated.push({
        id: 'alert-price',
        type: 'price',
        title: `${inquiriesNoPurchase.length} customers with >2 inquiries and no purchase`,
        customers: inquiriesNoPurchase,
      });
    }

    return generated;
  }, [baseFilteredCustomers, interactions]);

  const customerCategorySummaries = useMemo<CustomerCategorySummary[]>(() => {
    const summarize = (
      id: CustomerCategoryId,
      label: string,
      rows: DailyCallMasterCustomerRow[],
      tone: CustomerCategorySummary['tone'],
      note: string
    ): CustomerCategorySummary => {
      const sales = rows.reduce((sum, row) => sum + row.currentMonthSales, 0);
      const potential = rows.reduce((sum, row) => sum + row.totalSales, 0);

      return {
        id,
        label,
        customers: rows.length,
        currentSales: sales,
        averageSales: rows.length ? Math.round(potential / rows.length) : 0,
        potentialSales: potential,
        note,
        tone,
      };
    };

    return [
      summarize('priority', 'Priority List', masterListCategoryRows.priority, 'green', '15-30 days since last purchase'),
      summarize('recovery', 'Recovery List', masterListCategoryRows.recovery, 'red', 'Over 1 month since last purchase'),
      summarize('verified', 'Verified Prospects', masterListCategoryRows.verified, 'blue', 'Empty for now'),
      summarize('unverified', 'Unverified Prospects', masterListCategoryRows.unverified, 'orange', 'Empty for now'),
    ];
  }, [masterListCategoryRows]);

  const successfulOutcomes = filteredInteractions.filter((item) => item.outcome === 'Successful').length;

  const templateMetrics = useMemo(
    () =>
      buildOwnerDashboardMetrics({
        actualSales: kpis.actualSales,
        monthlyTarget: effectiveMonthlyTarget,
        categoryPotential: customerCategorySummaries.map((item) => item.potentialSales),
        calls: kpis.callsMTD,
        texts: kpis.textsMTD,
        successfulOutcomes,
      }),
    [kpis, customerCategorySummaries, successfulOutcomes, effectiveMonthlyTarget]
  );

  const interactionCount = (type: InteractionType, outcome?: Outcome) =>
    filteredInteractions.filter(
      (item) => item.type === type && (!outcome || item.outcome === outcome)
    ).length;

  const caseSummaries = useMemo(
    () => [
      {
        label: 'Inquiry & Orders',
        open: interactionCount('inquiry'),
        pending: interactionCount('inquiry', 'Pending'),
        tone: 'blue',
      },
      {
        label: 'Delivery Issues',
        open: interactionCount('return'),
        pending: interactionCount('return', 'Pending'),
        tone: 'green',
      },
      {
        label: 'Quality Issues',
        open: interactionCount('call', 'Rejected'),
        pending: interactionCount('text', 'Rejected'),
        tone: 'orange',
      },
      {
        label: 'Incident Reports',
        open: groupedReports['Incident Reports'].length,
        pending: groupedReports['Incident Reports'].filter((item) => item.status === 'pending').length,
        tone: 'violet',
      },
      {
        label: 'Sales Returns',
        open: groupedReports.Returns.length,
        pending: groupedReports.Returns.filter((item) => item.status === 'pending').length,
        tone: 'red',
      },
    ],
    [filteredInteractions, groupedReports]
  );

  const notificationSummaries = useMemo(
    () => [
      {
        label: 'Incident Reports Awaiting Approval',
        count: groupedReports['Incident Reports'].filter((item) => item.status === 'pending').length,
      },
      {
        label: 'Delivery Issues Awaiting Approval',
        count: interactionCount('return', 'Pending'),
      },
      {
        label: 'Sales Inquiries Awaiting Response',
        count: interactionCount('inquiry', 'Pending'),
      },
      {
        label: 'Sales Returns Awaiting Approval',
        count: groupedReports.Returns.filter((item) => item.status === 'pending').length,
      },
      {
        label: 'Sales Reports Awaiting Approval',
        count: groupedReports['Sales Reports'].filter((item) => item.status === 'pending').length,
      },
    ],
    [groupedReports, filteredInteractions]
  );

  const actionSummaries = useMemo(
    () => [
      {
        label: 'Incident Reports Awaiting Approval',
        count: groupedReports['Incident Reports'].filter((item) => item.status === 'pending').length,
      },
      {
        label: 'Sales Returns Awaiting Approval',
        count: groupedReports.Returns.filter((item) => item.status === 'pending').length,
      },
      {
        label: 'Recovery Customers Not Contacted',
        count: categoryLists.inactivePositive.length,
      },
      {
        label: 'VIP Customers Near Qualification',
        count: baseFilteredCustomers.filter((item) => item.creditLimit >= 500_000).length,
      },
      {
        label: 'Customers Not Contacted This Month',
        count: baseFilteredCustomers.filter(
          (item) => differenceInDays(new Date(), parseISO(item.lastContactAt)) >= getDate(new Date())
        ).length,
      },
      {
        label: 'Verified Prospects Not Called',
        count: categoryLists.prospectivePositive.length,
      },
      {
        label: 'Unverified Prospects Pending Verification',
        count: categoryLists.inactiveNegative.length,
      },
    ],
    [groupedReports, categoryLists, baseFilteredCustomers]
  );

  const agentPerformanceSummaries = useMemo(
    () =>
      [...agents]
        .sort((a, b) => b.salesMTD - a.salesMTD)
        .slice(0, 3)
        .map((agent) => ({
          name: agent.name,
          calls: filteredInteractions.filter(
            (item) =>
              item.agentId === agent.id && item.type === 'call' && parseISO(item.date) >= monthStart
          ).length,
          actualSales: agent.salesMTD,
          target: agent.quota,
          achievement: agent.quota > 0 ? Number(((agent.salesMTD / agent.quota) * 100).toFixed(1)) : 0,
        })),
    [agents, filteredInteractions, monthStart]
  );

  const outcomeRows = useMemo<OutcomeRow[]>(() => {
    if (!selectedOutcome) return [];

    return filteredInteractions
      .filter((item) => item.outcome === selectedOutcome)
      .map((item) => ({
        id: item.id,
        customer: customerById[item.customerId]?.name || 'Unknown',
        agent: agentById[item.agentId]?.name || 'Unknown',
        outcome: item.outcome,
        date: item.date,
        customerId: item.customerId,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredInteractions, selectedOutcome, customerById, agentById]);

  const dealStatusRows = useMemo<DealStatusRow[]>(() => {
    if (!selectedDealStatus) return [];

    return baseFilteredCustomers
      .filter((customer) => customer.dealStatus === selectedDealStatus)
      .map((customer) => ({
        id: customer.id,
        customer: customer.name,
        area: customer.locationArea,
        agent: agentById[customer.agentId]?.name || 'Unknown',
        status: customer.dealStatus,
        lastContactAt: customer.lastContactAt,
        customerId: customer.id,
      }))
      .sort((a, b) => b.lastContactAt.localeCompare(a.lastContactAt));
  }, [baseFilteredCustomers, selectedDealStatus, agentById]);

  const outcomeColumns = useMemo<ColumnDef<OutcomeRow>[]>(
    () => [
      { accessorKey: 'customer', header: 'Customer' },
      { accessorKey: 'agent', header: 'Agent' },
      { accessorKey: 'outcome', header: 'Outcome' },
      {
        accessorKey: 'date',
        header: 'Date',
        cell: ({ row }) => format(parseISO(row.original.date), 'MMM d, yyyy'),
      },
      {
        id: 'actions',
        header: 'Action',
        cell: ({ row }) => (
          <button
            onClick={() => {
              setSelectedCustomerId(row.original.customerId);
              setShowOutcomeDialog(false);
            }}
            className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Open Customer
          </button>
        ),
      },
    ],
    []
  );

  const outcomeTable = useReactTable({
    data: outcomeRows,
    columns: outcomeColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  const dealStatusColumns = useMemo<ColumnDef<DealStatusRow>[]>(
    () => [
      { accessorKey: 'customer', header: 'Customer' },
      { accessorKey: 'area', header: 'Area' },
      { accessorKey: 'agent', header: 'Agent' },
      { accessorKey: 'status', header: 'Status' },
      {
        accessorKey: 'lastContactAt',
        header: 'Last Contact',
        cell: ({ row }) => format(parseISO(row.original.lastContactAt), 'MMM d, yyyy'),
      },
      {
        id: 'actions',
        header: 'Action',
        cell: ({ row }) => (
          <button
            onClick={() => {
              setSelectedCustomerId(row.original.customerId);
              setShowDealStatusDialog(false);
            }}
            className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Open Customer
          </button>
        ),
      },
    ],
    []
  );

  const dealStatusTable = useReactTable({
    data: dealStatusRows,
    columns: dealStatusColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  const updateReport = (reportId: string, patch: Partial<ReportItem>) => {
    setReports((prev) =>
      prev.map((report) =>
        report.id === reportId
          ? {
              ...report,
              ...patch,
            }
          : report
      )
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-100 p-3.5 pt-1 lg:p-3.5 lg:pt-1">
      <div className="mx-auto w-full max-w-[1700px] shrink-0 space-y-2">
        {isLoadingSnapshot && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
            Loading live dashboard data from local MySQL API...
          </div>
        )}
        {snapshotError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {snapshotError}
          </div>
        )}
      </div>
      <DashboardViewportFit revision={isLoadingSnapshot}>
        <OwnerDashboardTemplate
          dateLabel={format(new Date(), 'MMMM d, yyyy')}
          monthLabel={format(new Date(), 'MMMM yyyy')}
          currentSales={kpis.actualSales}
          monthlyTarget={effectiveMonthlyTarget}
          remainingTarget={templateMetrics.remainingTarget}
          totalPotential={templateMetrics.totalPotential}
          targetAchieved={templateMetrics.targetAchieved}
          pipelineVsTarget={templateMetrics.pipelineVsTarget}
          customerCategories={customerCategorySummaries}
          revenueSeries={templateRevenueTrendData.series}
          revenueDays={templateRevenueTrendData.dayLabels}
          monthlyTargetLine={effectiveMonthlyTarget}
          cases={caseSummaries}
          notifications={notificationSummaries}
          actions={actionSummaries}
          attendance={{ present: attendance.online.length, absent: attendance.offline.length }}
          agents={agentPerformanceSummaries}
          activity={{
            calls: kpis.callsMTD,
            texts: kpis.textsMTD,
            aiSms: 0,
            successfulOutcomes,
            conversionRate: templateMetrics.conversionRate,
          }}
          search={search}
          selectedAgentId={agentFilter}
          agentOptions={agents.map(({ id, name }) => ({ id, name }))}
          onSearchChange={setSearch}
          onAgentChange={setAgentFilter}
          onResetFilters={() => {
            setSearch('');
            setAgentFilter(null);
            setAreaFilter(null);
          }}
          onOpenCategory={(id) => {
            const categoryCustomers =
              id === 'priority'
                ? categoryLists.activeNoPurchase
                : id === 'verified'
                  ? categoryLists.prospectivePositive
                  : id === 'recovery'
                    ? categoryLists.inactivePositive
                    : categoryLists.inactiveNegative;
            if (categoryCustomers[0]) {
              setSelectedCustomerId(categoryCustomers[0].id);
            }
          }}
          onOpenNotifications={() => {
            setSelectedQueueType(null);
            setShowQueueDialog(true);
          }}
          onOpenAttendance={() => setShowAttendanceDialog(true)}
          onOpenActionList={() => {
            if (alerts[0]) {
              setActiveAlert(alerts[0]);
              setShowAlertDialog(true);
            }
          }}
          canEditMonthlyTarget={canEditMonthlyTarget}
          onSaveMonthlyTarget={(value) => {
            setMonthlyTargetOverride(value);
            try {
              localStorage.setItem(monthlyTargetStorageKey, String(value));
            } catch {
              // ignore local persistence errors
            }
          }}
        />
      </DashboardViewportFit>


      {selectedCustomer && (
        <div className="fixed inset-0 z-40">
          <button onClick={() => setSelectedCustomerId(null)} className="absolute inset-0 bg-slate-900/40" aria-label="Close patient history" />
          <div className="absolute right-0 top-0 h-full w-full max-w-[460px] overflow-auto border-l border-slate-200 bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-800">Patient History</h3>
                <p className="text-sm text-slate-500">{selectedCustomer.name} · {selectedCustomer.locationArea}</p>
              </div>
              <button onClick={() => setSelectedCustomerId(null)} className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <p className="text-slate-500">Purchase total</p>
                  <p className="font-bold text-slate-800">{toCurrency(purchaseHistory.reduce((sum, item) => sum + (item.amount || 0), 0))}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <p className="text-slate-500">Returns total</p>
                  <p className="font-bold text-slate-800">{toCurrency(returnHistory.reduce((sum, item) => sum + (item.amount || 0), 0))}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <p className="text-slate-500">Credit Limit</p>
                  <p className="font-bold text-slate-800">{toCurrency(selectedCustomer.creditLimit)}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <p className="text-slate-500">Remaining Credit</p>
                  <p className="font-bold text-slate-800">{toCurrency(selectedCustomer.creditLimit - selectedCustomer.ledgerBalance)}</p>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-2">
                <p className="mb-1 text-xs font-semibold text-slate-700">Purchase History</p>
                <div className="max-h-32 space-y-1 overflow-auto text-xs">
                  {purchaseHistory.length === 0 ? (
                    <p className="text-slate-500">No purchase records.</p>
                  ) : (
                    purchaseHistory.map((item) => (
                      <p key={item.id} className="text-slate-600">{format(parseISO(item.date), 'MMM d')} · {toCurrency(item.amount || 0)}</p>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-2">
                <p className="mb-1 text-xs font-semibold text-slate-700">Return History</p>
                <div className="max-h-28 space-y-1 overflow-auto text-xs">
                  {returnHistory.length === 0 ? <p className="text-slate-500">No return records.</p> : returnHistory.map((item) => <p key={item.id} className="text-slate-600">{format(parseISO(item.date), 'MMM d')} · {item.itemName} · {toCurrency(item.amount || 0)}</p>)}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-2">
                <p className="mb-1 text-xs font-semibold text-slate-700">Inquiry History</p>
                <div className="max-h-28 space-y-1 overflow-auto text-xs">
                  {inquiryHistory.length === 0 ? <p className="text-slate-500">No inquiry records.</p> : inquiryHistory.map((item) => <p key={item.id} className="text-slate-600">{format(parseISO(item.date), 'MMM d')} · {item.outcome}</p>)}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-2">
                <p className="mb-1 text-xs font-semibold text-slate-700">RTO Timeline</p>
                <div className="max-h-28 space-y-1 overflow-auto text-xs">
                  {returnHistory.length === 0 ? <p className="text-slate-500">No RTO events.</p> : returnHistory.map((item) => <p key={item.id} className="text-amber-700">{format(parseISO(item.date), 'MMM d, yyyy')} · {item.itemName}</p>)}
                </div>
              </div>

              <div>
                <p className="mb-1 text-xs font-semibold text-slate-700">Notes / Instructions</p>
                <textarea
                  value={notesByCustomer[selectedCustomer.id] || ''}
                  onChange={(event) =>
                    setNotesByCustomer((prev) => ({
                      ...prev,
                      [selectedCustomer.id]: event.target.value,
                    }))
                  }
                  rows={4}
                  className="w-full rounded-lg border border-slate-200 px-2 py-2 text-xs focus:border-blue-500 focus:outline-none"
                  placeholder="Saved locally for owner read-state and instructions"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {showOutcomeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Outcome Details: {selectedOutcome}</h3>
              <button onClick={() => setShowOutcomeDialog(false)} className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[420px] overflow-auto rounded-lg border border-slate-200">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 bg-slate-50">
                  {outcomeTable.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th key={header.id} className="border-b border-slate-200 px-2 py-2 font-semibold text-slate-700">
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {outcomeTable.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-2 py-2 text-slate-700">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showDealStatusDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Deal Status Details: {selectedDealStatus}</h3>
              <button onClick={() => setShowDealStatusDialog(false)} className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[420px] overflow-auto rounded-lg border border-slate-200">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 bg-slate-50">
                  {dealStatusTable.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th key={header.id} className="border-b border-slate-200 px-2 py-2 font-semibold text-slate-700">
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {dealStatusTable.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-2 py-2 text-slate-700">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showReportDialog && activeReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">{activeReport.title}</h3>
              <button onClick={() => setShowReportDialog(false)} className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              {activeReport.type} · Submitted by {activeReport.submittedBy} on {format(parseISO(activeReport.createdAt), 'MMM d, yyyy')}
            </p>
            <p className="mt-3 text-xs text-slate-500">Mock approval content. Use Approve / Reject to update status and persist read-state in localStorage.</p>
          </div>
        </div>
      )}

      {showQueueDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-[1300px] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-700">
                Notifications + Approvals Queue
                {selectedQueueType ? ` · ${selectedQueueType}` : ''}
              </h3>
              <button onClick={() => setShowQueueDialog(false)} className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid max-h-[65vh] gap-2 overflow-auto lg:grid-cols-3">
              {queueReports.map((report) => (
                <div
                  key={report.id}
                  className={`rounded-xl border p-3 ${report.read ? 'border-blue-200 bg-blue-50/40' : 'border-slate-300 bg-slate-100'}`}
                >
                  <p className="text-xs font-semibold text-slate-700">{report.title}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {report.type} · {report.submittedBy} · {format(parseISO(report.createdAt), 'MMM d, yyyy')}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700"
                      onClick={() => {
                        setActiveReport(report);
                        setShowQueueDialog(false);
                        setShowReportDialog(true);
                      }}
                    >
                      Open
                    </button>
                    <button className="rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white" onClick={() => updateReport(report.id, { status: 'approved' })}>
                      Approve
                    </button>
                    <button className="rounded-md bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white" onClick={() => updateReport(report.id, { status: 'rejected' })}>
                      Reject
                    </button>
                    <button className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700" onClick={() => updateReport(report.id, { read: true })}>
                      Mark read
                    </button>
                  </div>
                </div>
              ))}
              {queueReports.length === 0 && (
                <p className="rounded-lg border border-slate-200 p-3 text-xs text-slate-500">No reports in this category.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {showAttendanceDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Attendance Details</h3>
              <button onClick={() => setShowAttendanceDialog(false)} className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              <span className="font-semibold text-emerald-600">{attendance.online.length}</span> online / {attendance.offline.length} offline
            </p>
            <div className="max-h-[60vh] overflow-auto rounded-lg border border-slate-200">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <th className="border-b border-slate-200 px-2 py-2 font-semibold text-slate-700">Agent</th>
                    <th className="border-b border-slate-200 px-2 py-2 font-semibold text-slate-700">Status</th>
                    <th className="border-b border-slate-200 px-2 py-2 font-semibold text-slate-700">Calls Today</th>
                    <th className="border-b border-slate-200 px-2 py-2 font-semibold text-slate-700">Texts Today</th>
                    <th className="border-b border-slate-200 px-2 py-2 font-semibold text-slate-700">Success Rate</th>
                    <th className="border-b border-slate-200 px-2 py-2 font-semibold text-slate-700">Sales MTD</th>
                    <th className="border-b border-slate-200 px-2 py-2 font-semibold text-slate-700">Quota</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((agent) => (
                    <tr key={agent.id} className="border-b border-slate-100">
                      <td className="px-2 py-2 font-medium text-slate-700">{agent.name}</td>
                      <td className="px-2 py-2">
                        <span className={`rounded-full px-2 py-0.5 font-semibold ${agent.online ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {agent.online ? 'Online' : 'Offline'}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-slate-700">{agent.callsToday}</td>
                      <td className="px-2 py-2 text-slate-700">{agent.textsToday}</td>
                      <td className="px-2 py-2 text-slate-700">{Math.round(agent.successRate * 100)}%</td>
                      <td className="px-2 py-2 text-slate-700">{toCurrency(agent.salesMTD)}</td>
                      <td className="px-2 py-2 text-slate-700">{toCurrency(agent.quota)}</td>
                    </tr>
                  ))}
                  {agents.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-2 py-3 text-center text-slate-500">
                        No attendance records available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showAlertDialog && activeAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Management Alert</h3>
              <button onClick={() => setShowAlertDialog(false)} className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-3 text-xs text-slate-600">{activeAlert.title}</p>
            <div className="max-h-[320px] space-y-2 overflow-auto">
              {activeAlert.customers.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => {
                    setSelectedCustomerId(customer.id);
                    setShowAlertDialog(false);
                  }}
                  className="w-full rounded-lg border border-slate-200 p-2 text-left hover:border-blue-400"
                >
                  <p className="text-sm font-semibold text-slate-800">{customer.name}</p>
                  <p className="text-xs text-slate-500">{customer.locationArea} · {CATEGORY_LABEL[customer.category]}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerLiveCallMonitoringView;
