import { getLocalAuthSession } from './localAuthService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

export type AdjustmentType = 'Debit' | 'Credit' | 'Zero-Out';
export type AdjustmentStatus = 'Pending' | 'Posted';

export type AdjustmentEntry = {
  lid: number;
  lrefno: string;
  lno: string;
  lcustomerid: string;
  lcustomername: string;
  ldate: string;
  ltype: AdjustmentType;
  lamount: number;
  lremark: string;
  luserid: string;
  lstatus: AdjustmentStatus;
  userfname?: string;
  userlname?: string;
};

export type AdjustmentEntryListResponse = {
  items: AdjustmentEntry[];
  meta: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
    filters: Record<string, string>;
  };
};

export type LedgerCustomer = {
  sessionId: string;
  company: string;
};

const parseApiErrorMessage = async (response: Response): Promise<string> => {
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
    throw new Error(await parseApiErrorMessage(response));
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

const mapEntry = (row: any): AdjustmentEntry => ({
  lid: toNumber(row?.lid),
  lrefno: String(row?.lrefno || ''),
  lno: String(row?.lno || ''),
  lcustomerid: String(row?.lcustomerid || ''),
  lcustomername: String(row?.lcustomername || ''),
  ldate: String(row?.ldate || ''),
  ltype: (String(row?.ltype || 'Debit') as AdjustmentType),
  lamount: toNumber(row?.lamount),
  lremark: String(row?.lremark || ''),
  luserid: String(row?.luserid || ''),
  lstatus: (String(row?.lstatus || 'Pending') as AdjustmentStatus),
  userfname: String(row?.userfname || ''),
  userlname: String(row?.userlname || ''),
});

const getContext = () => {
  const session = getLocalAuthSession();
  const userId = Number(session?.context?.user?.id || 1);
  const mainId = Number(session?.context?.user?.main_id || API_MAIN_ID || 1);

  return {
    mainId: Number.isFinite(mainId) && mainId > 0 ? mainId : 1,
    userId: Number.isFinite(userId) && userId > 0 ? String(userId) : '1',
  };
};

export const adjustmentEntryService = {
  async list(params?: {
    search?: string;
    customerId?: string;
    month?: string;
    year?: string;
    status?: string;
    type?: string;
    page?: number;
    perPage?: number;
  }): Promise<AdjustmentEntryListResponse> {
    const ctx = getContext();
    const query = new URLSearchParams({
      main_id: String(ctx.mainId),
      page: String(params?.page || 1),
      per_page: String(params?.perPage || 100),
      month: params?.month || '',
      year: params?.year || '',
    });

    if (params?.search) query.set('search', params.search);
    if (params?.customerId) query.set('customer_id', params.customerId);
    if (params?.status && params.status !== 'All') query.set('status', params.status);
    if (params?.type && params.type !== 'All') query.set('type', params.type);

    const data = await requestApi(`${API_BASE_URL}/adjustment-entries?${query.toString()}`);
    return {
      items: Array.isArray(data?.items) ? data.items.map(mapEntry) : [],
      meta: {
        page: toNumber(data?.meta?.page, 1),
        per_page: toNumber(data?.meta?.per_page, 100),
        total: toNumber(data?.meta?.total, 0),
        total_pages: toNumber(data?.meta?.total_pages, 1),
        filters: (data?.meta?.filters || {}) as Record<string, string>,
      },
    };
  },

  async show(refno: string): Promise<AdjustmentEntry> {
    const data = await requestApi(`${API_BASE_URL}/adjustment-entries/${encodeURIComponent(refno)}`);
    return mapEntry(data || {});
  },

  async create(payload: {
    customerId: string;
    date: string;
    type: AdjustmentType;
    amount: number;
    remark: string;
  }): Promise<AdjustmentEntry> {
    const ctx = getContext();
    const data = await requestApi(`${API_BASE_URL}/adjustment-entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        main_id: ctx.mainId,
        user_id: ctx.userId,
        customer_id: payload.customerId,
        date: payload.date,
        type: payload.type,
        amount: payload.amount,
        remark: payload.remark,
      }),
    });
    return mapEntry(data || {});
  },

  async update(refno: string, payload: {
    customerId?: string;
    date?: string;
    amount?: number;
    remark?: string;
  }): Promise<AdjustmentEntry> {
    const ctx = getContext();
    const data = await requestApi(`${API_BASE_URL}/adjustment-entries/${encodeURIComponent(refno)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        main_id: ctx.mainId,
        ...(payload.customerId !== undefined ? { customer_id: payload.customerId } : {}),
        ...(payload.date !== undefined ? { date: payload.date } : {}),
        ...(payload.amount !== undefined ? { amount: payload.amount } : {}),
        ...(payload.remark !== undefined ? { remark: payload.remark } : {}),
      }),
    });
    return mapEntry(data || {});
  },

  async remove(refno: string): Promise<void> {
    const ctx = getContext();
    await requestApi(`${API_BASE_URL}/adjustment-entries/${encodeURIComponent(refno)}?main_id=${encodeURIComponent(String(ctx.mainId))}`, {
      method: 'DELETE',
    });
  },

  async action(refno: string, action: 'post' | 'unpost'): Promise<any> {
    const ctx = getContext();
    return requestApi(`${API_BASE_URL}/adjustment-entries/${encodeURIComponent(refno)}/actions/${encodeURIComponent(action)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        main_id: ctx.mainId,
        user_id: ctx.userId,
      }),
    });
  },

  async getCustomers(search = ''): Promise<LedgerCustomer[]> {
    const ctx = getContext();
    const query = new URLSearchParams({
      main_id: String(ctx.mainId),
      status: 'all',
      mode: 'picker',
      page: '1',
      per_page: search ? '50' : '100',
      search,
    });

    const data = await requestApi(`${API_BASE_URL}/customer-database?${query.toString()}`);
    const rows = Array.isArray(data?.items) ? data.items : [];
    return rows.map((row: any) => ({
      sessionId: String(row?.session_id || ''),
      company: String(row?.company || ''),
    })).filter((row: LedgerCustomer) => row.sessionId !== '')
      .sort((a, b) => a.company.localeCompare(b.company));
  },
};
