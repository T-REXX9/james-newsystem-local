import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Check,
  Flag,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  MessageSquare,
  Phone,
  PhilippinePeso,
  Search,
  TrendingUp,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { BarChart as MuiBarChart, PieChart as MuiPieChart } from '@mui/x-charts';
import { LineChartPro as MuiLineChartPro } from '@mui/x-charts-pro/LineChartPro';
import {
  differenceInDays,
  format,
  getDate,
  getDaysInMonth,
  isSameDay,
  parseISO,
  startOfMonth,
  subMonths,
  subDays,
} from 'date-fns';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import SalesMap from './SalesMap';
import { UserProfile } from '../types';

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

const OUTCOME_COLORS: Record<Outcome, string> = {
  Successful: '#16a34a',
  'Follow-up': '#f59e0b',
  'No Answer': '#0ea5e9',
  Rejected: '#ef4444',
  Pending: '#6b7280',
};

const DEAL_COLOR_BY_STATUS: Record<DealStatus, string> = {
  Open: '#2563eb',
  Won: '#16a34a',
  Lost: '#ef4444',
  'Follow-up': '#f59e0b',
};

const NOTES_KEY = 'owner-daily-call-notes';
const REPORTS_KEY = 'owner-daily-call-reports-state';

const CATEGORY_LABEL: Record<CustomerCategory, string> = {
  'active-buyers-no-purchase': 'Active buyer',
  'inactive-positives': 'Inactive positive',
  'prospective-positives': 'Prospective positive',
  'inactive-negatives': 'Inactive negative',
  blacklisted: 'Blacklisted',
  'negative-prospects': 'Negative prospect',
};

const STATUS_BADGE: Record<DealStatus, string> = {
  Open: 'bg-blue-100 text-blue-700',
  Won: 'bg-emerald-100 text-emerald-700',
  Lost: 'bg-rose-100 text-rose-700',
  'Follow-up': 'bg-amber-100 text-amber-700',
};

const parseProvinceFromMapText = (text?: string | null): string | null => {
  if (!text) return null;
  const match = text.match(/Showing data for\s+(.+?)\s+Region/i);
  return match?.[1]?.trim() || null;
};

const toCurrency = (value: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value);

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || 'http://127.0.0.1:8080/api/v1';
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

const BlackBoxMap = SalesMap as React.ComponentType<{
  selectedArea?: string | null;
  selectedAgentId?: string | null;
  onAreaSelect?: (area: string | null) => void;
}>;

interface MapBridgeProps {
  selectedArea: string | null;
  selectedAgentId: string | null;
  onAreaSelect: (area: string | null) => void;
}

const MapBridge: React.FC<MapBridgeProps> = ({ selectedArea, selectedAgentId, onAreaSelect }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const target = containerRef.current;
    if (!target) return;

    let lastArea: string | null = null;

    const detectArea = () => {
      const text = target.textContent;
      const parsed = parseProvinceFromMapText(text);
      if (parsed !== lastArea) {
        lastArea = parsed;
        onAreaSelect(parsed);
      }
    };

    const observer = new MutationObserver(detectArea);
    observer.observe(target, { childList: true, subtree: true, characterData: true });
    detectArea();

    return () => observer.disconnect();
  }, [onAreaSelect]);

  return (
    <div ref={containerRef} className="h-[430px] rounded-2xl overflow-hidden border border-slate-200 bg-white">
      <BlackBoxMap selectedArea={selectedArea} selectedAgentId={selectedAgentId} onAreaSelect={onAreaSelect} />
    </div>
  );
};

const OwnerLiveCallMonitoringView: React.FC<OwnerLiveCallMonitoringViewProps> = ({ currentUser }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [interactions, setInteractions] = useState<InteractionItem[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(true);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [agentFilter, setAgentFilter] = useState<string | null>(null);
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [listTab, setListTab] = useState<'priority' | 'inactive' | 'prospective' | 'negative'>('priority');
  const [search, setSearch] = useState('');
  const [showGarbage, setShowGarbage] = useState(false);
  const [mobileTab, setMobileTab] = useState<'overview' | 'customers' | 'map' | 'reports'>('overview');
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

  const [notesByCustomer, setNotesByCustomer] = useState<Record<string, string>>(() => STORAGE_HELPER.readNotes());
  const [reports, setReports] = useState<ReportItem[]>(() => STORAGE_HELPER.readReports(seedReports()));

  const loadSnapshot = useCallback(async () => {
    setIsLoadingSnapshot(true);
    setSnapshotError(null);

    try {
      const params = new URLSearchParams({
        main_id: String((currentUser as any)?.main_id || (currentUser as any)?.main_userid || API_MAIN_ID),
      });
      const response = await fetch(`${API_BASE_URL}/daily-call-monitoring/owner-snapshot?${params.toString()}`);
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
        ...callLogs.map((log) => {
          const contact = contactById.get(log.contact_id);
          const fallbackAgent = contact ? contactAgentId.get(contact.id) : undefined;
          const resolvedAgent = resolveAgent(log.agent_name, 'Unassigned');
          return {
            id: `call-${log.id}`,
            customerId: log.contact_id,
            agentId: log.agent_name ? resolvedAgent.id : fallbackAgent || resolvedAgent.id,
            type: (log.channel || '').toLowerCase().includes('text') || (log.channel || '').toLowerCase().includes('sms') ? 'text' : 'call',
            outcome: mapCallOutcome(log.outcome),
            date: toDateKey(log.occurred_at),
          };
        }),
        ...inquiries.map((inquiry) => {
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
        ...purchases.map((purchase) => ({
          id: `purchase-${purchase.id}`,
          customerId: purchase.contact_id,
          agentId: contactAgentId.get(purchase.contact_id) || 'agent:unassigned',
          type: 'purchase' as const,
          outcome: 'Successful' as const,
          date: toDateKey(purchase.purchase_date),
          amount: Number(purchase.total_amount || 0),
        })),
        ...returns.map((item) => ({
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
        const dealStatus = customer.dealStatus === 'Open'
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
      setInteractions(generatedInteractions);
      setAgents(derivedAgents.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Error loading owner live call monitoring snapshot:', error);
      setCustomers([]);
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

  const quotaGauge = useMemo(() => {
    const percent = kpis.quota > 0 ? Math.min(100, Math.round((kpis.actualSales / kpis.quota) * 100)) : 0;
    const remaining = Math.max(0, kpis.quota - kpis.actualSales);
    const daysRemaining = Math.max(1, getDaysInMonth(new Date()) - getDate(new Date()) + 1);
    const weeksRemaining = Math.max(1, Math.ceil(daysRemaining / 7));

    return {
      percent,
      remaining,
      leftPercent: Math.max(0, 100 - percent),
      dailyTarget: remaining > 0 ? Math.ceil(remaining / daysRemaining) : 0,
      weeklyTarget: remaining > 0 ? Math.ceil(remaining / weeksRemaining) : 0,
    };
  }, [kpis.actualSales, kpis.quota]);

  const revenueTrendData = useMemo(() => {
    const today = new Date();
    const currentMonthStart = startOfMonth(today);
    const lastMonthStart = startOfMonth(subMonths(today, 1));
    const currentDayOfMonth = getDate(today);
    const currentMonthDays = getDaysInMonth(currentMonthStart);
    const lastMonthDays = getDaysInMonth(lastMonthStart);
    const points = Array.from({ length: Math.max(currentDayOfMonth, 1) }, (_v, i) => i + 1);

    const purchaseRevenueByDate = filteredInteractions.reduce<Record<string, number>>((acc, item) => {
      if (item.type !== 'purchase') return acc;
      acc[item.date] = (acc[item.date] || 0) + (item.amount || 0);
      return acc;
    }, {});

    const currentYear = currentMonthStart.getFullYear();
    const currentMonth = currentMonthStart.getMonth();
    const lastYear = lastMonthStart.getFullYear();
    const lastMonth = lastMonthStart.getMonth();

    const currentMonthSeries = points.map((day) => {
      if (day > currentMonthDays) return 0;
      const dateKey = format(new Date(currentYear, currentMonth, day), 'yyyy-MM-dd');
      return purchaseRevenueByDate[dateKey] || 0;
    });

    const lastMonthSeries = points.map((day) => {
      if (day > lastMonthDays) return 0;
      const dateKey = format(new Date(lastYear, lastMonth, day), 'yyyy-MM-dd');
      return purchaseRevenueByDate[dateKey] || 0;
    });

    return {
      xAxis: points.map((_value, index) => index),
      dayLabels: points,
      series: [
        {
          id: 'last-month',
          label: format(lastMonthStart, 'MMM yyyy'),
          data: lastMonthSeries,
          color: '#94a3b8',
          curve: 'monotoneX' as const,
        },
        {
          id: 'current-month',
          label: format(currentMonthStart, 'MMM yyyy'),
          data: currentMonthSeries,
          color: '#16a34a',
          curve: 'monotoneX' as const,
        },
      ],
    };
  }, [filteredInteractions]);

  const dealStatusData = useMemo(() => {
    const counts = baseFilteredCustomers.reduce<Record<DealStatus, number>>(
      (acc, customer) => {
        acc[customer.dealStatus] += 1;
        return acc;
      },
      { Open: 0, Won: 0, Lost: 0, 'Follow-up': 0 }
    );

    return (Object.keys(counts) as DealStatus[]).map((status) => ({
      name: status,
      value: counts[status],
    }));
  }, [baseFilteredCustomers]);

  const dealStatusPieData = useMemo(
    () =>
      dealStatusData.map((item) => ({
        id: item.name,
        value: item.value,
        label: item.name,
        color: DEAL_COLOR_BY_STATUS[item.name as DealStatus],
      })),
    [dealStatusData]
  );

  const geographicRevenueData = useMemo(() => {
    const areaTotals = filteredInteractions.reduce<Record<string, number>>((acc, item) => {
      if (item.type !== 'purchase') return acc;
      const area = customerById[item.customerId]?.locationArea || 'Unknown';
      acc[area] = (acc[area] || 0) + (item.amount || 0);
      return acc;
    }, {});

    return Object.entries(areaTotals).map(([name, value]) => ({ name, value }));
  }, [filteredInteractions, customerById]);

  const perAgentSeries = useMemo(() => {
    return agents
      .filter((agent) => !agentFilter || agent.id === agentFilter)
      .map((agent) => {
        const calls = filteredInteractions.filter((item) => item.agentId === agent.id && item.type === 'call').length;
        const texts = filteredInteractions.filter((item) => item.agentId === agent.id && item.type === 'text').length;
        const callText = filteredInteractions.filter((item) => item.agentId === agent.id && (item.type === 'call' || item.type === 'text'));
        const successful = callText.filter((item) => item.outcome === 'Successful').length;

        return {
          name: agent.name,
          calls,
          texts,
          successRate: callText.length ? Math.round((successful / callText.length) * 100) : 0,
          sales: agent.salesMTD,
        };
      });
  }, [agents, filteredInteractions, agentFilter]);

  const outcomeData = useMemo(() => {
    const counts = filteredInteractions.reduce<Record<Outcome, number>>(
      (acc, item) => {
        if (item.type === 'call' || item.type === 'text' || item.type === 'inquiry') {
          acc[item.outcome] += 1;
        }
        return acc;
      },
      { Successful: 0, 'Follow-up': 0, 'No Answer': 0, Rejected: 0, Pending: 0 }
    );

    return (Object.keys(counts) as Outcome[]).map((outcome) => ({
      name: outcome,
      value: counts[outcome],
    }));
  }, [filteredInteractions]);

  const outcomePieData = useMemo(
    () =>
      outcomeData.map((item) => ({
        id: item.name,
        value: item.value,
        label: item.name,
        color: OUTCOME_COLORS[item.name as Outcome],
      })),
    [outcomeData]
  );

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

  const unreadCount = reports.filter((report) => !report.read).length;

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

  const renderListRows = (items: Customer[]) => {
    return (
      <div className="space-y-2">
        {items.map((customer) => (
          <button
            key={customer.id}
            onClick={() => setSelectedCustomerId(customer.id)}
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-blue-400 hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-800">{customer.name}</p>
                <p className="text-xs text-slate-500">{customer.locationArea}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[customer.dealStatus]}`}>
                {customer.dealStatus}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              <span>Agent: {agentById[customer.agentId]?.name || '—'}</span>
              <span>Last contact: {format(parseISO(customer.lastContactAt), 'MMM d')}</span>
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-700">RTO:{customer.rtoCount}</span>
            </div>
          </button>
        ))}
      </div>
    );
  };

  const isOwner = currentUser?.role === 'Owner' || currentUser?.role === 'Master';

  return (
    <div className="h-full overflow-auto bg-slate-100 p-3.5 pt-1 lg:p-3.5 lg:pt-1">
      <div className="mx-auto max-w-[1700px] space-y-2">
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
        <div className="grid gap-3 lg:grid-cols-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm lg:col-span-5">
            <div className="mb-1.5 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">Daily Call Monitoring — Owner Dashboard</h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search customer / area"
                    className="w-52 rounded-lg border border-slate-200 py-2 pl-8 pr-2 text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <select
                  value={agentFilter || 'all'}
                  onChange={(event) => setAgentFilter(event.target.value === 'all' ? null : event.target.value)}
                  className="rounded-lg border border-slate-200 px-2 py-2 text-xs"
                >
                  <option value="all">All agents</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    setAgentFilter(null);
                    setAreaFilter(null);
                    setSearch('');
                  }}
                  className="rounded-lg border border-slate-200 px-2 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Reset filters
                </button>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                <p className="text-[11px] text-slate-500">Quota vs Actual (MTD)</p>
                <p className="mt-1 text-base font-bold text-slate-800">{toCurrency(kpis.actualSales)}</p>
                <p className="text-[11px] text-slate-500">of {toCurrency(kpis.quota)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                <p className="text-[11px] text-slate-500">Total Revenue (MTD)</p>
                <p className="mt-1 text-base font-bold text-slate-800">{toCurrency(kpis.totalRevenue)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                <p className="text-[11px] text-slate-500">Active Deals</p>
                <p className="mt-1 text-base font-bold text-slate-800">{kpis.activeDeals}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                <p className="text-[11px] text-slate-500">Successful Outcomes %</p>
                <p className="mt-1 text-base font-bold text-slate-800">{kpis.successPercent}%</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                <p className="text-[11px] text-slate-500">Calls (Today / MTD)</p>
                <p className="mt-1 text-base font-bold text-slate-800">
                  {kpis.callsToday} / {kpis.callsMTD}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                <p className="text-[11px] text-slate-500">Texts (Today / MTD)</p>
                <p className="mt-1 text-base font-bold text-slate-800">
                  {kpis.textsToday} / {kpis.textsMTD}
                </p>
              </div>
            </div>
          </div>

          <div className="self-start rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm lg:col-span-2">
            <div className="mb-1.5 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Notifications & Approvals</h3>
              <button
                onClick={() => {
                  setSelectedQueueType(null);
                  setShowQueueDialog(true);
                }}
                className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-200"
              >
                {unreadCount} unread
              </button>
            </div>
            <div className="space-y-1.5">
              {(Object.entries(groupedReports) as [ReportType, ReportItem[]][]).map(([group, items]) => (
                <button
                  key={group}
                  onClick={() => {
                    setSelectedQueueType(group);
                    setShowQueueDialog(true);
                  }}
                  className="w-full rounded-lg border border-slate-200 p-1.5 text-left transition hover:border-blue-300 hover:bg-slate-50"
                >
                  <p className="text-[11px] font-semibold text-slate-500">{group}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{items.length} item(s)</p>
                </button>
              ))}
            </div>
          </div>

          <div className="self-start rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm lg:col-span-1">
            <h3 className="mb-1.5 text-sm font-semibold text-slate-700">Attendance</h3>
            <p className="text-xs text-slate-500">
              <span className="font-semibold text-emerald-600">{attendance.online.length}</span> online / {attendance.offline.length} offline
            </p>
            <div className="mt-2 space-y-1.5">
              {agents.map((agent) => (
                <div key={agent.id} className="flex items-center justify-between text-xs">
                  <span className="truncate text-slate-700">{agent.name}</span>
                  <span className={`rounded-full px-2 py-0.5 font-semibold ${agent.online ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {agent.online ? 'Online' : 'Offline'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:hidden">
          <div className="grid grid-cols-4 gap-1 rounded-xl border border-slate-200 bg-white p-1">
            {(['overview', 'customers', 'map', 'reports'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setMobileTab(tab)}
                className={`rounded-lg px-2 py-2 text-xs font-semibold capitalize ${mobileTab === tab ? 'bg-blue-600 text-white' : 'text-slate-600'}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="hidden lg:grid lg:grid-cols-[340px_1fr] lg:gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm">
            <div className="mb-1.5 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Customer Lists</h3>
              {areaFilter && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">{areaFilter}</span>}
            </div>

            <div className="mb-3 grid grid-cols-2 gap-1 text-xs">
              <button
                onClick={() => setListTab('priority')}
                className={`rounded-lg px-2 py-1.5 font-semibold ${listTab === 'priority' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}
              >
                Active buyers
              </button>
              <button
                onClick={() => setListTab('inactive')}
                className={`rounded-lg px-2 py-1.5 font-semibold ${listTab === 'inactive' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}
              >
                Inactive +
              </button>
              <button
                onClick={() => setListTab('prospective')}
                className={`rounded-lg px-2 py-1.5 font-semibold ${listTab === 'prospective' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}
              >
                Prospective +
              </button>
              {isOwner && (
                <button
                  onClick={() => setListTab('negative')}
                  className={`rounded-lg px-2 py-1.5 font-semibold ${listTab === 'negative' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}
                >
                  Inactive -
                </button>
              )}
            </div>

            <div className="max-h-[620px] overflow-auto pr-1">
              {listTab === 'priority' && renderListRows(categoryLists.activeNoPurchase)}
              {listTab === 'inactive' && renderListRows(categoryLists.inactivePositive)}
              {listTab === 'prospective' && renderListRows(categoryLists.prospectivePositive)}
              {listTab === 'negative' && isOwner && renderListRows(categoryLists.inactiveNegative)}

              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50">
                <button
                  onClick={() => setShowGarbage((prev) => !prev)}
                  className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-slate-700"
                >
                  <span>Garbage Data</span>
                  {showGarbage ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                {!showGarbage ? (
                  <div className="border-t border-slate-200 px-3 py-2 text-[11px] text-slate-500">
                    {categoryLists.blacklisted.length} Blacklisted · {categoryLists.negativeProspects.length} Negative Prospects
                  </div>
                ) : (
                  <div className="space-y-2 border-t border-slate-200 px-2 py-2">
                    <div>
                      <p className="mb-1 text-[11px] font-semibold text-rose-600">Blacklisted</p>
                      {renderListRows(categoryLists.blacklisted)}
                    </div>
                    <div>
                      <p className="mb-1 text-[11px] font-semibold text-amber-600">Negative Prospects</p>
                      {renderListRows(categoryLists.negativeProspects)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid gap-3 xl:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm">
                <div className="mb-1.5 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">Team Quota Progress</h3>
                  <span className="text-xs text-slate-500">{quotaGauge.percent}% of goal</span>
                </div>
                <div className="rounded-2xl bg-gradient-to-b from-slate-50 via-slate-50 to-white p-3">
                  <div className="relative mx-auto w-full max-w-[360px] pb-2">
                    <svg viewBox="0 0 220 130" className="h-[170px] w-full" aria-hidden="true">
                      <defs>
                        <linearGradient id="ownerQuotaGaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#3b82f6" />
                          <stop offset="100%" stopColor="#1d4ed8" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M 20 110 A 90 90 0 0 1 200 110"
                        fill="none"
                        stroke="#e2e8f0"
                        strokeWidth="16"
                        strokeLinecap="round"
                      />
                      <path
                        d="M 20 110 A 90 90 0 0 1 200 110"
                        fill="none"
                        stroke="url(#ownerQuotaGaugeGradient)"
                        strokeWidth="16"
                        strokeLinecap="round"
                        pathLength={100}
                        strokeDasharray={`${quotaGauge.percent} 100`}
                      />
                    </svg>

                    <div className="absolute inset-x-0 top-[24px] px-4 text-center">
                      <p className="text-xs font-medium text-slate-500">Total Sales</p>
                      <p className="mx-auto mt-2 w-[82%] max-w-[260px] text-[clamp(1.65rem,2.5vw,2.45rem)] font-bold leading-none tracking-tight text-slate-800">
                        {toCurrency(kpis.actualSales)}
                      </p>
                      <span className="mt-3 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                        {quotaGauge.percent}% of Goal
                      </span>
                    </div>
                    <div className="relative -mt-1 text-center">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Target Quota</p>
                      <p className="text-[1.85rem] font-bold leading-none text-blue-700">{toCurrency(kpis.quota)}</p>
                    </div>
                  </div>

                  <div className="mt-2 rounded-2xl border border-slate-200 bg-white">
                    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-slate-100 px-3 py-2.5">
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-blue-100 text-blue-600">
                        <Flag className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500">Remaining to Goal</p>
                        <p className="text-2xl font-bold text-slate-800">{toCurrency(quotaGauge.remaining)}</p>
                      </div>
                      <span className="rounded-md bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-600">
                        {quotaGauge.leftPercent}% Left
                      </span>
                    </div>

                    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-slate-100 px-3 py-2.5">
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                        <Clock className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500">Daily Target to Hit</p>
                        <p className="text-2xl font-bold text-slate-800">{toCurrency(quotaGauge.dailyTarget)}</p>
                      </div>
                      <span className="text-xs font-medium text-slate-500">/ day</span>
                    </div>

                    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2.5">
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-violet-100 text-violet-600">
                        <TrendingUp className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500">Weekly Target Quota</p>
                        <p className="text-2xl font-bold text-slate-800">{toCurrency(quotaGauge.weeklyTarget)}</p>
                      </div>
                      <span className="text-xs font-medium text-slate-500">/ week</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm">
                <h3 className="mb-1.5 text-sm font-semibold text-slate-700">Revenue Trend (Last Month vs Current Month)</h3>
                <div className="h-[250px]">
                  <MuiLineChartPro
                    height={250}
                    xAxis={[
                      {
                        zoom: true,
                        scaleType: 'point',
                        data: revenueTrendData.xAxis,
                        tickLabelStyle: { fontSize: 11 },
                        valueFormatter: (value) => `Day ${revenueTrendData.dayLabels[Number(value)] || Number(value) + 1}`,
                      },
                    ]}
                    yAxis={[
                      {
                        valueFormatter: (value) => `${Math.round(Number(value) / 1000)}k`,
                        tickLabelStyle: { fontSize: 11 },
                      },
                    ]}
                    series={revenueTrendData.series.map((item) => ({
                      ...item,
                      valueFormatter: (value: number | null) => toCurrency(Number(value || 0)),
                    }))}
                    grid={{ horizontal: true }}
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm">
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">Deal Status Distribution</h3>
                  <span className="text-[11px] text-slate-500">Click segment</span>
                </div>
                <div className="flex h-[230px] items-center justify-center">
                  <MuiPieChart
                    width={300}
                    height={220}
                    series={[
                      {
                        data: dealStatusPieData,
                        innerRadius: 52,
                        outerRadius: 82,
                        paddingAngle: 2,
                        cornerRadius: 4,
                      },
                    ]}
                    onItemClick={(_event, itemIdentifier) => {
                      if (itemIdentifier.dataIndex == null) return;
                      const picked = dealStatusPieData[itemIdentifier.dataIndex];
                      if (!picked?.label) return;
                      setSelectedDealStatus(picked.label as DealStatus);
                      setShowDealStatusDialog(true);
                    }}
                    hideLegend
                  />
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-600">
                  {dealStatusPieData.map((item) => (
                    <button
                      key={String(item.id)}
                      type="button"
                      onClick={() => {
                        setSelectedDealStatus(item.label as DealStatus);
                        setShowDealStatusDialog(true);
                      }}
                      className="flex items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-slate-100"
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm">
                <h3 className="mb-1.5 text-sm font-semibold text-slate-700">Geographic Revenue Distribution</h3>
                <div className="h-[230px]">
                  <MuiBarChart
                    height={230}
                    xAxis={[
                      {
                        scaleType: 'band',
                        data: geographicRevenueData.map((row) => row.name),
                        tickLabelStyle: { fontSize: 11 },
                      },
                    ]}
                    yAxis={[
                      {
                        valueFormatter: (value) => `${Math.round(Number(value) / 1000)}k`,
                        tickLabelStyle: { fontSize: 11 },
                      },
                    ]}
                    series={[
                      {
                        data: geographicRevenueData.map((row) => row.value),
                        color: '#0ea5e9',
                        label: 'Revenue',
                        valueFormatter: (value) => toCurrency(Number(value || 0)),
                      },
                    ]}
                    grid={{ horizontal: true }}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm">
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">Outcome Segments</h3>
                  <span className="text-[11px] text-slate-500">Click segment</span>
                </div>
                <div className="flex h-[230px] items-center justify-center">
                  <MuiPieChart
                    width={300}
                    height={220}
                    series={[
                      {
                        data: outcomePieData,
                        outerRadius: 82,
                        paddingAngle: 2,
                        cornerRadius: 4,
                      },
                    ]}
                    onItemClick={(_event, itemIdentifier) => {
                      if (itemIdentifier.dataIndex == null) return;
                      const picked = outcomePieData[itemIdentifier.dataIndex];
                      if (!picked?.label) return;
                      setSelectedOutcome(picked.label as Outcome);
                      setShowOutcomeDialog(true);
                    }}
                    hideLegend
                  />
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-600">
                  {outcomePieData.map((item) => (
                    <button
                      key={String(item.id)}
                      type="button"
                      onClick={() => {
                        setSelectedOutcome(item.label as Outcome);
                        setShowOutcomeDialog(true);
                      }}
                      className="flex items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-slate-100"
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm xl:col-span-2">
                <h3 className="mb-1.5 text-sm font-semibold text-slate-700">Calls / Text / Success Rate per Agent</h3>
                <div className="h-[260px]">
                  <MuiBarChart
                    height={260}
                    xAxis={[
                      {
                        scaleType: 'band',
                        data: perAgentSeries.map((row) => row.name),
                        tickLabelStyle: { fontSize: 11 },
                      },
                    ]}
                    yAxis={[{ tickLabelStyle: { fontSize: 11 } }]}
                    series={[
                      {
                        data: perAgentSeries.map((row) => row.calls),
                        label: 'Calls',
                        color: '#2563eb',
                      },
                      {
                        data: perAgentSeries.map((row) => row.texts),
                        label: 'Texts',
                        color: '#10b981',
                      },
                      {
                        data: perAgentSeries.map((row) => row.successRate),
                        label: 'Success Rate %',
                        color: '#f59e0b',
                        valueFormatter: (value) => `${Number(value || 0)}%`,
                      },
                    ]}
                    grid={{ horizontal: true }}
                  />
                </div>
              </div>

              <div className="self-start rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm">
                <h3 className="mb-1.5 text-sm font-semibold text-slate-700">Management Alerts</h3>
                <div className="space-y-2">
                  {alerts.length === 0 ? (
                    <p className="text-xs text-slate-500">No current recommendations.</p>
                  ) : (
                    alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="w-full rounded-lg border border-amber-200 bg-amber-50 p-2 text-left"
                      >
                        <p className="text-xs font-semibold text-amber-700">{alert.title}</p>
                        <div className="mt-1.5 space-y-1.5">
                          {alert.customers.slice(0, 5).map((customer) => (
                            <button
                              key={customer.id}
                              onClick={() => setSelectedCustomerId(customer.id)}
                              className="w-full rounded-md border border-amber-200/70 bg-white/70 px-2 py-1 text-left text-[11px] text-amber-800 hover:bg-white"
                            >
                              {customer.name} · {customer.locationArea}
                            </button>
                          ))}
                          {alert.customers.length > 5 && (
                            <p className="text-[11px] text-amber-600">+{alert.customers.length - 5} more</p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm">
              <div className="mb-1.5 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">Philippine Territory Map</h3>
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">Area filter: {areaFilter || 'All'}</span>
                  <button onClick={() => setAreaFilter(null)} className="rounded-md border border-slate-200 px-2 py-1 text-slate-600 hover:bg-slate-50">
                    Clear area filter
                  </button>
                </div>
              </div>
              <MapBridge selectedArea={areaFilter} selectedAgentId={agentFilter} onAreaSelect={setAreaFilter} />
            </div>
          </div>
        </div>

        <div className="space-y-4 lg:hidden">
          {mobileTab === 'overview' && (
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <h3 className="mb-2 text-sm font-semibold text-slate-700">Team Quota Progress</h3>
                <div className="rounded-2xl bg-gradient-to-b from-slate-50 via-slate-50 to-white p-3">
                  <div className="relative mx-auto w-full max-w-[300px] pb-1">
                    <svg viewBox="0 0 220 130" className="h-[160px] w-full" aria-hidden="true">
                      <defs>
                        <linearGradient id="ownerQuotaGaugeGradientMobile" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#3b82f6" />
                          <stop offset="100%" stopColor="#1d4ed8" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M 20 110 A 90 90 0 0 1 200 110"
                        fill="none"
                        stroke="#e2e8f0"
                        strokeWidth="16"
                        strokeLinecap="round"
                      />
                      <path
                        d="M 20 110 A 90 90 0 0 1 200 110"
                        fill="none"
                        stroke="url(#ownerQuotaGaugeGradientMobile)"
                        strokeWidth="16"
                        strokeLinecap="round"
                        pathLength={100}
                        strokeDasharray={`${quotaGauge.percent} 100`}
                      />
                    </svg>

                    <div className="absolute inset-x-0 top-[24px] px-3 text-center">
                      <p className="text-xs font-medium text-slate-500">Total Sales</p>
                      <p className="mx-auto mt-2 w-[84%] max-w-[235px] text-[clamp(1.45rem,6vw,2.1rem)] font-bold leading-none tracking-tight text-slate-800">
                        {toCurrency(kpis.actualSales)}
                      </p>
                      <span className="mt-3 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        {quotaGauge.percent}% of Goal
                      </span>
                    </div>
                    <div className="relative -mt-1 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Target Quota</p>
                      <p className="text-xl font-bold leading-none text-blue-700">{toCurrency(kpis.quota)}</p>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-2 text-xs">
                    <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                      <p className="text-slate-500">Remaining to Goal</p>
                      <p className="text-base font-bold text-slate-800">{toCurrency(quotaGauge.remaining)}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                        <p className="text-slate-500">Daily Target</p>
                        <p className="text-base font-bold text-slate-800">{toCurrency(quotaGauge.dailyTarget)}</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                        <p className="text-slate-500">Weekly Target</p>
                        <p className="text-base font-bold text-slate-800">{toCurrency(quotaGauge.weeklyTarget)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {mobileTab === 'customers' && (
            <div className="rounded-xl border border-slate-200 bg-white p-3">{renderListRows(baseFilteredCustomers.slice(0, 18))}</div>
          )}
          {mobileTab === 'map' && (
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <MapBridge selectedArea={areaFilter} selectedAgentId={agentFilter} onAreaSelect={setAreaFilter} />
            </div>
          )}
          {mobileTab === 'reports' && (
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="space-y-2">
                {reports.map((report) => (
                  <div
                    key={report.id}
                    className={`rounded-lg border p-2 ${report.read ? 'border-blue-200 bg-blue-50/40' : 'border-slate-300 bg-slate-100'}`}
                  >
                    <p className="text-xs font-semibold text-slate-700">{report.title}</p>
                    <p className="text-[11px] text-slate-500">{report.submittedBy} · {format(parseISO(report.createdAt), 'MMM d')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>

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
