import type { InventoryAuditFilters, InventoryAuditRecord, InventoryAuditReportData } from '../types';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

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
