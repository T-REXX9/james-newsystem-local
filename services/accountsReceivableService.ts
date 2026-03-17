import { getLocalAuthSession } from './localAuthService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

export type ArDebtType = 'All' | 'Good' | 'Bad';
export type ArDateType = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';

export type ArRow = {
  terms: string;
  date: string | null;
  reference: string;
  amount: number;
  amount_paid: number;
  balance: number;
};

export type ArCustomerResult = {
  session_id: string;
  customer_code: string;
  company: string;
  rows: ArRow[];
  customer_balance: number;
};

export type ArResponse = {
  customers: ArCustomerResult[];
  grand_total_balance: number;
  date_type: ArDateType;
  date_from: string | null;
  date_to: string | null;
  debt_type: ArDebtType;
};

const getMainId = (): number => {
  const session = getLocalAuthSession();
  const mainId = Number(session?.context?.user?.main_id || API_MAIN_ID || 1);
  return Number.isFinite(mainId) && mainId > 0 ? mainId : 1;
};

const parseApiError = async (response: Response): Promise<string> => {
  try {
    const payload = await response.json();
    if (typeof payload?.error === 'string' && payload.error.trim() !== '') return payload.error;
    if (typeof payload?.message === 'string' && payload.message.trim() !== '') return payload.message;
  } catch {
    // ignore
  }
  return `API request failed (${response.status})`;
};

const requestApi = async (url: string, init?: RequestInit): Promise<any> => {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(await parseApiError(response));
  const payload = await response.json();
  if (!payload?.ok) throw new Error(payload?.error || 'API request failed');
  return payload.data;
};

const toNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const accountsReceivableService = {
  async getReport(params: {
    customerId?: string;
    debtType: ArDebtType;
    dateType: ArDateType;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<ArResponse> {
    const query = new URLSearchParams({
      main_id: String(getMainId()),
      debt_type: params.debtType,
      date_type: params.dateType,
    });

    if (params.customerId?.trim()) query.set('customer_id', params.customerId.trim());
    if (params.dateFrom) query.set('date_from', params.dateFrom);
    if (params.dateTo) query.set('date_to', params.dateTo);

    const data = await requestApi(`${API_BASE_URL}/accounts-receivable?${query.toString()}`);

    return {
      customers: (Array.isArray(data?.customers) ? data.customers : []).map((customer: any) => ({
        session_id: String(customer?.session_id || ''),
        customer_code: String(customer?.customer_code || ''),
        company: String(customer?.company || ''),
        rows: (Array.isArray(customer?.rows) ? customer.rows : []).map((row: any) => ({
          terms: String(row?.terms || ''),
          date: row?.date || null,
          reference: String(row?.reference || ''),
          amount: toNumber(row?.amount),
          amount_paid: toNumber(row?.amount_paid),
          balance: toNumber(row?.balance),
        })),
        customer_balance: toNumber(customer?.customer_balance),
      })),
      grand_total_balance: toNumber(data?.grand_total_balance),
      date_type: (data?.date_type || 'all') as ArDateType,
      date_from: data?.date_from || null,
      date_to: data?.date_to || null,
      debt_type: (data?.debt_type || 'All') as ArDebtType,
    };
  },
};
