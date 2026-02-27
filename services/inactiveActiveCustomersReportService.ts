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

export interface InactiveActiveCustomerRow {
  id: string;
  customerName: string;
  customerCode: string;
  customerGroup: string;
  salesPerson: string;
  lastPurchase: string;
  customerStatus: 'active' | 'inactive';
}

export interface InactiveActiveCustomersReportFilters {
  status: 'all' | 'active' | 'inactive';
  search: string;
  cutoffMonths: number;
  page: number;
  perPage: number;
}

export interface InactiveActiveCustomersReportData {
  items: InactiveActiveCustomerRow[];
  summary: {
    activeCount: number;
    inactiveCount: number;
    totalCount: number;
    cutoffMonths: number;
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

export const fetchInactiveActiveCustomersReport = async (
  filters: InactiveActiveCustomersReportFilters
): Promise<InactiveActiveCustomersReportData> => {
  try {
    const query = new URLSearchParams({
      main_id: String(getMainId()),
      status: filters.status,
      search: filters.search || '',
      cutoff_months: String(filters.cutoffMonths || 3),
      page: String(filters.page || 1),
      per_page: String(filters.perPage || 100),
    });

    const data = await requestApi(`${API_BASE_URL}/inactive-active-customers-report?${query.toString()}`);
    return {
      items: (Array.isArray(data?.items) ? data.items : []).map((row: any) => ({
        id: String(row?.id || ''),
        customerName: String(row?.customer_name || ''),
        customerCode: String(row?.customer_code || ''),
        customerGroup: String(row?.customer_group || ''),
        salesPerson: String(row?.sales_person || ''),
        lastPurchase: String(row?.last_purchase || ''),
        customerStatus: String(row?.customer_status || 'inactive') === 'active' ? 'active' : 'inactive',
      })),
      summary: {
        activeCount: toNumber(data?.summary?.active_count),
        inactiveCount: toNumber(data?.summary?.inactive_count),
        totalCount: toNumber(data?.summary?.total_count),
        cutoffMonths: toNumber(data?.summary?.cutoff_months, 3),
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
    console.error('Error fetching inactive/active customers report:', error);
    return {
      items: [],
      summary: {
        activeCount: 0,
        inactiveCount: 0,
        totalCount: 0,
        cutoffMonths: filters.cutoffMonths || 3,
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

