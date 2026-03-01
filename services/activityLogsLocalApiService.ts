import { getLocalAuthSession } from './localAuthService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

export type ActivityLogRecord = {
  lid: number;
  lmain_id: string;
  luser_id: string;
  lpage: string;
  laction: string;
  lrefno: string;
  ldatetime: string;
  userfname: string;
  userlname: string;
};

export type ActivityLogUser = {
  user_id: string;
  first_name: string;
  last_name: string;
};

export type ActivityLogListResponse = {
  items: ActivityLogRecord[];
  meta: {
    page: number;
    per_page: number;
    total: number | null;
    total_pages: number | null;
    has_more: boolean;
    filters: Record<string, string>;
  };
};

const parseApiError = async (response: Response): Promise<string> => {
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
    throw new Error(await parseApiError(response));
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

const getMainId = (): number => {
  const session = getLocalAuthSession();
  const mainId = Number(session?.context?.user?.main_id || API_MAIN_ID || 1);
  return Number.isFinite(mainId) && mainId > 0 ? mainId : 1;
};

const mapRecord = (row: any): ActivityLogRecord => ({
  lid: toNumber(row?.lid),
  lmain_id: String(row?.lmain_id || ''),
  luser_id: String(row?.luser_id || ''),
  lpage: String(row?.lpage || ''),
  laction: String(row?.laction || ''),
  lrefno: String(row?.lrefno || ''),
  ldatetime: String(row?.ldatetime || ''),
  userfname: String(row?.userfname || ''),
  userlname: String(row?.userlname || ''),
});

export const activityLogsLocalApiService = {
  async list(params?: {
    search?: string;
    userId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    perPage?: number;
  }): Promise<ActivityLogListResponse> {
    const query = new URLSearchParams({
      main_id: String(getMainId()),
      page: String(params?.page || 1),
      per_page: String(params?.perPage || 100),
      include_total: '0',
    });

    if (params?.search) query.set('search', params.search);
    if (params?.userId) query.set('user_id', params.userId);
    if (params?.dateFrom) query.set('date_from', params.dateFrom);
    if (params?.dateTo) query.set('date_to', params.dateTo);

    const data = await requestApi(`${API_BASE_URL}/activity-logs?${query.toString()}`);

    return {
      items: Array.isArray(data?.items) ? data.items.map(mapRecord) : [],
      meta: {
        page: toNumber(data?.meta?.page, 1),
        per_page: toNumber(data?.meta?.per_page, 100),
        total: data?.meta?.total === null || data?.meta?.total === undefined ? null : toNumber(data?.meta?.total, 0),
        total_pages: data?.meta?.total_pages === null || data?.meta?.total_pages === undefined ? null : toNumber(data?.meta?.total_pages, 1),
        has_more: Boolean(data?.meta?.has_more),
        filters: (data?.meta?.filters || {}) as Record<string, string>,
      },
    };
  },

  async users(): Promise<ActivityLogUser[]> {
    const data = await requestApi(`${API_BASE_URL}/activity-logs/users?main_id=${encodeURIComponent(String(getMainId()))}`);
    const rows = Array.isArray(data?.items) ? data.items : [];
    return rows.map((row: any) => ({
      user_id: String(row?.user_id || ''),
      first_name: String(row?.first_name || ''),
      last_name: String(row?.last_name || ''),
    })).filter((row: ActivityLogUser) => row.user_id !== '');
  },
};
