import { getLocalAuthSession } from './localAuthService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || 'http://127.0.0.1:8081/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

export type InquiryReportDateType = 'today' | 'week' | 'month' | 'year' | 'custom';
export type InquiryReportMode = 'summary' | 'detailed';

export type InquiryReportCustomer = {
  id: string;
  company: string;
  customerCode: string;
};

export type InquiryReportItem = {
  qty: number;
  item_code: string;
  part_no: string;
  brand: string;
  description: string;
  unit_price: number;
  remark: string;
};

export type InquiryReportRow = {
  id: string;
  inquiry_refno: string;
  inquiry_no: string;
  customer_id: string;
  customer_company: string;
  sales_date: string;
  sales_time: string;
  created_at: string;
  grand_total: number;
  item_count: number;
  items: InquiryReportItem[];
};

export type InquiryReportResponse = {
  mode: InquiryReportMode;
  date_type: InquiryReportDateType;
  date_from: string;
  date_to: string;
  filters: {
    customer_id: string;
  };
  summary: {
    total_inquiries: number;
    total_amount: number;
    average_amount: number;
  };
  items: InquiryReportRow[];
};

const getMainId = (): number => {
  const session = getLocalAuthSession();
  const mainId = Number(session?.context?.user?.main_id || API_MAIN_ID || 1);
  return Number.isFinite(mainId) && mainId > 0 ? mainId : 1;
};

const parseApiError = async (response: Response): Promise<string> => {
  try {
    const payload = await response.json();
    if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error.trim();
    if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message.trim();
  } catch {
    // no-op
  }
  return `API request failed (${response.status})`;
};

const requestApi = async (url: string): Promise<any> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(await parseApiError(response));
  const payload = await response.json();
  if (!payload?.ok) throw new Error(payload?.error || 'API request failed');
  return payload.data;
};

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const inquiryReportLocalApiService = {
  async getCustomers(search = ''): Promise<InquiryReportCustomer[]> {
    const query = new URLSearchParams({
      main_id: String(getMainId()),
      search: search.trim(),
      limit: search.trim() === '' ? '500' : '120',
    });

    const data = await requestApi(`${API_BASE_URL}/inquiry-reports/customers?${query.toString()}`);
    const items = Array.isArray(data?.items) ? data.items : [];
    return items
      .map((row: any) => ({
        id: String(row?.id || ''),
        company: String(row?.company || ''),
        customerCode: String(row?.customer_code || ''),
      }))
      .filter((row: InquiryReportCustomer) => row.id !== '');
  },

  async getReport(params: {
    mode: InquiryReportMode;
    dateType: InquiryReportDateType;
    dateFrom?: string;
    dateTo?: string;
    customerId?: string;
    limit?: number;
  }): Promise<InquiryReportResponse> {
    const query = new URLSearchParams({
      main_id: String(getMainId()),
      mode: params.mode,
      date_type: params.dateType,
      limit: String(params.limit || 700),
    });

    if (params.dateFrom) query.set('date_from', params.dateFrom);
    if (params.dateTo) query.set('date_to', params.dateTo);
    if (params.customerId) query.set('customer_id', params.customerId);

    const data = await requestApi(`${API_BASE_URL}/inquiry-reports?${query.toString()}`);
    const rows = Array.isArray(data?.items) ? data.items : [];

    return {
      mode: data?.mode === 'detailed' ? 'detailed' : 'summary',
      date_type: (data?.date_type || 'today') as InquiryReportDateType,
      date_from: String(data?.date_from || ''),
      date_to: String(data?.date_to || ''),
      filters: {
        customer_id: String(data?.filters?.customer_id || ''),
      },
      summary: {
        total_inquiries: toNumber(data?.summary?.total_inquiries),
        total_amount: toNumber(data?.summary?.total_amount),
        average_amount: toNumber(data?.summary?.average_amount),
      },
      items: rows.map((row: any) => ({
        id: String(row?.id || ''),
        inquiry_refno: String(row?.inquiry_refno || ''),
        inquiry_no: String(row?.inquiry_no || ''),
        customer_id: String(row?.customer_id || ''),
        customer_company: String(row?.customer_company || ''),
        sales_date: String(row?.sales_date || ''),
        sales_time: String(row?.sales_time || ''),
        created_at: String(row?.created_at || ''),
        grand_total: toNumber(row?.grand_total),
        item_count: toNumber(row?.item_count),
        items: (Array.isArray(row?.items) ? row.items : []).map((item: any) => ({
          qty: toNumber(item?.qty),
          item_code: String(item?.item_code || ''),
          part_no: String(item?.part_no || ''),
          brand: String(item?.brand || ''),
          description: String(item?.description || ''),
          unit_price: toNumber(item?.unit_price),
          remark: String(item?.remark || ''),
        })),
      })),
    };
  },
};
