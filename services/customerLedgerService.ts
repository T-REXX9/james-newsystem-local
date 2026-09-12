import { getLocalAuthSession } from './localAuthService';
import { ContactTransaction } from '../types';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

export type LedgerReportType = 'detailed' | 'summary' | 'yearly';
export type LedgerDateType = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';

export type LedgerCustomer = {
  sessionId: string;
  customerCode: string;
  company: string;
  oldName: string;
};

export type CustomerLedgerMetrics = {
  dealership_since: string | null;
  dealership_sales: number;
  ishinomoto_sales: number;
  dealership_quota: number;
  monthly_sales: number;
  last_month_sales: number;
  customer_since: string | null;
  credit_limit: number;
  terms: string;
  balance: number;
  old_name: string | null;
  price_code: string | null;
  vip_status: string | null;
  aging: {
    current: number;
    days_31_60: number;
    days_61_90: number;
    days_91_120: number;
    days_121_150: number;
    over_150: number;
  };
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

export type CustomerYearlySales = {
  year: number;
  total: number;
  months: Array<{ month: number; label: string; total: number }>;
};

/** Aggregate the same qualifying ledger sales used by Customer Data totals. */
export const buildYearlySales = (
  rows: CustomerLedgerDetailedRow[],
  today = new Date(),
): CustomerYearlySales[] => {
  const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' });
  const currentYear = today.getFullYear();
  const todayIso = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
  const grouped = new Map<number, Map<number, number>>();

  for (const row of rows) {
    if (row.debit <= 0 || !['invoice', 'order slip', 'order_slip'].includes(row.ref_type.trim().toLowerCase())) continue;
    const date = String(row.date || row.datetime || '').slice(0, 10);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!match) continue;
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (year > currentYear || month < 1 || month > 12 || date > todayIso) continue;
    const months = grouped.get(year) || new Map<number, number>();
    months.set(month, (months.get(month) || 0) + row.debit);
    grouped.set(year, months);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => right - left)
    .map(([year, months]) => ({
      year,
      total: [...months.values()].reduce((sum, amount) => sum + amount, 0),
      months: [...months.entries()]
        .sort(([left], [right]) => left - right)
        .map(([month, total]) => ({
          month,
          label: monthFormatter.format(new Date(Date.UTC(2000, month - 1, 1))),
          total,
        })),
    }));
};

/** Map ledger `yearly` report summary rows into year totals (oldest → newest). */
export const buildYearlySalesFromSummary = (
  summaryRows: CustomerLedgerSummaryRow[],
  today = new Date(),
): CustomerYearlySales[] => {
  const currentYear = today.getFullYear();
  const byYear = new Map<number, number>();

  for (const row of summaryRows) {
    const year = Number(row.year);
    if (!Number.isFinite(year) || year <= 0 || year > currentYear) continue;
    byYear.set(year, (byYear.get(year) || 0) + Number(row.debit || 0));
  }

  return [...byYear.entries()]
    .sort(([left], [right]) => left - right)
    .map(([year, total]) => ({ year, total, months: [] }));
};

/**
 * Customer Data sales history is a ledger view, not an item-line purchase list.
 * A ledger posting already represents the document amount, so never recompute
 * the amount from invoice/order-slip item quantities here.
 */
export const ledgerRowsToContactTransactions = (
  rows: CustomerLedgerDetailedRow[],
): ContactTransaction[] => rows
  .filter((row) => row.debit > 0 && ['invoice', 'order slip', 'order_slip'].includes(row.ref_type.trim().toLowerCase()))
  .map((row) => {
    const normalizedType = row.ref_type.trim().toLowerCase();
    const type: ContactTransaction['type'] = normalizedType === 'invoice' ? 'invoice' : 'order_slip';
    return {
      id: `${row.ref_no || 'ledger'}:${row.id}`,
      type,
      number: row.reference,
      date: row.date || row.datetime,
      amount: row.debit,
      status: 'finalized',
      label: `${row.ref_type} ${row.reference}`.trim(),
    };
  });

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
  const headers = new Headers(init?.headers);
  const token = getLocalAuthSession()?.token;
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(url, { ...init, headers });
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
  oldName: String(row?.old_name || row?.loldname || ''),
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
    return items
      .map(mapCustomer)
      .filter((row) => row.sessionId !== '' && (row.company.trim() !== '' || row.customerCode.trim() !== ''))
      .sort((a, b) => a.company.localeCompare(b.company));
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
      report_type: data?.report_type === 'summary' || data?.report_type === 'yearly'
        ? data.report_type
        : 'detailed',
      date_type: (data?.date_type || 'all') as LedgerDateType,
      date_from: data?.date_from || null,
      date_to: data?.date_to || null,
      metrics: {
        dealership_since: data?.metrics?.dealership_since || null,
        dealership_sales: toNumber(data?.metrics?.dealership_sales),
        ishinomoto_sales: toNumber(data?.metrics?.ishinomoto_sales ?? data?.metrics?.dealership_sales),
        dealership_quota: toNumber(data?.metrics?.dealership_quota),
        monthly_sales: toNumber(data?.metrics?.monthly_sales),
        last_month_sales: toNumber(data?.metrics?.last_month_sales),
        customer_since: data?.metrics?.customer_since || null,
        credit_limit: toNumber(data?.metrics?.credit_limit),
        terms: String(data?.metrics?.terms || ''),
        balance: toNumber(data?.metrics?.balance),
        old_name: data?.metrics?.old_name || null,
        price_code: data?.metrics?.price_code || null,
        vip_status: data?.metrics?.vip_status || null,
        aging: {
          current: toNumber(data?.metrics?.aging?.current),
          days_31_60: toNumber(data?.metrics?.aging?.days_31_60),
          days_61_90: toNumber(data?.metrics?.aging?.days_61_90),
          days_91_120: toNumber(data?.metrics?.aging?.days_91_120),
          days_121_150: toNumber(data?.metrics?.aging?.days_121_150),
          over_150: toNumber(data?.metrics?.aging?.over_150),
        },
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

  /** Export ledger as CSV (Excel-compatible) and trigger download. */
  exportLedgerCsv(response: CustomerLedgerResponse): void {
    const rows = response.rows;
    const header = [
      'Date', 'Ref', 'Chk No.', 'Chk Date', 'DCR',
      'Debit', 'Credit', 'PDC', 'Balance', 'Remarks', 'Promise to Pay',
    ];
    const csvRows = [header.join(',')];

    const fmt = (v: number) => v.toFixed(2);
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;

    for (const r of rows) {
      csvRows.push(
        [
          esc(r.date || ''),
          esc(r.reference || ''),
          esc(r.check_no || ''),
          esc(r.check_date || ''),
          esc(r.dcr || ''),
          fmt(r.debit),
          fmt(r.credit),
          fmt(r.pdc),
          fmt(r.balance),
          esc(r.remarks || ''),
          esc(r.promise_to_pay || ''),
        ].join(','),
      );
    }

    // Totals row
    csvRows.push(
      [
        esc('TOTAL'), '', '', '', '',
        fmt(response.totals.debit),
        fmt(response.totals.credit),
        fmt(response.totals.pdc),
        fmt(response.totals.balance),
        '', '',
      ].join(','),
    );

    const bom = '\uFEFF';
    const blob = new Blob([bom + csvRows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const company = response.customer?.company || 'customer';
    a.download = `Customer_Ledger_${company.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
