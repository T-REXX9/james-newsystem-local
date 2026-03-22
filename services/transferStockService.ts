import type { TransferStock, TransferStockDTO, TransferStockItem } from '../types';
import { getLocalAuthSession } from './localAuthService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

const toNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Normalize warehouse ID to canonical label format (WH1, WH2, etc.)
 * Handles both numeric IDs (1, 2, etc.) and canonical labels (WH1, WH2, etc.)
 */
const normalizeWarehouseId = (value: unknown): string => {
  const str = String(value || '').trim().toUpperCase();
  if (str === '') {
    return '';
  }
  // If already in canonical format (WH1, WH2, etc.), return as-is
  if (/^WH\d+$/.test(str)) {
    return str;
  }
  // If numeric, convert to canonical format
  if (/^\d+$/.test(str)) {
    return `WH${str}`;
  }
  // Return as-is for any other format
  return str;
};

const normalizeStatus = (value: unknown): TransferStock['status'] => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'submitted') return 'submitted';
  if (normalized === 'approved') return 'approved';
  if (normalized === 'deleted' || normalized === 'cancelled' || normalized === 'canceled') return 'deleted';
  return 'pending';
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

const requestApi = async (url: string, init?: RequestInit): Promise<any> => {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(await parseApiErrorMessage(response));
  }
  const payload = await response.json();
  if (!payload?.ok) {
    throw new Error(payload?.error || 'API request failed');
  }
  return payload.data;
};

const getUserContext = () => {
  const session = getLocalAuthSession();
  const userId = Number(session?.context?.user?.id || 1);
  return {
    mainId: API_MAIN_ID,
    userId: Number.isFinite(userId) && userId > 0 ? userId : 1,
  };
};

const mapTransferItem = (raw: any): TransferStockItem => ({
  id: String(raw?.id ?? ''),
  transfer_id: String(raw?.transfer_id ?? ''),
  item_id: String(raw?.item_id ?? ''),
  from_warehouse_id: String(raw?.from_warehouse_id ?? ''),
  to_warehouse_id: String(raw?.to_warehouse_id ?? ''),
  transfer_qty: toNumber(raw?.transfer_qty, 0),
  notes: typeof raw?.notes === 'string' ? raw.notes : undefined,
  created_at: String(raw?.created_at || ''),
});

const mapTransferSummary = (raw: any): TransferStock => {
  const id = String(raw?.transfer_refno || raw?.id || '');
  return {
    id,
    transfer_no: String(raw?.transfer_no || ''),
    transfer_date: String(raw?.transfer_date || ''),
    status: normalizeStatus(raw?.status || raw?.status_key),
    notes: typeof raw?.notes === 'string' ? raw.notes : undefined,
    processed_by: String(raw?.processed_by || raw?.user_id || ''),
    processed_by_profile_id: String(raw?.processed_by_profile_id || '') || undefined,
    processed_by_legacy_user_id: String(raw?.processed_by_id || raw?.user_id || '') || undefined,
    approved_by: String(raw?.approved_by || ''),
    approved_at: String(raw?.approved_at || ''),
    created_at: String(raw?.transfer_datetime || raw?.created_at || ''),
    updated_at: String(raw?.transfer_datetime || raw?.updated_at || ''),
    is_deleted: normalizeStatus(raw?.status || raw?.status_key) === 'deleted',
    deleted_at: undefined,
    items: [],
    ...(typeof raw?.item_count !== 'undefined' ? { item_count: toNumber(raw.item_count, 0) } : {}),
  } as TransferStock;
};

const mapTransferDetail = (payload: any): TransferStock => {
  const transfer = payload?.transfer || {};
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const mapped = mapTransferSummary(transfer);
  return {
    ...mapped,
    items: items.map((row: any) => mapTransferItem(row)),
  };
};

/**
 * Generate next transfer number (best-effort from latest transfer)
 */
export async function generateTransferNo(): Promise<string> {
  const query = new URLSearchParams({
    main_id: String(API_MAIN_ID),
    page: '1',
    per_page: '1',
    status: 'all',
  });

  const data = await requestApi(`${API_BASE_URL}/transfer-stocks?${query.toString()}`);
  const latest = Array.isArray(data?.items) ? data.items[0] : null;
  const currentNo = String(latest?.transfer_no || '').trim();
  const match = currentNo.match(/TR-(\d+)/i);
  const next = match ? Number(match[1]) + 1 : 1;
  return `TR-${next}`;
}

/**
 * Create a new Transfer Stock Request
 */
export async function createTransferStock(data: TransferStockDTO): Promise<TransferStock> {
  const userContext = getUserContext();
  const items = Array.isArray(data.items) ? data.items : [];

  const payloadItems = items.map((item: any) => {
    const maybeNumericId = String(item?.item_id || '').trim();
    const isNumericId = /^\d+$/.test(maybeNumericId);
    const mapped: Record<string, unknown> = {
      from_warehouse_id: normalizeWarehouseId(item?.from_warehouse_id),
      to_warehouse_id: normalizeWarehouseId(item?.to_warehouse_id),
      transfer_qty: toNumber(item?.transfer_qty, 0),
      notes: String(item?.notes || ''),
    };

    if (isNumericId) {
      mapped.item_id = maybeNumericId;
      mapped.item_session = maybeNumericId;
    }

    if (!isNumericId && item?.part_no) {
      mapped.part_no = String(item.part_no);
    }

    if (!isNumericId && item?.item_code) {
      mapped.item_code = String(item.item_code);
    }

    return mapped;
  });

  const body = {
    main_id: userContext.mainId,
    user_id: userContext.userId,
    transfer_no: data.transfer_no,
    transfer_date: data.transfer_date,
    status: 'Pending',
    items: payloadItems,
  };

  const created = await requestApi(`${API_BASE_URL}/transfer-stocks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return mapTransferDetail(created);
}

/**
 * Get a Transfer Stock by ID
 */
export async function getTransferStock(id: string): Promise<TransferStock | null> {
  try {
    const data = await requestApi(
      `${API_BASE_URL}/transfer-stocks/${encodeURIComponent(id)}?main_id=${encodeURIComponent(String(API_MAIN_ID))}`
    );
    return mapTransferDetail(data);
  } catch {
    return null;
  }
}

/**
 * Get all Transfer Stocks with optional filters
 */
export async function fetchTransferStocks(filters?: {
  status?: string;
  startDate?: string;
  endDate?: string;
}): Promise<TransferStock[]> {
  const query = new URLSearchParams({
    main_id: String(API_MAIN_ID),
    status: String(filters?.status || 'all'),
    page: '1',
    per_page: '200',
  });

  if (filters?.startDate) query.set('date_from', filters.startDate);
  if (filters?.endDate) query.set('date_to', filters.endDate);

  const list = await requestApi(`${API_BASE_URL}/transfer-stocks?${query.toString()}`);
  const rows = Array.isArray(list?.items) ? list.items : [];
  return rows.map(mapTransferSummary);
}

/**
 * Update a Transfer Stock
 */
export async function updateTransferStock(
  id: string,
  updates: Partial<Pick<TransferStock, 'transfer_date' | 'notes' | 'status'>>
): Promise<TransferStock | null> {
  const payload: Record<string, unknown> = {
    main_id: API_MAIN_ID,
  };

  if (typeof updates.transfer_date === 'string') payload.transfer_date = updates.transfer_date;
  if (typeof updates.notes === 'string') payload.notes = updates.notes;
  if (typeof updates.status === 'string') payload.status = updates.status;

  const data = await requestApi(`${API_BASE_URL}/transfer-stocks/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return mapTransferDetail(data);
}

/**
 * Submit a Transfer Stock for approval
 */
export async function submitTransferStock(id: string): Promise<TransferStock | null> {
  const userContext = getUserContext();
  const data = await requestApi(`${API_BASE_URL}/transfer-stocks/${encodeURIComponent(id)}/actions/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      main_id: userContext.mainId,
      user_id: userContext.userId,
    }),
  });

  return mapTransferDetail(data);
}

/**
 * Approve a Transfer Stock
 */
export async function approveTransferStock(id: string): Promise<TransferStock | null> {
  const userContext = getUserContext();
  const data = await requestApi(`${API_BASE_URL}/transfer-stocks/${encodeURIComponent(id)}/actions/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      main_id: userContext.mainId,
      user_id: userContext.userId,
    }),
  });

  return mapTransferDetail(data);
}

/**
 * Delete a Transfer Stock
 */
export async function deleteTransferStock(id: string): Promise<void> {
  await requestApi(
    `${API_BASE_URL}/transfer-stocks/${encodeURIComponent(id)}?main_id=${encodeURIComponent(String(API_MAIN_ID))}`,
    { method: 'DELETE' }
  );
}

/**
 * Add an item to a Transfer Stock
 */
export async function addTransferStockItem(
  transferId: string,
  item: Omit<TransferStockItem, 'id' | 'transfer_id' | 'created_at'>
): Promise<TransferStockItem> {
  const maybeNumericId = String(item?.item_id || '').trim();
  const isNumericId = /^\d+$/.test(maybeNumericId);

  const payload: Record<string, unknown> = {
    main_id: API_MAIN_ID,
    from_warehouse_id: normalizeWarehouseId(item?.from_warehouse_id),
    to_warehouse_id: normalizeWarehouseId(item?.to_warehouse_id),
    transfer_qty: toNumber(item?.transfer_qty, 0),
    notes: String(item?.notes || ''),
  };

  if (isNumericId) {
    payload.item_id = maybeNumericId;
    payload.item_session = maybeNumericId;
  }

  const data = await requestApi(`${API_BASE_URL}/transfer-stocks/${encodeURIComponent(transferId)}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return mapTransferItem(data);
}

/**
 * Update a Transfer Stock Item
 */
export async function updateTransferStockItem(
  itemId: string,
  updates: Partial<Pick<TransferStockItem, 'from_warehouse_id' | 'to_warehouse_id' | 'transfer_qty' | 'notes'>>
): Promise<TransferStockItem> {
  const payload: Record<string, unknown> = {
    main_id: API_MAIN_ID,
  };

  if (typeof updates.from_warehouse_id === 'string') payload.from_warehouse_id = updates.from_warehouse_id;
  if (typeof updates.to_warehouse_id === 'string') payload.to_warehouse_id = updates.to_warehouse_id;
  if (typeof updates.transfer_qty !== 'undefined') payload.transfer_qty = toNumber(updates.transfer_qty, 0);
  if (typeof updates.notes === 'string') payload.notes = updates.notes;

  const data = await requestApi(`${API_BASE_URL}/transfer-stock-items/${encodeURIComponent(itemId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return mapTransferItem(data);
}

/**
 * Delete a Transfer Stock Item
 */
export async function deleteTransferStockItem(itemId: string): Promise<void> {
  await requestApi(
    `${API_BASE_URL}/transfer-stock-items/${encodeURIComponent(itemId)}?main_id=${encodeURIComponent(String(API_MAIN_ID))}`,
    { method: 'DELETE' }
  );
}

/**
 * Get available stock for an item in a warehouse
 */
export async function getAvailableStock(itemId: string, warehouseId: string): Promise<number> {
  const response = await fetch(
    `${API_BASE_URL}/products/${encodeURIComponent(String(itemId))}?main_id=${encodeURIComponent(String(API_MAIN_ID))}`
  );

  if (!response.ok) {
    return 0;
  }

  const payload = await response.json();
  if (!payload?.ok) {
    return 0;
  }

  const product = payload?.data || {};
  // Extract numeric warehouse ID from canonical label (WH1 -> 1, WH2 -> 2, etc.)
  const warehouseNum = String(warehouseId).replace(/^WH/, '');
  const stockKey = `stock_wh${warehouseNum}`;
  return toNumber((product as any)?.[stockKey], 0);
}
