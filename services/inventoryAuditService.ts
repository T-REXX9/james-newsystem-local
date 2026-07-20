import type { InventoryAuditFilters, InventoryAuditRecord, InventoryAuditReportData } from '../types';
import { getLocalAuthSession } from './localAuthService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

const resolveMainId = (): number => {
  const session = getLocalAuthSession();
  const value = Number(
    session?.context?.main_userid
      || session?.context?.user?.main_userid
      || session?.userProfile?.main_userid
      || API_MAIN_ID
      || 1
  );
  return Number.isFinite(value) && value > 0 ? value : 1;
};

const resolveUserId = (): string => {
  const session = getLocalAuthSession();
  const value = session?.userProfile?.id || session?.context?.user?.id;
  if (!value) throw new Error('User not authenticated');
  return String(value);
};

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

const requestApi = async (url: string): Promise<any> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(await parseApiErrorMessage(response));
  }
  const payload = await response.json();
  if (!payload?.ok) {
    throw new Error(payload?.error || 'API request failed');
  }
  return payload.data || {};
};

const mutateApi = async (url: string, method: string, body?: Record<string, unknown>): Promise<any> => {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    throw new Error(await parseApiErrorMessage(response));
  }
  const payload = await response.json();
  if (!payload?.ok) throw new Error(payload?.error || 'API request failed');
  return payload.data || {};
};

export interface InventoryAuditHeader {
  refno: string;
  adjustmentNo: string;
  status: 'Pending' | 'Posted' | string;
  adjustmentDate: string;
  adjustmentDatetime: string;
  userId: string;
  adjustmentCount: number;
}

export interface InventoryAuditWarehouseCount {
  warehouse: string;
  stock: number;
  location: string;
  physicalCount: number | null;
  discrepancy: number | null;
  remarks: string;
  adjustmentItemId: number | null;
}

export interface InventoryAuditStockItem {
  inventoryId: number;
  itemSession: string;
  partNo: string;
  itemCode: string;
  description: string;
  brand: string;
  cost: number;
  warehouses: InventoryAuditWarehouseCount[];
  totalInventory: number;
  inventoryValue: number;
  totalMissing: number;
  missingValue: number;
}

export interface InventoryAuditStockDetail {
  header: InventoryAuditHeader;
  warehouses: string[];
  items: InventoryAuditStockItem[];
  meta: { page: number; perPage: number; total: number; totalPages: number; partNo: string; itemCode: string };
}

export interface InventoryAuditCountEntry {
  item_session: string;
  warehouse: string;
  physical_count: number | null;
  location?: string;
  remarks?: string;
}

const mapHeader = (row: Record<string, unknown>): InventoryAuditHeader => ({
  refno: String(row.refno || ''),
  adjustmentNo: String(row.adjustment_no || ''),
  status: String(row.status || 'Pending'),
  adjustmentDate: String(row.adjustment_date || ''),
  adjustmentDatetime: String(row.adjustment_datetime || ''),
  userId: String(row.user_id || ''),
  adjustmentCount: Number(row.adjustment_count || 0),
});

const mapStockItem = (row: Record<string, unknown>): InventoryAuditStockItem => ({
  inventoryId: Number(row.inventory_id || 0),
  itemSession: String(row.item_session || ''),
  partNo: String(row.part_no || ''),
  itemCode: String(row.item_code || ''),
  description: String(row.description || ''),
  brand: String(row.brand || ''),
  cost: Number(row.cost || 0),
  warehouses: (Array.isArray(row.warehouses) ? row.warehouses : []).map((warehouse) => ({
    warehouse: String(warehouse?.warehouse || ''),
    stock: Number(warehouse?.stock || 0),
    location: String(warehouse?.location || ''),
    physicalCount: warehouse?.physical_count === null || warehouse?.physical_count === undefined
      ? null
      : Number(warehouse.physical_count),
    discrepancy: warehouse?.discrepancy === null || warehouse?.discrepancy === undefined
      ? null
      : Number(warehouse.discrepancy),
    remarks: String(warehouse?.remarks || ''),
    adjustmentItemId: warehouse?.adjustment_item_id === null || warehouse?.adjustment_item_id === undefined
      ? null
      : Number(warehouse.adjustment_item_id),
  })),
  totalInventory: Number(row.total_inventory || 0),
  inventoryValue: Number(row.inventory_value || 0),
  totalMissing: Number(row.total_missing || 0),
  missingValue: Number(row.missing_value || 0),
});

const toNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export interface InventoryAuditFilterOptions {
  partNumbers: string[];
  itemCodes: string[];
}

export async function fetchInventoryAuditFilterOptions(): Promise<InventoryAuditFilterOptions> {
  const params = new URLSearchParams({
    main_id: String(API_MAIN_ID),
  });
  const data = await requestApi(`${API_BASE_URL}/inventory-audits/filter-options?${params.toString()}`);

  return {
    partNumbers: Array.isArray(data?.part_numbers) ? data.part_numbers.map(String) : [],
    itemCodes: Array.isArray(data?.item_codes) ? data.item_codes.map(String) : [],
  };
}

const mapApiRecord = (row: any): InventoryAuditRecord => {
  const systemQty = toNumber(row?.qty_stock, 0);
  const physicalQty = toNumber(row?.physical_count, 0);
  const signedDifference = physicalQty - systemQty;

  return {
    id: String(row?.id ?? ''),
    item_id: String(row?.item_session ?? ''),
    item_code: String(row?.item_code || ''),
    part_no: String(row?.part_no || ''),
    description: String(row?.description || ''),
    brand: String(row?.brand || ''),
    adjustment_date: String(row?.adjustment_date || ''),
    adjustment_type: 'physical_count',
    adjustment_no: String(row?.adjustment_refno || ''),
    warehouse_id: String(row?.warehouse || ''),
    system_qty: systemQty,
    physical_qty: physicalQty,
    difference: signedDifference,
    reason: String(row?.remarks || ''),
    processed_by: '',
    processor_name: 'System',
    notes: String(row?.remarks || ''),
  };
};

export async function generateInventoryAuditReport(
  filters: InventoryAuditFilters
): Promise<InventoryAuditReportData> {
  const params = new URLSearchParams({
    main_id: String(API_MAIN_ID),
    time_period: filters.timePeriod || 'all',
    page: '1',
    per_page: '500',
  });

  if (filters.timePeriod === 'custom') {
    if (filters.dateFrom) params.set('date_from', filters.dateFrom);
    if (filters.dateTo) params.set('date_to', filters.dateTo);
  }
  if (filters.partNo) params.set('part_no', filters.partNo);
  if (filters.itemCode) params.set('item_code', filters.itemCode);

  const data = await requestApi(`${API_BASE_URL}/inventory-audits?${params.toString()}`);
  const flat = Array.isArray(data?.flat_records) ? data.flat_records : [];
  const records = flat.map(mapApiRecord);

  let totalPositive = 0;
  let totalNegative = 0;
  for (const record of records) {
    if (record.difference > 0) totalPositive += record.difference;
    if (record.difference < 0) totalNegative += Math.abs(record.difference);
  }

  records.sort(
    (a, b) => new Date(b.adjustment_date).getTime() - new Date(a.adjustment_date).getTime()
  );

  return {
    records,
    totalAdjustments: records.length,
    totalPositive,
    totalNegative,
    generatedAt: new Date().toISOString(),
    filters,
  };
}

export async function fetchInventoryAuditHeaders(month: number, year: number): Promise<InventoryAuditHeader[]> {
  const params = new URLSearchParams({
    main_id: String(resolveMainId()),
    month: String(month),
    year: String(year),
  });
  const data = await requestApi(`${API_BASE_URL}/inventory-audits/stock-adjustments?${params.toString()}`);
  const rows = Array.isArray(data?.items) ? data.items : [];
  return rows.map((row: Record<string, unknown>) => mapHeader(row));
}

export async function fetchInventoryAuditStockDetail(
  refno: string,
  options: { partNo?: string; itemCode?: string; page?: number; perPage?: number } = {}
): Promise<InventoryAuditStockDetail> {
  const params = new URLSearchParams({
    main_id: String(resolveMainId()),
    part_no: options.partNo || '',
    item_code: options.itemCode || '',
    page: String(options.page || 1),
    per_page: String(options.perPage || 100),
  });
  const data = await requestApi(
    `${API_BASE_URL}/inventory-audits/stock-adjustments/${encodeURIComponent(refno)}?${params.toString()}`
  );
  const warehouseRows = Array.isArray(data?.warehouses) ? data.warehouses : [];
  return {
    header: mapHeader(data?.header || {}),
    warehouses: warehouseRows.map((warehouse: { name?: unknown }) => String(warehouse?.name || '')),
    items: (Array.isArray(data?.items) ? data.items : []).map((row: Record<string, unknown>) => mapStockItem(row)),
    meta: {
      page: Number(data?.meta?.page || 1),
      perPage: Number(data?.meta?.per_page || options.perPage || 100),
      total: Number(data?.meta?.total || 0),
      totalPages: Number(data?.meta?.total_pages || 1),
      partNo: String(data?.meta?.part_no || ''),
      itemCode: String(data?.meta?.item_code || ''),
    },
  };
}

export async function createInventoryAuditStockAdjustment(): Promise<InventoryAuditHeader> {
  const data = await mutateApi(`${API_BASE_URL}/inventory-audits/stock-adjustments`, 'POST', {
    main_id: resolveMainId(),
    user_id: resolveUserId(),
  });
  return mapHeader(data || {});
}

export async function saveInventoryAuditCounts(
  refno: string,
  entries: InventoryAuditCountEntry[]
): Promise<void> {
  await mutateApi(
    `${API_BASE_URL}/inventory-audits/stock-adjustments/${encodeURIComponent(refno)}/counts`,
    'POST',
    { main_id: resolveMainId(), entries }
  );
}

export async function postInventoryAuditStockAdjustment(refno: string): Promise<InventoryAuditHeader> {
  const data = await mutateApi(
    `${API_BASE_URL}/inventory-audits/stock-adjustments/${encodeURIComponent(refno)}/post`,
    'POST',
    { main_id: resolveMainId(), user_id: resolveUserId() }
  );
  return mapHeader(data || {});
}

export async function updateInventoryAuditDate(refno: string, date: string): Promise<InventoryAuditHeader> {
  const data = await mutateApi(
    `${API_BASE_URL}/inventory-audits/stock-adjustments/${encodeURIComponent(refno)}/date`,
    'PATCH',
    { main_id: resolveMainId(), date }
  );
  return mapHeader(data || {});
}

export async function deleteInventoryAuditItem(refno: string, itemSession: string): Promise<void> {
  const params = new URLSearchParams({ main_id: String(resolveMainId()) });
  await mutateApi(
    `${API_BASE_URL}/inventory-audits/stock-adjustments/${encodeURIComponent(refno)}/items/${encodeURIComponent(itemSession)}?${params.toString()}`,
    'DELETE'
  );
}

export async function deleteInventoryAuditStockAdjustment(refno: string): Promise<void> {
  const params = new URLSearchParams({ main_id: String(resolveMainId()) });
  await mutateApi(
    `${API_BASE_URL}/inventory-audits/stock-adjustments/${encodeURIComponent(refno)}?${params.toString()}`,
    'DELETE'
  );
}
