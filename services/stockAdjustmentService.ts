import type { StockAdjustment, StockAdjustmentDTO, StockAdjustmentItem } from '../types';
import { getLocalAuthSession } from './localAuthService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

const resolveMainId = (): number => {
  const session = getLocalAuthSession();
  const dynamicMainId = Number(
    session?.context?.main_userid || session?.context?.user?.main_userid || session?.userProfile?.main_userid || 0
  );
  if (Number.isFinite(dynamicMainId) && dynamicMainId > 0) return dynamicMainId;
  return API_MAIN_ID || 1;
};

const resolveUserId = (): string => {
  const session = getLocalAuthSession();
  const userId = session?.userProfile?.id || session?.context?.user?.id;
  if (!userId) {
    throw new Error('User not authenticated');
  }
  return String(userId);
};

const parseApiErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = await response.json();
    if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error.trim();
    if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message.trim();
  } catch {
    // ignore parse errors
  }
  return `API request failed (${response.status})`;
};

const requestJson = async (url: string, init?: RequestInit): Promise<any> => {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(await parseApiErrorMessage(response));
  }
  return response.json();
};

const mapItem = (item: any): StockAdjustmentItem => ({
  id: String(item?.id || ''),
  adjustment_id: String(item?.adjustment_id || ''),
  item_id: String(item?.item_id || ''),
  system_qty: Number(item?.system_qty || 0),
  physical_qty: Number(item?.physical_qty || 0),
  difference: Number(item?.difference || 0),
  reason: item?.reason || undefined,
  location: item?.location || undefined,
});

const mapAdjustment = (row: any): StockAdjustment => ({
  id: String(row?.id || ''),
  adjustment_no: String(row?.adjustment_no || ''),
  adjustment_date: String(row?.adjustment_date || ''),
  warehouse_id: String(row?.warehouse_id || 'WH1'),
  adjustment_type: row?.adjustment_type || 'physical_count',
  notes: row?.notes || undefined,
  status: row?.status || 'draft',
  processed_by: row?.processed_by || undefined,
  created_at: String(row?.created_at || ''),
  updated_at: String(row?.updated_at || ''),
  items: Array.isArray(row?.items) ? row.items.map(mapItem) : [],
});

export async function createStockAdjustment(data: StockAdjustmentDTO): Promise<StockAdjustment> {
  const payload = await requestJson(`${API_BASE_URL}/stock-adjustments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      main_id: resolveMainId(),
      user_id: resolveUserId(),
      ...data,
    }),
  });

  return mapAdjustment(payload?.data || {});
}

export async function getStockAdjustment(id: string): Promise<StockAdjustment | null> {
  try {
    const query = new URLSearchParams({ main_id: String(resolveMainId()) });
    const payload = await requestJson(`${API_BASE_URL}/stock-adjustments/${id}?${query.toString()}`);
    return mapAdjustment(payload?.data || {});
  } catch (error) {
    console.error('Error fetching stock adjustment:', error);
    return null;
  }
}

export async function finalizeAdjustment(id: string): Promise<StockAdjustment | null> {
  const payload = await requestJson(`${API_BASE_URL}/stock-adjustments/${id}/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      main_id: resolveMainId(),
      user_id: resolveUserId(),
    }),
  });

  return mapAdjustment(payload?.data || {});
}

export async function getAllStockAdjustments(
  filters?: { warehouseId?: string }
): Promise<StockAdjustment[]> {
  const query = new URLSearchParams({ main_id: String(resolveMainId()) });
  const payload = await requestJson(`${API_BASE_URL}/stock-adjustments?${query.toString()}`);
  const rows = Array.isArray(payload?.data?.items) ? payload.data.items : [];
  const mapped = rows.map(mapAdjustment);

  if (!filters?.warehouseId) {
    return mapped;
  }

  return mapped.filter((item) => item.warehouse_id === filters.warehouseId);
}
