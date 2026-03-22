import type { InventoryLogWithProduct } from '../types';
import { fetchProductsPage } from './productLocalApiService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

export interface StockMovementFilterParams {
  item_id: string;
  warehouse_id?: string;
  transaction_type?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

interface StockMovementListResponse {
  item: Record<string, unknown>;
  logs: InventoryLogWithProduct[];
  meta: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

const parseApiErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = await response.json();
    if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error.trim();
    if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message.trim();
  } catch {
    // no-op
  }
  return `Request failed (${response.status})`;
};

const normalizeLog = (row: any): InventoryLogWithProduct => {
  // Normalize datetime: convert space-separated format to ISO format
  let dateStr = String(row.date ?? '');
  if (dateStr && /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(dateStr)) {
    // Convert "YYYY-MM-DD HH:MM:SS" to "YYYY-MM-DDTHH:MM:SS"
    dateStr = dateStr.replace(' ', 'T');
  }

  return {
    id: String(row.id ?? ''),
    item_id: String(row.item_id ?? ''),
    date: dateStr,
    transaction_type: String(row.transaction_type ?? ''),
    reference_no: String(row.reference_no ?? ''),
    partner: String(row.partner ?? '—'),
    warehouse_id: String(row.warehouse_id ?? ''),
    qty_in: Number(row.qty_in ?? 0),
    qty_out: Number(row.qty_out ?? 0),
    status_indicator: row.status_indicator === '-' ? '-' : '+',
    unit_price: Number(row.unit_price ?? 0),
    processed_by: String(row.processed_by ?? ''),
    notes: String(row.notes ?? ''),
    created_at: dateStr,
    updated_at: undefined,
    is_deleted: false,
    deleted_at: undefined,
    balance: Number(row.balance ?? 0),
  };
};

export const searchStockMovementProducts = async (search = '', limit = 50) => {
  const page = await fetchProductsPage({
    search,
    status: 'all',
    page: 1,
    perPage: Math.max(1, Math.min(100, limit)),
  });
  return page.items;
};

export const fetchStockMovementLogs = async (
  filters: StockMovementFilterParams
): Promise<StockMovementListResponse> => {
  const params = new URLSearchParams({
    main_id: String(API_MAIN_ID),
    item_id: filters.item_id,
    page: String(Math.max(1, filters.page || 1)),
    per_page: String(Math.max(1, Math.min(1000, filters.per_page || 500))),
  });

  if (filters.warehouse_id && filters.warehouse_id !== 'all') params.set('warehouse_id', filters.warehouse_id);
  if (filters.transaction_type && filters.transaction_type !== 'all') params.set('transaction_type', filters.transaction_type);
  if (filters.date_from) params.set('date_from', filters.date_from);
  if (filters.date_to) params.set('date_to', filters.date_to);
  if (filters.search) params.set('search', filters.search);

  const response = await fetch(`${API_BASE_URL}/stock-movements?${params.toString()}`);
  if (!response.ok) {
    throw new Error(await parseApiErrorMessage(response));
  }

  const payload = await response.json();
  const data = payload?.data || {};
  const logs = Array.isArray(data?.logs) ? data.logs.map(normalizeLog) : [];
  const meta = data?.meta || {};

  return {
    item: data?.item || {},
    logs,
    meta: {
      page: Number(meta.page || 1),
      per_page: Number(meta.per_page || logs.length || 1),
      total: Number(meta.total || logs.length || 0),
      total_pages: Number(meta.total_pages || 1),
    },
  };
};

export const createStockMovementLog = async (payload: Record<string, unknown>) => {
  const response = await fetch(`${API_BASE_URL}/stock-movements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      main_id: API_MAIN_ID,
    }),
  });
  if (!response.ok) throw new Error(await parseApiErrorMessage(response));
  const json = await response.json();
  return normalizeLog(json?.data || {});
};

export const updateStockMovementLog = async (id: string | number, payload: Record<string, unknown>) => {
  const response = await fetch(`${API_BASE_URL}/stock-movements/${encodeURIComponent(String(id))}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      main_id: API_MAIN_ID,
    }),
  });
  if (!response.ok) throw new Error(await parseApiErrorMessage(response));
  const json = await response.json();
  return normalizeLog(json?.data || {});
};

export const deleteStockMovementLog = async (id: string | number) => {
  const params = new URLSearchParams({ main_id: String(API_MAIN_ID) });
  const response = await fetch(
    `${API_BASE_URL}/stock-movements/${encodeURIComponent(String(id))}?${params.toString()}`,
    { method: 'DELETE' }
  );
  if (!response.ok) throw new Error(await parseApiErrorMessage(response));
  return true;
};
