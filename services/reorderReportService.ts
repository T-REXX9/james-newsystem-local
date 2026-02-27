import { getLocalAuthSession } from './localAuthService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

export type ReorderWarehouseType = 'total' | 'wh1';

export interface ReorderReportFilters {
  warehouseType: ReorderWarehouseType;
  search?: string;
  hideZeroReorder?: boolean;
  hideZeroReplenish?: boolean;
  page?: number;
  perPage?: number;
}

export interface ReorderReportEntry {
  id: string;
  product_session: string;
  item_code: string;
  part_no: string;
  description: string;
  reorder_qty: number;
  replenish_qty: number;
  current_stock: number;
  total_rr: number;
  total_return: number;
  target_quantity: number;
  pr_refno: string;
  pr_no: string;
  po_refno: string;
  po_no: string;
  rr_refno: string;
  rr_no: string;
  last_arrival_date: string;
  last_arrival_qty: number;
}

const parseApiErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = await response.json();
    if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error.trim();
    if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message.trim();
  } catch {
    // ignore parsing issues
  }
  return `API request failed (${response.status})`;
};

const requestApi = async (url: string, init?: RequestInit): Promise<any> => {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(await parseApiErrorMessage(response));
  }
  const payload = await response.json();
  if (!payload?.ok) throw new Error(payload?.error || 'API request failed');
  return payload.data;
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toString = (value: unknown): string => String(value ?? '');

const normalizeEntry = (raw: any): ReorderReportEntry => ({
  id: toString(raw?.id),
  product_session: toString(raw?.product_session),
  item_code: toString(raw?.item_code),
  part_no: toString(raw?.part_no),
  description: toString(raw?.description),
  reorder_qty: toNumber(raw?.reorder_qty),
  replenish_qty: toNumber(raw?.replenish_qty),
  current_stock: toNumber(raw?.current_stock),
  total_rr: toNumber(raw?.total_rr),
  total_return: toNumber(raw?.total_return),
  target_quantity: toNumber(raw?.target_quantity),
  pr_refno: toString(raw?.pr_refno),
  pr_no: toString(raw?.pr_no),
  po_refno: toString(raw?.po_refno),
  po_no: toString(raw?.po_no),
  rr_refno: toString(raw?.rr_refno),
  rr_no: toString(raw?.rr_no),
  last_arrival_date: toString(raw?.last_arrival_date),
  last_arrival_qty: toNumber(raw?.last_arrival_qty),
});

const getUserContext = () => {
  const session = getLocalAuthSession();
  const userId = Number(session?.context?.user?.id || 0);
  return {
    mainId: API_MAIN_ID,
    userId: Number.isFinite(userId) && userId > 0 ? userId : 0,
  };
};

export const fetchReorderReportEntries = async (filters: ReorderReportFilters): Promise<{
  items: ReorderReportEntry[];
  meta: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}> => {
  const query = new URLSearchParams({
    main_id: String(API_MAIN_ID),
    warehouse_type: filters.warehouseType,
    page: String(Math.max(1, filters.page || 1)),
    per_page: String(Math.max(1, Math.min(500, filters.perPage || 100))),
  });

  if (filters.search?.trim()) query.set('search', filters.search.trim());
  if (filters.hideZeroReorder) query.set('hide_zero_reorder', '1');
  if (filters.hideZeroReplenish) query.set('hide_zero_replenish', '1');

  const data = await requestApi(`${API_BASE_URL}/reorder-report?${query.toString()}`);
  const rows = Array.isArray(data?.items) ? data.items : [];
  const meta = data?.meta || {};

  return {
    items: rows.map(normalizeEntry),
    meta: {
      page: toNumber(meta?.page) || 1,
      per_page: toNumber(meta?.per_page) || 100,
      total: toNumber(meta?.total) || 0,
      total_pages: toNumber(meta?.total_pages) || 1,
    },
  };
};

export const hideReorderReportItems = async (itemIds: string[]): Promise<number> => {
  const normalizedIds = itemIds
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0)
    .map((id) => id.toString());

  if (normalizedIds.length === 0) return 0;

  const ctx = getUserContext();
  const data = await requestApi(`${API_BASE_URL}/reorder-report/hide-items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      main_id: ctx.mainId,
      user_id: ctx.userId,
      item_ids: normalizedIds,
    }),
  });

  return toNumber(data?.hidden);
};
