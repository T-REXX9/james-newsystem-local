import { getLocalAuthSession } from './localAuthService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

export type FreightChargeStatus = 'Pending' | 'Posted';
export type FreightTransactionType = 'No Reference' | 'Invoice' | 'Order Slip';

export type FreightCharge = {
  lid: number;
  lrefno: string;
  ldm_no: string;
  lcustomer: string;
  lcustomer_lname: string;
  lmain_id: string;
  luserid: string;
  ldate: string;
  lcurier_name: string;
  ltrackingno: string;
  lamt: number;
  lremarks: string;
  lstatus: FreightChargeStatus;
  ltransaction_type: FreightTransactionType;
  IsFreightCollect: number;
  ltrans_refno: string;
  linvoice_no: string;
  ldatetime?: string;
  userfname?: string;
  userlname?: string;
};

export type FreightChargeListResponse = {
  items: FreightCharge[];
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

const toFlag = (value: unknown): number => {
  if (value === true || value === '1' || value === 1) return 1;
  return 0;
};

const mapEntry = (row: any): FreightCharge => ({
  lid: toNumber(row?.lid),
  lrefno: String(row?.lrefno || ''),
  ldm_no: String(row?.ldm_no || ''),
  lcustomer: String(row?.lcustomer || ''),
  lcustomer_lname: String(row?.lcustomer_lname || ''),
  lmain_id: String(row?.lmain_id || ''),
  luserid: String(row?.luserid || ''),
  ldate: String(row?.ldate || ''),
  lcurier_name: String(row?.lcurier_name || ''),
  ltrackingno: String(row?.ltrackingno || ''),
  lamt: toNumber(row?.lamt),
  lremarks: String(row?.lremarks || ''),
  lstatus: (String(row?.lstatus || 'Pending') as FreightChargeStatus),
  ltransaction_type: (String(row?.ltransaction_type || 'No Reference') as FreightTransactionType),
  IsFreightCollect: toFlag(row?.IsFreightCollect),
  ltrans_refno: String(row?.ltrans_refno || ''),
  linvoice_no: String(row?.linvoice_no || ''),
  ldatetime: String(row?.ldatetime || ''),
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

export const freightChargesService = {
  async list(params?: {
    search?: string;
    status?: string;
    customerId?: string;
    month?: string;
    year?: string;
    page?: number;
    perPage?: number;
  }): Promise<FreightChargeListResponse> {
    const ctx = getContext();
    const query = new URLSearchParams({
      main_id: String(ctx.mainId),
      page: String(params?.page || 1),
      per_page: String(params?.perPage || 50),
      month: params?.month || '',
      year: params?.year || '',
    });

    if (params?.search) query.set('search', params.search);
    if (params?.customerId) query.set('customer_id', params.customerId);
    if (params?.status && params.status !== 'All') query.set('status', params.status);

    const data = await requestApi(`${API_BASE_URL}/freight-charges?${query.toString()}`);
    return {
      items: Array.isArray(data?.items) ? data.items.map(mapEntry) : [],
      meta: {
        page: toNumber(data?.meta?.page, 1),
        per_page: toNumber(data?.meta?.per_page, 50),
        total: toNumber(data?.meta?.total, 0),
        total_pages: toNumber(data?.meta?.total_pages, 1),
        filters: (data?.meta?.filters || {}) as Record<string, string>,
      },
    };
  },

  async show(refno: string): Promise<FreightCharge> {
    const data = await requestApi(`${API_BASE_URL}/freight-charges/${encodeURIComponent(refno)}`);
    return mapEntry(data || {});
  },

  async create(payload: {
    customerId: string;
    date: string;
    courierName: string;
    trackingNo: string;
    amount: number;
    remarks: string;
    isFreightCollect: boolean;
    transactionType?: FreightTransactionType;
    transactionRefNo?: string;
    invoiceNo?: string;
  }): Promise<FreightCharge> {
    const ctx = getContext();
    const data = await requestApi(`${API_BASE_URL}/freight-charges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        main_id: ctx.mainId,
        user_id: ctx.userId,
        customer_id: payload.customerId,
        date: payload.date,
        courier_name: payload.courierName,
        tracking_no: payload.trackingNo,
        amount: payload.amount,
        remarks: payload.remarks,
        is_freight_collect: payload.isFreightCollect,
        transaction_type: payload.transactionType || 'No Reference',
        transaction_refno: payload.transactionRefNo || '',
        invoice_no: payload.invoiceNo || '',
      }),
    });
    return mapEntry(data || {});
  },

  async update(refno: string, payload: {
    customerId?: string;
    date?: string;
    courierName?: string;
    trackingNo?: string;
    amount?: number;
    remarks?: string;
    isFreightCollect?: boolean;
    transactionType?: FreightTransactionType;
    transactionRefNo?: string;
    invoiceNo?: string;
  }): Promise<FreightCharge> {
    const ctx = getContext();
    const data = await requestApi(`${API_BASE_URL}/freight-charges/${encodeURIComponent(refno)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        main_id: ctx.mainId,
        ...(payload.customerId !== undefined ? { customer_id: payload.customerId } : {}),
        ...(payload.date !== undefined ? { date: payload.date } : {}),
        ...(payload.courierName !== undefined ? { courier_name: payload.courierName } : {}),
        ...(payload.trackingNo !== undefined ? { tracking_no: payload.trackingNo } : {}),
        ...(payload.amount !== undefined ? { amount: payload.amount } : {}),
        ...(payload.remarks !== undefined ? { remarks: payload.remarks } : {}),
        ...(payload.isFreightCollect !== undefined ? { is_freight_collect: payload.isFreightCollect } : {}),
        ...(payload.transactionType !== undefined ? { transaction_type: payload.transactionType } : {}),
        ...(payload.transactionRefNo !== undefined ? { transaction_refno: payload.transactionRefNo } : {}),
        ...(payload.invoiceNo !== undefined ? { invoice_no: payload.invoiceNo } : {}),
      }),
    });
    return mapEntry(data || {});
  },

  async remove(refno: string): Promise<void> {
    const ctx = getContext();
    await requestApi(`${API_BASE_URL}/freight-charges/${encodeURIComponent(refno)}?main_id=${encodeURIComponent(String(ctx.mainId))}`, {
      method: 'DELETE',
    });
  },

  async action(refno: string, action: 'post' | 'unpost'): Promise<any> {
    const ctx = getContext();
    return requestApi(`${API_BASE_URL}/freight-charges/${encodeURIComponent(refno)}/actions/${encodeURIComponent(action)}`, {
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
    })).filter((row: LedgerCustomer) => row.sessionId !== '');
  },
};
