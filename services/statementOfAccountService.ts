import { getLocalAuthSession } from './localAuthService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

export type SoaDateType = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';
export type SoaReportType = 'detailed' | 'summary';

export type SoaCustomer = {
  sessionId: string;
  customerCode: string;
  company: string;
};

export type SoaDetailedRow = {
  id: number;
  terms: string;
  date: string | null;
  datetime: string;
  reference: string;
  amount: number;
  amount_paid: number;
  balance: number;
  remarks: string;
};

export type SoaSummaryRow = {
  year: number;
  month: number;
  month_name: string;
  total_debit: number;
  total_credit: number;
  balance: number;
};

export type SoaResponse = {
  customer: {
    session_id: string;
    customer_code: string;
    company: string;
    terms: string;
    credit_limit: number;
  };
  report_type: SoaReportType;
  date_type: SoaDateType;
  date_from: string | null;
  date_to: string | null;
  rows: SoaDetailedRow[];
  summary_rows: SoaSummaryRow[];
  totals: {
    amount: number;
    amount_paid: number;
    balance: number;
    row_count: number;
  };
};

const getMainId = (): number => {
  const session = getLocalAuthSession();
  const mainId = Number(session?.context?.user?.main_id || API_MAIN_ID || 1);
  return Number.isFinite(mainId) && mainId > 0 ? mainId : 1;
};

const getUserType = (): string => {
  const session = getLocalAuthSession();
  const raw = String(session?.context?.user_type || '').trim();
  return raw !== '' ? raw : '2';
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

export const statementOfAccountService = {
  async getCustomers(search = ''): Promise<SoaCustomer[]> {
    const query = new URLSearchParams({
      main_id: String(getMainId()),
      user_type: getUserType(),
      search: search.trim(),
      limit: search.trim() === '' ? '120' : '60',
    });

    const data = await requestApi(`${API_BASE_URL}/statements/customers?${query.toString()}`);
    const items = Array.isArray(data?.items) ? data.items : [];
    return items
      .map((row: any) => ({
        sessionId: String(row?.session_id || ''),
        customerCode: String(row?.customer_code || ''),
        company: String(row?.company || ''),
      }))
      .filter((row: SoaCustomer) => row.sessionId !== '')
      .sort((a, b) => a.company.localeCompare(b.company));
  },

  async getStatement(params: {
    customerId: string;
    reportType: SoaReportType;
    dateType: SoaDateType;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<SoaResponse> {
    const query = new URLSearchParams({
      customer_id: params.customerId,
      report_type: params.reportType,
      date_type: params.dateType,
    });

    if (params.dateFrom) query.set('date_from', params.dateFrom);
    if (params.dateTo) query.set('date_to', params.dateTo);

    const data = await requestApi(`${API_BASE_URL}/statements/of-account?${query.toString()}`);

    return {
      customer: {
        session_id: String(data?.customer?.session_id || ''),
        customer_code: String(data?.customer?.customer_code || ''),
        company: String(data?.customer?.company || ''),
        terms: String(data?.customer?.terms || ''),
        credit_limit: toNumber(data?.customer?.credit_limit),
      },
      report_type: data?.report_type === 'summary' ? 'summary' : 'detailed',
      date_type: (data?.date_type || 'all') as SoaDateType,
      date_from: data?.date_from || null,
      date_to: data?.date_to || null,
      rows: (Array.isArray(data?.rows) ? data.rows : []).map((row: any) => ({
        id: toNumber(row?.id),
        terms: String(row?.terms || ''),
        date: row?.date || null,
        datetime: String(row?.datetime || ''),
        reference: String(row?.reference || ''),
        amount: toNumber(row?.amount),
        amount_paid: toNumber(row?.amount_paid),
        balance: toNumber(row?.balance),
        remarks: String(row?.remarks || ''),
      })),
      summary_rows: (Array.isArray(data?.summary_rows) ? data.summary_rows : []).map((row: any) => ({
        year: toNumber(row?.year),
        month: toNumber(row?.month),
        month_name: String(row?.month_name || ''),
        total_debit: toNumber(row?.total_debit),
        total_credit: toNumber(row?.total_credit),
        balance: toNumber(row?.balance),
      })),
      totals: {
        amount: toNumber(data?.totals?.amount),
        amount_paid: toNumber(data?.totals?.amount_paid),
        balance: toNumber(data?.totals?.balance),
        row_count: toNumber(data?.totals?.row_count),
      },
    };
  },
};
