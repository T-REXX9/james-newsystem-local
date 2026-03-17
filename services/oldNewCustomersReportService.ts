import { getLocalAuthSession } from './localAuthService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

const getMainId = (): number => {
  const session = getLocalAuthSession();
  const mainId = Number(session?.context?.user?.main_userid || session?.context?.user?.main_id || API_MAIN_ID || 1);
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
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export interface OldNewCustomerRow {
  id: string;
  customerName: string;
  customerCode: string;
  customerGroup: string;
  salesPerson: string;
  customerSince: string;
  customerType: 'old' | 'new';
}

export interface OldNewCustomersReportFilters {
  status: 'all' | 'old' | 'new';
  search: string;
  page: number;
  perPage: number;
}

export interface OldNewCustomersReportData {
  items: OldNewCustomerRow[];
  summary: {
    oldCount: number;
    newCount: number;
    totalCount: number;
    cutoffYears: number;
    cutoffDate: string;
  };
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
    status: string;
    search: string;
  };
}

export const fetchOldNewCustomersReport = async (
  filters: OldNewCustomersReportFilters
): Promise<OldNewCustomersReportData> => {
  try {
    const query = new URLSearchParams({
      main_id: String(getMainId()),
      status: filters.status,
      search: filters.search || '',
      page: String(filters.page || 1),
      per_page: String(filters.perPage || 100),
    });

    const data = await requestApi(`${API_BASE_URL}/old-new-customers-report?${query.toString()}`);
    return {
      items: (Array.isArray(data?.items) ? data.items : []).map((row: any) => ({
        id: String(row?.id || ''),
        customerName: String(row?.customer_name || ''),
        customerCode: String(row?.customer_code || ''),
        customerGroup: String(row?.customer_group || ''),
        salesPerson: String(row?.sales_person || ''),
        customerSince: String(row?.customer_since || ''),
        customerType: String(row?.customer_type || 'new') === 'old' ? 'old' : 'new',
      })),
      summary: {
        oldCount: toNumber(data?.summary?.old_count),
        newCount: toNumber(data?.summary?.new_count),
        totalCount: toNumber(data?.summary?.total_count),
        cutoffYears: toNumber(data?.summary?.cutoff_years, 1),
        cutoffDate: String(data?.summary?.cutoff_date || ''),
      },
      meta: {
        page: toNumber(data?.meta?.page, 1),
        perPage: toNumber(data?.meta?.per_page, 100),
        total: toNumber(data?.meta?.total, 0),
        totalPages: toNumber(data?.meta?.total_pages, 0),
        status: String(data?.meta?.status || 'all'),
        search: String(data?.meta?.search || ''),
      },
    };
  } catch (error) {
    console.error('Error fetching old/new customers report:', error);
    return {
      items: [],
      summary: {
        oldCount: 0,
        newCount: 0,
        totalCount: 0,
        cutoffYears: 1,
        cutoffDate: '',
      },
      meta: {
        page: 1,
        perPage: filters.perPage || 100,
        total: 0,
        totalPages: 0,
        status: filters.status,
        search: filters.search || '',
      },
    };
  }
};
