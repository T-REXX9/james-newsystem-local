import {
  CallLogEntry,
  Contact,
  CustomerLogEntry,
  CustomerStatus,
  DailyActivityRecord,
  DailyCallCustomerFilterStatus,
  DailyCallCustomerRow,
  Inquiry,
  LBCRTORecord,
  Purchase,
  TeamMessage,
} from '../types';
import { formatDateFull } from '../utils/formatUtils';
import { getLocalAuthSession } from './localAuthService';

export interface DailyCallFilterParams {
  status?: DailyCallCustomerFilterStatus;
  search?: string;
  viewerUserId?: string | number;
}

export interface DailyActivityDateRange {
  from: string;
  to: string;
}

export interface DailyCallRealtimeCallbacks {
  onInsert?: () => void;
  onUpdate?: () => void;
  onDelete?: () => void;
  onError?: (error: Error) => void;
}

export interface DailyCallAgentSnapshot {
  contacts: DailyCallCustomerRow[];
  callLogs: CallLogEntry[];
  inquiries: Inquiry[];
  purchases: Purchase[];
  teamMessages: TeamMessage[];
}

interface PurchaseHistoryRow {
  id: string;
  contact_id: string;
  total_amount?: number;
  purchase_date?: string;
}

interface CustomerMetricRow {
  contact_id: string;
  outstanding_balance?: number;
  average_monthly_purchase?: number;
}

interface CallLogRow {
  id: string;
  contact_id: string;
  occurred_at: string;
  channel: 'call' | 'text';
  agent_name?: string;
  direction?: 'inbound' | 'outbound';
  duration_seconds?: number;
  notes?: string;
  outcome?: string;
  next_action?: string | null;
  next_action_due?: string | null;
}

export interface WeeklyRangeBucket {
  label: string;
  startDay: number;
  endDay: number;
  month: number;
  year: number;
}

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

const resolveMainId = (): number => {
  const session = getLocalAuthSession();
  const dynamicMainId = Number(
    session?.context?.main_userid || session?.context?.user?.main_userid || session?.userProfile?.main_userid || 0
  );
  if (Number.isFinite(dynamicMainId) && dynamicMainId > 0) return dynamicMainId;
  return API_MAIN_ID || 1;
};

const requestJson = async (url: string, init?: RequestInit): Promise<any> => {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`API request failed (${response.status})`);
  }
  return response.json();
};

const cleanNullableText = (value: unknown, fallback = ''): string => {
  const normalized = String(value ?? '').trim();
  if (!normalized || normalized.toLowerCase() === 'null' || normalized.toLowerCase() === 'undefined') {
    return fallback;
  }
  return normalized;
};

const formatCodeDate = (codeText?: string | null, codeDate?: string | null) => {
  const trimmedText = (codeText || '').trim();
  const formattedDate = formatDateFull(codeDate);
  if (trimmedText && formattedDate !== '—') {
    return `${trimmedText} (${formattedDate})`;
  }
  if (trimmedText) return trimmedText;
  if (formattedDate !== '—') return formattedDate;
  return '—';
};

const normalizeText = (value: string) => value.trim().toLowerCase();

const mapStatusFilter = (status: DailyCallCustomerFilterStatus): CustomerStatus | null => {
  if (status === 'active') return CustomerStatus.ACTIVE;
  if (status === 'inactive') return CustomerStatus.INACTIVE;
  if (status === 'prospective') return CustomerStatus.PROSPECTIVE;
  return null;
};

const createMonthRange = () => {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
};

export const getWeeklyRangeBuckets = (referenceDate = new Date()): WeeklyRangeBucket[] => {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = referenceDate.toLocaleString('en-US', { month: 'long' }).toUpperCase();
  const buckets: WeeklyRangeBucket[] = [];
  let rangeStart: number | null = null;

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay();
    const isSunday = dayOfWeek === 0;
    const isSaturday = dayOfWeek === 6;

    if (isSunday) {
      if (rangeStart !== null) {
        buckets.push({
          label: `${monthLabel} ${rangeStart}-${day - 1}`,
          startDay: rangeStart,
          endDay: day - 1,
          month,
          year,
        });
        rangeStart = null;
      }
      continue;
    }

    if (rangeStart === null) rangeStart = day;

    if (isSaturday || day === daysInMonth) {
      buckets.push({
        label: `${monthLabel} ${rangeStart}-${day}`,
        startDay: rangeStart,
        endDay: day,
        month,
        year,
      });
      rangeStart = null;
    }
  }

  return buckets;
};

const computeMonthlyOrderTotal = (purchaseRows: PurchaseHistoryRow[]) => {
  const monthRange = createMonthRange();
  return purchaseRows
    .filter((row) => {
      if (!row.purchase_date) return false;
      return row.purchase_date >= monthRange.from && row.purchase_date <= monthRange.to;
    })
    .reduce((sum, row) => sum + (row.total_amount || 0), 0);
};

const computeWeeklyRangeTotals = (
  purchaseRows: PurchaseHistoryRow[],
  buckets: WeeklyRangeBucket[]
) => {
  const totals = buckets.map(() => 0);

  purchaseRows.forEach((row) => {
    if (!row.purchase_date) return;
    const date = new Date(row.purchase_date);
    if (Number.isNaN(date.getTime())) return;

    buckets.forEach((bucket, index) => {
      if (date.getFullYear() !== bucket.year || date.getMonth() !== bucket.month) return;
      const day = date.getDate();
      if (day >= bucket.startDay && day <= bucket.endDay) {
        totals[index] += row.total_amount || 0;
      }
    });
  });

  return totals;
};

const buildActivityByDay = (logs: CallLogRow[]): DailyActivityRecord[] => {
  const map = new Map<string, DailyActivityRecord>();

  logs.forEach((log) => {
    const date = new Date(log.occurred_at);
    if (Number.isNaN(date.getTime())) return;

    const key = date.toISOString().slice(0, 10);
    const existing = map.get(key);
    const nextType = log.channel === 'text' ? 'text' : 'call';

    if (!existing) {
      map.set(key, {
        id: `${log.contact_id}-${key}`,
        contact_id: log.contact_id,
        activity_date: key,
        activity_type: nextType,
        activity_count: 1,
        notes: log.notes,
      });
      return;
    }

    map.set(key, {
      ...existing,
      activity_count: existing.activity_count + 1,
      activity_type: existing.activity_type === 'call' || nextType === 'call' ? 'call' : 'text',
      notes: existing.notes || log.notes,
    });
  });

  return Array.from(map.values()).sort((a, b) => b.activity_date.localeCompare(a.activity_date));
};

const mapCallLog = (row: any): CallLogEntry => ({
  id: String(row?.id || ''),
  contact_id: String(row?.contact_id || ''),
  agent_name: String(row?.agent_name || ''),
  channel: row?.channel === 'text' ? 'text' : 'call',
  direction: row?.direction === 'inbound' ? 'inbound' : 'outbound',
  duration_seconds: Number(row?.duration_seconds || 0),
  notes: row?.notes || undefined,
  outcome: (row?.outcome || 'logged') as any,
  occurred_at: String(row?.occurred_at || ''),
  next_action: row?.next_action ?? null,
  next_action_due: row?.next_action_due ?? null,
});

const mapCustomerLog = (row: any): CustomerLogEntry => ({
  id: String(row?.id || ''),
  contact_id: String(row?.contact_id || ''),
  entry_type: row?.entry_type === 'Status' ? 'Status' : 'Note',
  topic: row?.topic === 'Payment' || row?.topic === 'Comment' || row?.topic === 'Status' ? row.topic : 'Sales',
  status: cleanNullableText(row?.status, 'Note'),
  note: cleanNullableText(row?.note),
  promise_to_pay: cleanNullableText(row?.promise_to_pay),
  comments: cleanNullableText(row?.comments),
  attachment: cleanNullableText(row?.attachment) || null,
  occurred_at: String(row?.occurred_at || ''),
  created_by: String(row?.created_by || ''),
  created_by_name: cleanNullableText(row?.created_by_name, String(row?.created_by || '')),
});

const mapInquiry = (row: any): Inquiry => ({
  id: String(row?.id || ''),
  contact_id: String(row?.contact_id || ''),
  title: String(row?.title || row?.status || 'Inquiry'),
  channel: 'call',
  occurred_at: String(row?.occurred_at || row?.sales_date || ''),
  notes: row?.notes || undefined,
});

const mapPurchase = (row: any): Purchase => ({
  id: String(row?.id || ''),
  contact_id: String(row?.contact_id || ''),
  amount: Number(row?.amount ?? row?.total_amount ?? 0),
  status: (row?.status || 'paid') as Purchase['status'],
  purchased_at: String(row?.purchased_at || row?.purchase_date || row?.date || ''),
  notes: row?.notes || undefined,
});

const mapTeamMessage = (row: any): TeamMessage => ({
  id: String(row?.id || ''),
  sender_id: String(row?.sender_id || row?.senderId || ''),
  sender_name: String(row?.sender_name || row?.senderName || ''),
  sender_avatar: row?.sender_avatar || row?.senderAvatar || undefined,
  message: String(row?.message || ''),
  created_at: String(row?.created_at || row?.createdAt || ''),
  is_from_owner: Boolean(row?.is_from_owner),
});

const mapApiStatusToCustomerStatus = (status: string): CustomerStatus => {
  const normalized = (status || '').trim().toLowerCase();
  if (normalized === 'inactive') return CustomerStatus.INACTIVE;
  if (normalized === 'prospective') return CustomerStatus.PROSPECTIVE;
  if (normalized === 'blacklisted') return CustomerStatus.BLACKLISTED;
  return CustomerStatus.ACTIVE;
};

const mapDailyCallCustomerRow = (row: any): DailyCallCustomerRow => ({
  id: String(row?.id || ''),
  source: cleanNullableText(row?.source, 'Manual'),
  assignedTo: cleanNullableText(row?.assignedTo ?? row?.assigned_to, 'Unassigned'),
  assignedDate: cleanNullableText(row?.assignedDate ?? row?.assigned_date),
  clientSince: cleanNullableText(row?.clientSince ?? row?.client_since),
  province: cleanNullableText(row?.province, ''),
  city: cleanNullableText(row?.city, ''),
  shopName: cleanNullableText(row?.shopName ?? row?.shop_name, 'Unnamed Shop'),
  contactNumber: cleanNullableText(row?.contactNumber ?? row?.contact_number, ''),
  codeDate: cleanNullableText(row?.codeDate ?? row?.code_date, '—'),
  dealerPriceGroup: cleanNullableText(row?.dealerPriceGroup ?? row?.dealer_price_group),
  dealerPriceDate: cleanNullableText(row?.dealerPriceDate ?? row?.dealer_price_date),
  ishinomotoDealerSince: cleanNullableText(row?.ishinomotoDealerSince ?? row?.dealerSince ?? row?.dealer_since),
  ishinomotoSignageSince: cleanNullableText(row?.ishinomotoSignageSince ?? row?.signageSince ?? row?.signage_since),
  quota: Number(row?.quota || 0),
  terms: cleanNullableText(row?.terms),
  modeOfPayment: cleanNullableText(row?.modeOfPayment ?? row?.mode_of_payment, '—'),
  courier: cleanNullableText(row?.courier, '—'),
  status: mapApiStatusToCustomerStatus(String(row?.status || row?.statusLabel || row?.status_label || 'active')),
  statusDate: cleanNullableText(row?.statusDate ?? row?.status_date),
  outstandingBalance: Number(row?.outstandingBalance ?? row?.outstanding_balance ?? 0),
  averageMonthlyOrder: Number(row?.averageMonthlyOrder ?? row?.average_monthly_purchase ?? 0),
  monthlyOrder: Number(row?.monthlyOrder ?? row?.monthly_order ?? 0),
  weeklyRangeTotals: Array.isArray(row?.weeklyRangeTotals ?? row?.weekly_range_totals)
    ? (row?.weeklyRangeTotals ?? row?.weekly_range_totals).map((value: unknown) => Number(value || 0))
    : [],
  dailyActivity: Array.isArray(row?.dailyActivity ?? row?.daily_activity)
    ? (row?.dailyActivity ?? row?.daily_activity)
    : [],
});

const matchesSearch = (contact: Contact, query: string) => {
  if (!query) return true;
  const normalizedQuery = normalizeText(query);

  const searchable = [
    contact.company,
    contact.name,
    contact.city,
    contact.province,
    contact.phone,
    contact.mobile || '',
    contact.salesman,
    contact.deliveryAddress,
  ]
    .join(' ')
    .toLowerCase();

  return searchable.includes(normalizedQuery);
};

export const fetchCustomerDailyActivity = async (
  contactId: string,
  dateRange: DailyActivityDateRange
): Promise<DailyActivityRecord[]> => {
  try {
    const session = await getLocalAuthSession();
    const mainId = session?.user?.main_id || 1;
    const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';

    const url = new URL(`${API_BASE_URL}/daily-call-monitoring/customers/${contactId}/call-logs`, window.location.origin);
    url.searchParams.set('main_id', String(mainId));
    url.searchParams.set('from_date', dateRange.from);
    url.searchParams.set('to_date', dateRange.to);

    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const { data } = (await response.json()) as { data: CallLogRow[] };
    return buildActivityByDay((data || []) as CallLogRow[]);
  } catch (error) {
    console.error('Error fetching customer daily activity:', error);
    return [];
  }
};

export const fetchLBCRTOData = async (contactId: string): Promise<LBCRTORecord[]> => {
  try {
    const session = await getLocalAuthSession();
    const mainId = session?.user?.main_id || 1;
    const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';

    const url = new URL(`${API_BASE_URL}/daily-call-monitoring/customers/${contactId}/returns`, window.location.origin);
    url.searchParams.set('main_id', String(mainId));

    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const { data } = (await response.json()) as { data: LBCRTORecord[] };
    return (data || []) as LBCRTORecord[];
  } catch (error) {
    console.error('Error fetching LBC RTO data:', error);
    return [];
  }
};

export const fetchCustomersForDailyCall = async (
  filters: DailyCallFilterParams = {}
): Promise<DailyCallCustomerRow[]> => {
  const statusFilter = filters.status || 'all';
  const search = filters.search || '';
  const viewerUserId = filters.viewerUserId;

  try {
    const mainId = resolveMainId();
    const params = new URLSearchParams({
      main_id: String(mainId),
      status: statusFilter,
      search,
    });
    if (viewerUserId !== undefined && viewerUserId !== null && String(viewerUserId).trim() !== '') {
      params.set('viewer_user_id', String(viewerUserId));
    }
    const response = await fetch(`${API_BASE_URL}/daily-call-monitoring/excel?${params.toString()}`);
    if (!response.ok) throw new Error(`API request failed (${response.status})`);
    const payload = await response.json();
    const data = payload?.data;
    if (!Array.isArray(data)) return [];
    return data.map(mapDailyCallCustomerRow);
  } catch (error) {
    console.error('Error fetching daily call customers via local API:', error);
    return [];
  }
};

export const fetchAgentSnapshotForDailyCall = async (
  viewerUserId: string | number,
  options?: { signal?: AbortSignal }
): Promise<DailyCallAgentSnapshot> => {
  const mainId = resolveMainId();
  const params = new URLSearchParams({
    main_id: String(mainId),
    viewer_user_id: String(viewerUserId),
  });
  const payload = await requestJson(`${API_BASE_URL}/daily-call-monitoring/agent-snapshot?${params.toString()}`, { signal: options?.signal });
  const data = payload?.data || {};

  return {
    contacts: Array.isArray(data?.contacts) ? data.contacts.map(mapDailyCallCustomerRow) : [],
    callLogs: Array.isArray(data?.call_logs) ? data.call_logs.map(mapCallLog) : [],
    inquiries: Array.isArray(data?.inquiries) ? data.inquiries.map(mapInquiry) : [],
    purchases: Array.isArray(data?.purchases) ? data.purchases.map(mapPurchase) : [],
    teamMessages: Array.isArray(data?.team_messages) ? data.team_messages.map(mapTeamMessage) : [],
  };
};

export const fetchContactCallLogsForDailyCall = async (
  contactId: string,
  dateRange?: DailyActivityDateRange
): Promise<CallLogEntry[]> => {
  const mainId = resolveMainId();
  const params = new URLSearchParams({ main_id: String(mainId) });
  if (dateRange?.from) params.set('from_date', dateRange.from);
  if (dateRange?.to) params.set('to_date', dateRange.to);
  const payload = await requestJson(`${API_BASE_URL}/daily-call-monitoring/customers/${contactId}/call-logs?${params.toString()}`);
  const data = Array.isArray(payload?.data) ? payload.data : [];
  return data.map(mapCallLog);
};

export const fetchContactPurchasesForDailyCall = async (contactId: string): Promise<Purchase[]> => {
  const mainId = resolveMainId();
  const params = new URLSearchParams({ main_id: String(mainId) });
  const payload = await requestJson(`${API_BASE_URL}/daily-call-monitoring/customers/${contactId}/purchase-history?${params.toString()}`);
  const data = Array.isArray(payload?.data) ? payload.data : [];
  return data.map((row: any) => mapPurchase({ ...row, status: row?.payment_status || 'paid', purchased_at: row?.purchase_date }));
};

export const fetchContactSalesReportsForDailyCall = async (contactId: string): Promise<Inquiry[]> => {
  const mainId = resolveMainId();
  const params = new URLSearchParams({ main_id: String(mainId) });
  const payload = await requestJson(`${API_BASE_URL}/daily-call-monitoring/customers/${contactId}/sales-reports?${params.toString()}`);
  const data = Array.isArray(payload?.data) ? payload.data : [];
  return data.map((row: any) => mapInquiry({ ...row, title: row?.id || 'Sales Report', occurred_at: row?.date, notes: row?.notes }));
};

export const fetchContactCustomerLogsForDailyCall = async (contactId: string): Promise<CustomerLogEntry[]> => {
  const mainId = resolveMainId();
  const params = new URLSearchParams({ main_id: String(mainId) });
  const payload = await requestJson(`${API_BASE_URL}/daily-call-monitoring/customers/${contactId}/customer-logs?${params.toString()}`);
  const data = Array.isArray(payload?.data) ? payload.data : [];
  return data.map(mapCustomerLog);
};

export const createCallLogForDailyCall = async (
  input: Omit<CallLogEntry, 'id'>
): Promise<CallLogEntry> => {
  const mainId = resolveMainId();
  const session = getLocalAuthSession();
  const payload = await requestJson(`${API_BASE_URL}/daily-call-monitoring/call-logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      main_id: mainId,
      user_id: session?.userProfile?.id || null,
      contact_id: input.contact_id,
      agent_name: input.agent_name,
      channel: input.channel,
      outcome: input.outcome,
      notes: input.notes || '',
      occurred_at: input.occurred_at,
    }),
  });

  return mapCallLog(payload?.data || {});
};

export interface CreateCustomerLogForDailyCallInput {
  contact_id: string;
  entry_type: CustomerLogEntry['entry_type'];
  topic?: CustomerLogEntry['topic'];
  status: string;
  note?: string;
  promise_to_pay?: string;
  comments?: string;
  attachment?: string | null;
  occurred_at?: string;
}

export const createCustomerLogForDailyCall = async (
  input: CreateCustomerLogForDailyCallInput
): Promise<CustomerLogEntry> => {
  const mainId = resolveMainId();
  const session = getLocalAuthSession();
  const payload = await requestJson(`${API_BASE_URL}/daily-call-monitoring/customer-logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      main_id: mainId,
      user_id: session?.userProfile?.id || null,
      contact_id: input.contact_id,
      entry_type: input.entry_type,
      topic: input.topic,
      status: input.status,
      note: input.note || '',
      promise_to_pay: input.promise_to_pay || '',
      comments: input.comments || '',
      attachment: input.attachment || '',
      occurred_at: input.occurred_at || new Date().toISOString(),
    }),
  });

  return mapCustomerLog(payload?.data || {});
};

export const subscribeToDailyCallMonitoringUpdates = (
  callbacks: DailyCallRealtimeCallbacks
): (() => void) => {
  const intervalId = window.setInterval(() => {
    try {
      callbacks.onUpdate?.();
    } catch (error) {
      callbacks.onError?.(error as Error);
    }
  }, 45000);

  return () => {
    window.clearInterval(intervalId);
  };
};
