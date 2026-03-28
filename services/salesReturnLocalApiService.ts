import { getLocalAuthSession } from './localAuthService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

export interface SalesReturnRecord {
  lrefno: string;
  lcredit_no: string;
  linvoice_no: string;
  ldate: string;
  lstatus: string;
  ltype: string;
  customer_name: string;
  sales_person: string;
  tracking_no: string;
  ship_via: string;
  lremark: string;
  total_qty: number;
  total_amount: number;
}

export interface SalesReturnItem {
  id: number;
  item_code: string;
  part_no: string;
  brand: string;
  location: string;
  description: string;
  qty: number;
  unit_price: number;
  amount: number;
  remark: string;
}

interface SalesReturnListResponse {
  items: SalesReturnRecord[];
  meta: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

export interface SourceItem {
  source_item_id: number;
  linv_refno: string;
  item_code: string;
  part_no: string;
  brand: string;
  description: string;
  unit_price: number;
  original_qty: number;
  remaining_qty: number;
  unit: string;
  discount: number;
}

interface SalesReturnListParams {
  search?: string;
  status?: string;
  month?: string;
  year?: string;
  page?: number;
  perPage?: number;
}

const toNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const getMainId = (): number => {
  const session = getLocalAuthSession();
  const mainId = Number(session?.context?.user?.main_userid || API_MAIN_ID || 1);
  return Number.isFinite(mainId) && mainId > 0 ? mainId : 1;
};

const parseApiError = async (response: Response): Promise<string> => {
  try {
    const payload = await response.json();
    if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error.trim();
    if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message.trim();
  } catch {
    // ignore json parsing errors
  }

  return `API request failed (${response.status})`;
};

const requestApi = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(await parseApiError(response));

  const payload = await response.json();
  if (!payload?.ok) throw new Error(payload?.error || 'API request failed');
  return payload.data as T;
};

const mutateApi = async <T>(url: string, method: string, body?: Record<string, unknown>): Promise<T> => {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(await parseApiError(response));

  const payload = await response.json();
  if (!payload?.ok) throw new Error(payload?.error || 'API request failed');
  return payload.data as T;
};

const mapRecord = (row: any): SalesReturnRecord => ({
  lrefno: String(row?.lrefno || ''),
  lcredit_no: String(row?.lcredit_no || ''),
  linvoice_no: String(row?.linvoice_no || ''),
  ldate: String(row?.ldate || ''),
  lstatus: String(row?.lstatus || 'Pending'),
  ltype: String(row?.ltype || ''),
  customer_name: String(row?.customer_name || 'Unknown Customer'),
  sales_person: String(row?.sales_person || ''),
  tracking_no: String(row?.tracking_no || ''),
  ship_via: String(row?.ship_via || ''),
  lremark: String(row?.lremark || ''),
  total_qty: toNumber(row?.total_qty),
  total_amount: toNumber(row?.total_amount),
});

const mapItem = (row: any): SalesReturnItem => ({
  id: toNumber(row?.id),
  item_code: String(row?.item_code || ''),
  part_no: String(row?.part_no || ''),
  brand: String(row?.brand || ''),
  location: String(row?.location || ''),
  description: String(row?.description || ''),
  qty: toNumber(row?.qty),
  unit_price: toNumber(row?.unit_price),
  amount: toNumber(row?.amount),
  remark: String(row?.remark || ''),
});

export const salesReturnService = {
  async list(params: SalesReturnListParams = {}): Promise<SalesReturnListResponse> {
    const query = new URLSearchParams({
      main_id: String(getMainId()),
      page: String(params.page ?? 1),
      per_page: String(params.perPage ?? 50),
    });

    if (params.search && params.search.trim()) query.set('search', params.search.trim());
    if (params.status && params.status.trim()) query.set('status', params.status.trim());
    if (params.month && params.month.trim()) query.set('month', params.month.trim());
    if (params.year && params.year.trim()) query.set('year', params.year.trim());

    const data = await requestApi<any>(`${API_BASE_URL}/sales-returns?${query.toString()}`);
    return {
      items: Array.isArray(data?.items) ? data.items.map(mapRecord) : [],
      meta: {
        page: toNumber(data?.meta?.page, 1),
        per_page: toNumber(data?.meta?.per_page, 50),
        total: toNumber(data?.meta?.total, 0),
        total_pages: toNumber(data?.meta?.total_pages, 1),
      },
    };
  },

  async show(refno: string): Promise<SalesReturnRecord> {
    const query = new URLSearchParams({
      main_id: String(getMainId()),
    });
    const data = await requestApi<any>(`${API_BASE_URL}/sales-returns/${encodeURIComponent(refno)}?${query.toString()}`);
    return mapRecord(data);
  },

  async items(refno: string): Promise<SalesReturnItem[]> {
    const query = new URLSearchParams({
      main_id: String(getMainId()),
    });
    const data = await requestApi<any>(
      `${API_BASE_URL}/sales-returns/${encodeURIComponent(refno)}/items?${query.toString()}`
    );
    const rows = Array.isArray(data?.items) ? data.items : [];
    return rows.map(mapItem);
  },

  async create(payload: Record<string, unknown>): Promise<SalesReturnRecord> {
    const session = getLocalAuthSession();
    const userId = Number(session?.context?.user?.id || 0);
    const data = await mutateApi<any>(`${API_BASE_URL}/sales-returns`, 'POST', {
      ...payload,
      main_id: getMainId(),
      user_id: userId,
    });
    return mapRecord(data);
  },

  async update(refno: string, payload: Record<string, unknown>): Promise<SalesReturnRecord> {
    const data = await mutateApi<any>(
      `${API_BASE_URL}/sales-returns/${encodeURIComponent(refno)}`,
      'PATCH',
      { ...payload, main_id: getMainId() }
    );
    return mapRecord(data);
  },

  async sourceItems(refno: string): Promise<SourceItem[]> {
    const query = new URLSearchParams({ main_id: String(getMainId()) });
    const data = await requestApi<any>(
      `${API_BASE_URL}/sales-returns/${encodeURIComponent(refno)}/source-items?${query.toString()}`
    );
    return Array.isArray(data?.items) ? data.items : [];
  },

  async addItem(refno: string, payload: Record<string, unknown>): Promise<any> {
    const session = getLocalAuthSession();
    const userId = Number(session?.context?.user?.id || 0);
    return mutateApi<any>(
      `${API_BASE_URL}/sales-returns/${encodeURIComponent(refno)}/items`,
      'POST',
      { ...payload, main_id: getMainId(), user_id: userId }
    );
  },

  async deleteItem(itemId: number): Promise<void> {
    const query = new URLSearchParams({ main_id: String(getMainId()) });
    await mutateApi<any>(
      `${API_BASE_URL}/sales-return-items/${itemId}?${query.toString()}`,
      'DELETE'
    );
  },

  async post(refno: string): Promise<SalesReturnRecord> {
    const session = getLocalAuthSession();
    const userId = Number(session?.context?.user?.id || 0);
    const data = await mutateApi<any>(
      `${API_BASE_URL}/sales-returns/${encodeURIComponent(refno)}/actions/post`,
      'POST',
      { main_id: getMainId(), user_id: userId }
    );
    return mapRecord(data);
  },

  async unpost(refno: string): Promise<SalesReturnRecord> {
    const session = getLocalAuthSession();
    const userId = Number(session?.context?.user?.id || 0);
    const data = await mutateApi<any>(
      `${API_BASE_URL}/sales-returns/${encodeURIComponent(refno)}/actions/unpost`,
      'POST',
      { main_id: getMainId(), user_id: userId }
    );
    return mapRecord(data);
  },
};

