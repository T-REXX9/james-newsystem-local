import { getLocalAuthSession } from './localAuthService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

export type PurchaseHistoryDateType = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';

export type PurchaseHistoryCustomer = {
  sessionId: string;
  company: string;
  customerCode: string;
};

export type PurchaseHistoryRow = {
  source_type: string;
  source_refno: string;
  source_no: string;
  ldate: string;
  litemcode: string;
  lpartno: string;
  ldesc: string;
  lbrand: string;
  lqty: number;
  lprice: number;
  return_qty: number;
  net_qty: number;
  line_total: number;
};

export type PurchaseHistoryReport = {
  customer_session: string;
  date_from: string | null;
  date_to: string | null;
  items: PurchaseHistoryRow[];
};

const parseApiError = async (response: Response): Promise<string> => {
  try {
    const payload = await response.json();
    if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error.trim();
    if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message.trim();
  } catch {
    // ignore
  }
  return `API request failed (${response.status})`;
};

const requestApi = async (url: string, init?: RequestInit): Promise<any> => {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  const payload = await response.json();
  if (!payload?.ok) {
    throw new Error(payload?.error || 'API request failed');
  }
  return payload.data;
};

const toNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const toYmd = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const resolveDateRange = (
  dateType: PurchaseHistoryDateType,
  customFrom?: string,
  customTo?: string
): { dateFrom: string; dateTo: string } => {
  const now = new Date();
  const today = toYmd(now);

  if (dateType === 'custom') {
    return {
      dateFrom: customFrom || today,
      dateTo: customTo || today,
    };
  }

  if (dateType === 'today') {
    return { dateFrom: today, dateTo: today };
  }

  if (dateType === 'week') {
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    return { dateFrom: toYmd(weekAgo), dateTo: today };
  }

  if (dateType === 'month') {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { dateFrom: toYmd(first), dateTo: toYmd(last) };
  }

  if (dateType === 'year') {
    const first = new Date(now.getFullYear(), 0, 1);
    const last = new Date(now.getFullYear(), 11, 31);
    return { dateFrom: toYmd(first), dateTo: toYmd(last) };
  }

  // Old-system parity for "All" default lower bound.
  return { dateFrom: '2013-06-01', dateTo: today };
};

const getMainId = (): number => {
  const session = getLocalAuthSession();
  const mainId = Number(session?.context?.user?.main_id || API_MAIN_ID || 1);
  return Number.isFinite(mainId) && mainId > 0 ? mainId : 1;
};

export const purchaseHistoryReportService = {
  async getCustomers(search = ''): Promise<PurchaseHistoryCustomer[]> {
    const query = new URLSearchParams({
      main_id: String(getMainId()),
      status: 'all',
      mode: 'picker',
      page: '1',
      per_page: search.trim() ? '60' : '120',
      search: search.trim(),
    });

    const data = await requestApi(`${API_BASE_URL}/customer-database?${query.toString()}`);
    const rows = Array.isArray(data?.items) ? data.items : [];
    return rows
      .map((row: any) => ({
        sessionId: String(row?.session_id || ''),
        company: String(row?.company || ''),
        customerCode: String(row?.customer_code || ''),
      }))
      .filter((row: PurchaseHistoryCustomer) => row.sessionId !== '')
      .sort((a, b) => a.company.localeCompare(b.company));
  },

  async getReport(params: {
    customerId: string;
    dateType: PurchaseHistoryDateType;
    customDateFrom?: string;
    customDateTo?: string;
  }): Promise<PurchaseHistoryReport> {
    const { dateFrom, dateTo } = resolveDateRange(params.dateType, params.customDateFrom, params.customDateTo);
    const query = new URLSearchParams({
      date_from: dateFrom,
      date_to: dateTo,
    });

    const data = await requestApi(
      `${API_BASE_URL}/customers/${encodeURIComponent(params.customerId)}/purchase-history?${query.toString()}`
    );

    const items = Array.isArray(data?.items) ? data.items : [];
    return {
      customer_session: String(data?.customer_session || params.customerId),
      date_from: data?.date_from || dateFrom,
      date_to: data?.date_to || dateTo,
      items: items.map((row: any) => {
        const qty = toNumber(row?.lqty);
        const price = toNumber(row?.lprice);
        const returnQty = toNumber(row?.return_qty);
        return {
          source_type: String(row?.source_type || ''),
          source_refno: String(row?.source_refno || ''),
          source_no: String(row?.source_no || ''),
          ldate: String(row?.ldate || ''),
          litemcode: String(row?.litemcode || ''),
          lpartno: String(row?.lpartno || ''),
          ldesc: String(row?.ldesc || ''),
          lbrand: String(row?.lbrand || ''),
          lqty: qty,
          lprice: price,
          return_qty: returnQty,
          net_qty: qty - returnQty,
          line_total: qty * price,
        };
      }),
    };
  },
};
