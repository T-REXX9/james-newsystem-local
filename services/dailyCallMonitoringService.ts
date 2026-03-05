import {
  Contact,
  CustomerStatus,
  DailyActivityRecord,
  DailyCallCustomerFilterStatus,
  DailyCallCustomerRow,
  LBCRTORecord,
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
  notes?: string;
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
    return data as DailyCallCustomerRow[];
  } catch (error) {
    console.error('Error fetching daily call customers via local API:', error);
    return [];
  }
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
