import { getLocalAuthSession } from './localAuthService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

export type LedgerReportType = 'detailed' | 'summary';
export type LedgerDateType = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';

export type LedgerCustomer = {
  sessionId: string;
  customerCode: string;
  company: string;
};

export type CustomerLedgerMetrics = {
  dealership_since: string | null;
  dealership_sales: number;
  dealership_quota: number;
  monthly_sales: number;
  customer_since: string | null;
  credit_limit: number;
  terms: string;
  balance: number;
};

export type CustomerLedgerDetailedRow = {
  id: number;
  date: string | null;
  datetime: string;
  reference: string;
  ref_no: string;
  ref_type: string;
  check_no: string;
  check_date: string | null;
  dcr: string;
  debit: number;
  credit: number;
  pdc: number;
  balance: number;
  remarks: string;
  promise_to_pay: string;
};

export type CustomerLedgerSummaryRow = {
  year: number;
  month: number;
  month_name: string;
  debit: number;
  credit: number;
  balance: number;
};

export type CustomerLedgerResponse = {
  customer: {
    session_id: string;
    company: string;
    customer_code: string;
  };
  report_type: LedgerReportType;
  date_type: LedgerDateType;
  date_from: string | null;
  date_to: string | null;
  metrics: CustomerLedgerMetrics;
  rows: CustomerLedgerDetailedRow[];
  summary_rows: CustomerLedgerSummaryRow[];
  totals: {
    debit: number;
    credit: number;
    pdc: number;
    balance: number;
    row_count: number;
  };
};

const parseApiErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = await response.json();
    if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error.trim();
    if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message.trim();
  } catch {
    // no-op
  }
  return `API request failed (${response.status})`;
};

const requestApi = async (url: string, init?: RequestInit): Promise<any> => {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(await parseApiErrorMessage(response));
  const payload = await response.json();
  if (!payload?.ok) throw new Error(payload?.error || 'API request failed');
  return payload.data;
};

const toNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const getMainId = (): number => {
  const session = getLocalAuthSession();
  const mainId = Number(session?.context?.user?.main_id || API_MAIN_ID || 1);
  return Number.isFinite(mainId) && mainId > 0 ? mainId : 1;
};

const mapCustomer = (row: any): LedgerCustomer => ({
  sessionId: String(row?.session_id || row?.lsessionid || ''),
  customerCode: String(row?.customer_code || row?.lpatient_code || ''),
  company: String(row?.company || row?.lcompany || ''),
});

export const customerLedgerService = {
  async getCustomers(search = ''): Promise<LedgerCustomer[]> {
    const trimmedSearch = search.trim();
    const query = new URLSearchParams({
      main_id: String(getMainId()),
      status: 'all',
      search: trimmedSearch,
      page: '1',
      per_page: trimmedSearch === '' ? '100' : '50',
      mode: 'picker',
    });

    const data = await requestApi(`${API_BASE_URL}/customer-database?${query.toString()}`);
    const items = Array.isArray(data?.items) ? data.items : [];
    return items.map(mapCustomer).filter((row) => row.sessionId !== '');
  },

  async getLedger(
    sessionId: string,
    filters: {
      reportType: LedgerReportType;
      dateType: LedgerDateType;
      dateFrom?: string;
      dateTo?: string;
    }
  ): Promise<CustomerLedgerResponse> {
    const query = new URLSearchParams({
      report_type: filters.reportType,
      date_type: filters.dateType,
    });

    if (filters.dateFrom) query.set('date_from', filters.dateFrom);
    if (filters.dateTo) query.set('date_to', filters.dateTo);

    const data = await requestApi(
      `${API_BASE_URL}/customers/${encodeURIComponent(sessionId)}/ledger?${query.toString()}`
    );

    const rows = Array.isArray(data?.rows) ? data.rows : [];
    const summaryRows = Array.isArray(data?.summary_rows) ? data.summary_rows : [];

    return {
      customer: {
        session_id: String(data?.customer?.session_id || ''),
        company: String(data?.customer?.company || ''),
        customer_code: String(data?.customer?.customer_code || ''),
      },
      report_type: data?.report_type === 'summary' ? 'summary' : 'detailed',
      date_type: (data?.date_type || 'all') as LedgerDateType,
      date_from: data?.date_from || null,
      date_to: data?.date_to || null,
      metrics: {
        dealership_since: data?.metrics?.dealership_since || null,
        dealership_sales: toNumber(data?.metrics?.dealership_sales),
        dealership_quota: toNumber(data?.metrics?.dealership_quota),
        monthly_sales: toNumber(data?.metrics?.monthly_sales),
        customer_since: data?.metrics?.customer_since || null,
        credit_limit: toNumber(data?.metrics?.credit_limit),
        terms: String(data?.metrics?.terms || ''),
        balance: toNumber(data?.metrics?.balance),
      },
      rows: rows.map((row: any) => ({
        id: toNumber(row?.id),
        date: row?.date || null,
        datetime: String(row?.datetime || ''),
        reference: String(row?.reference || ''),
        ref_no: String(row?.ref_no || ''),
        ref_type: String(row?.ref_type || ''),
        check_no: String(row?.check_no || ''),
        check_date: row?.check_date || null,
        dcr: String(row?.dcr || ''),
        debit: toNumber(row?.debit),
        credit: toNumber(row?.credit),
        pdc: toNumber(row?.pdc),
        balance: toNumber(row?.balance),
        remarks: String(row?.remarks || ''),
        promise_to_pay: String(row?.promise_to_pay || ''),
      })),
      summary_rows: summaryRows.map((row: any) => ({
        year: toNumber(row?.year),
        month: toNumber(row?.month),
        month_name: String(row?.month_name || ''),
        debit: toNumber(row?.debit),
        credit: toNumber(row?.credit),
        balance: toNumber(row?.balance),
      })),
      totals: {
        debit: toNumber(data?.totals?.debit),
        credit: toNumber(data?.totals?.credit),
        pdc: toNumber(data?.totals?.pdc),
        balance: toNumber(data?.totals?.balance),
        row_count: toNumber(data?.totals?.row_count),
      },
    };
  },
};
