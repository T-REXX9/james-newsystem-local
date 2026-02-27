import { getLocalAuthSession } from './localAuthService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

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

export interface SalesReturnReportFilters {
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  search?: string;
  page?: number;
  perPage?: number;
}

export interface SalesReturnReportRow {
  id: string;
  returnNo: string;
  returnDate: string;
  transactionNo: string;
  customer: string;
  status: string;
  itemCode: string;
  partNo: string;
  brand: string;
  price: number;
  qty: number;
  total: number;
}

export interface SalesReturnReportData {
  items: SalesReturnReportRow[];
  summary: {
    totalQty: number;
    totalAmount: number;
  };
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

export const fetchSalesReturnReportOptions = async (): Promise<{ statuses: string[] }> => {
  try {
    const query = new URLSearchParams({
      main_id: String(getMainId()),
    });
    const data = await requestApi(`${API_BASE_URL}/sales-return-report/options?${query.toString()}`);
    return {
      statuses: Array.isArray(data?.statuses) ? data.statuses.map(String).filter(Boolean) : [],
    };
  } catch (error) {
    console.error('Error fetching sales return report options:', error);
    return { statuses: [] };
  }
};

export const fetchSalesReturnReport = async (
  filters: SalesReturnReportFilters
): Promise<SalesReturnReportData> => {
  try {
    const query = new URLSearchParams({
      main_id: String(getMainId()),
      page: String(filters.page || 1),
      per_page: String(filters.perPage || 100),
    });
    if (filters.dateFrom) query.set('date_from', filters.dateFrom);
    if (filters.dateTo) query.set('date_to', filters.dateTo);
    if (filters.status) query.set('status', filters.status);
    if (filters.search) query.set('search', filters.search);

    const data = await requestApi(`${API_BASE_URL}/sales-return-report?${query.toString()}`);
    const rows: SalesReturnReportRow[] = (Array.isArray(data?.items) ? data.items : []).map((row: any) => ({
      id: String(row?.id || ''),
      returnNo: String(row?.return_no || ''),
      returnDate: String(row?.return_date || ''),
      transactionNo: String(row?.transaction_no || ''),
      customer: String(row?.customer || ''),
      status: String(row?.status || ''),
      itemCode: String(row?.item_code || ''),
      partNo: String(row?.part_no || ''),
      brand: String(row?.brand || ''),
      price: toNumber(row?.price),
      qty: toNumber(row?.qty),
      total: toNumber(row?.total),
    }));

    return {
      items: rows,
      summary: {
        totalQty: toNumber(data?.summary?.total_qty),
        totalAmount: toNumber(data?.summary?.total_amount),
      },
      meta: {
        page: toNumber(data?.meta?.page, 1),
        perPage: toNumber(data?.meta?.per_page, 100),
        total: toNumber(data?.meta?.total, 0),
        totalPages: toNumber(data?.meta?.total_pages, 0),
      },
    };
  } catch (error) {
    console.error('Error fetching sales return report:', error);
    return {
      items: [],
      summary: {
        totalQty: 0,
        totalAmount: 0,
      },
      meta: {
        page: 1,
        perPage: 100,
        total: 0,
        totalPages: 0,
      },
    };
  }
};
