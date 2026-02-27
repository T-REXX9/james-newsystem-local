import { getLocalAuthSession } from './localAuthService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

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
    // ignore parse errors
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

const buildQuery = (
  dateFrom: string,
  dateTo: string,
  category: 'not_purchase' | 'no_stock',
  page: number,
  perPage: number
): string => {
  const q = new URLSearchParams({
    main_id: String(getMainId()),
    date_from: dateFrom,
    date_to: dateTo,
    category,
    page: String(page),
    per_page: String(perPage),
  });

  return q.toString();
};

export const getSalesDevelopmentReportDataLocal = async (
  dateFrom: string,
  dateTo: string,
  category: 'not_purchase' | 'no_stock'
): Promise<any[]> => {
  try {
    const query = buildQuery(dateFrom, dateTo, category, 1, 250);
    const data = await requestApi(`${API_BASE_URL}/sales-development-report?${query}`);
    const rows = Array.isArray(data?.items) ? data.items : [];

    return rows.map((row: any) => ({
      id: String(row?.id || ''),
      inquiry_id: String(row?.inquiry_id || ''),
      inquiry_no: String(row?.inquiry_no || ''),
      customer_company: String(row?.customer_company || 'N/A'),
      sales_person: String(row?.sales_person || ''),
      sales_date: String(row?.sales_date || ''),
      part_no: String(row?.part_no || ''),
      item_code: String(row?.item_code || ''),
      description: String(row?.description || ''),
      qty: toNumber(row?.qty),
      unit_price: toNumber(row?.unit_price),
      amount: toNumber(row?.amount),
      remark: String(row?.remark || ''),
    }));
  } catch (err) {
    console.error('Error fetching sales development report data (local API):', err);
    return [];
  }
};

export const getSalesDevelopmentDemandSummaryLocal = async (
  dateFrom: string,
  dateTo: string,
  category: 'not_purchase' | 'no_stock'
): Promise<any[]> => {
  try {
    const query = buildQuery(dateFrom, dateTo, category, 1, 250);
    const data = await requestApi(`${API_BASE_URL}/sales-development-report/summary?${query}`);
    const rows = Array.isArray(data?.items) ? data.items : [];

    return rows.map((row: any) => ({
      part_no: String(row?.part_no || ''),
      item_code: String(row?.item_code || ''),
      description: String(row?.description || ''),
      total_quantity: toNumber(row?.total_quantity),
      inquiry_count: toNumber(row?.inquiry_count),
      customer_count: toNumber(row?.customer_count),
      average_price: toNumber(row?.average_price),
    }));
  } catch (err) {
    console.error('Error fetching sales development demand summary (local API):', err);
    return [];
  }
};
