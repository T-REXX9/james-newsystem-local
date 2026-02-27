import type {
  FastSlowMovementItem,
  FastSlowReportData,
  FastSlowReportFilters,
  MovementCategory,
} from '../types';

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

const normalizeCategory = (value: unknown): MovementCategory => {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'fast') return 'fast';
  return 'slow';
};

const mapItem = (row: any): FastSlowMovementItem => ({
  item_id: String(row?.item_id ?? ''),
  part_no: String(row?.part_no || ''),
  item_code: String(row?.item_code || ''),
  description: String(row?.description || ''),
  first_arrival_date: row?.first_arrival_date ? String(row.first_arrival_date) : null,
  total_purchased: toNumber(row?.total_purchased, 0),
  total_sold: toNumber(row?.total_sold, 0),
  month1_sales: toNumber(row?.month1_sales, 0),
  month2_sales: toNumber(row?.month2_sales, 0),
  month3_sales: toNumber(row?.month3_sales, 0),
  month1_label: String(row?.month1_label || 'Month 1'),
  month2_label: String(row?.month2_label || 'Month 2'),
  month3_label: String(row?.month3_label || 'Month 3'),
  category: normalizeCategory(row?.category),
});

export async function generateFastSlowReport(filters: FastSlowReportFilters): Promise<FastSlowReportData> {
  const params = new URLSearchParams({
    main_id: String(API_MAIN_ID),
    sort_by: filters.sortBy,
    sort_direction: filters.sortDirection,
  });

  const data = await requestApi(`${API_BASE_URL}/fast-slow-inventory-report?${params.toString()}`);
  const fast = Array.isArray(data?.fastMovingItems) ? data.fastMovingItems.map(mapItem) : [];
  const slow = Array.isArray(data?.slowMovingItems) ? data.slowMovingItems.map(mapItem) : [];

  return {
    fastMovingItems: fast,
    slowMovingItems: slow,
    generatedAt: String(data?.generatedAt || new Date().toISOString()),
  };
}

/**
 * Lightweight movement map used by Product Database badges.
 * Local API first: source of truth for old-system parity.
 */
export async function fetchProductMovementClassifications(): Promise<Map<string, MovementCategory>> {
  const result = new Map<string, MovementCategory>();
  try {
    const report = await generateFastSlowReport({
      sortBy: 'sales_volume',
      sortDirection: 'desc',
    });

    for (const item of report.fastMovingItems) {
      result.set(item.item_id, 'fast');
    }
    for (const item of report.slowMovingItems) {
      if (!result.has(item.item_id)) {
        result.set(item.item_id, 'slow');
      }
    }
  } catch (error) {
    console.error('Error fetching product movement classifications via local API:', error);
  }
  return result;
}

