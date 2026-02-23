import { OrderSlip, OrderSlipItem, OrderSlipStatus } from '../types';
import { getLocalAuthSession } from './localAuthService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

const toNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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

const mapApiStatusToUi = (status: unknown): OrderSlipStatus => {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'cancelled' || normalized === 'canceled') return OrderSlipStatus.CANCELLED;
  if (normalized === 'posted') return OrderSlipStatus.FINALIZED;
  return OrderSlipStatus.DRAFT;
};

const mapApiItem = (item: any, orderSlipId: string): OrderSlipItem => ({
  id: String(item?.id ?? ''),
  order_slip_id: orderSlipId,
  item_id: String(item?.item_refno || item?.item_id || ''),
  qty: toNumber(item?.qty, 0),
  part_no: String(item?.part_no || ''),
  item_code: String(item?.item_code || ''),
  location: String(item?.location || ''),
  description: String(item?.description || ''),
  unit_price: toNumber(item?.unit_price, 0),
  amount: toNumber(item?.amount, toNumber(item?.qty, 0) * toNumber(item?.unit_price, 0)),
  remark: String(item?.remark || ''),
});

const mapOrderSlipSummary = (raw: any): OrderSlip => {
  const orderSlipId = String(raw?.order_slip_refno || raw?.id || '');
  return {
    id: orderSlipId,
    slip_no: String(raw?.slip_no || ''),
    order_id: String(raw?.order_id || ''),
    contact_id: String(raw?.contact_id || ''),
    sales_date: String(raw?.sales_date || new Date().toISOString().slice(0, 10)),
    sales_person: String(raw?.sales_person || ''),
    delivery_address: String(raw?.delivery_address || ''),
    reference_no: String(raw?.reference_no || ''),
    customer_reference: String(raw?.customer_reference || ''),
    send_by: String(raw?.send_by || ''),
    price_group: String(raw?.price_group || ''),
    credit_limit: toNumber(raw?.credit_limit, 0),
    terms: String(raw?.terms || ''),
    promise_to_pay: String(raw?.promise_to_pay || ''),
    po_number: String(raw?.po_number || ''),
    remarks: String(raw?.remarks || ''),
    inquiry_type: '',
    urgency: '',
    urgency_date: '',
    grand_total: toNumber(raw?.grand_total, 0),
    status: mapApiStatusToUi(raw?.status),
    printed_at: toNumber(raw?.is_printed, 0) > 0 ? String(raw?.created_at || '') : undefined,
    printed_by: '',
    created_by: String(raw?.created_by || ''),
    created_at: String(raw?.created_at || ''),
    updated_at: '',
    items: [],
    is_deleted: toNumber(raw?.is_cancelled, 0) > 0,
  };
};

const mapOrderSlipDetail = (payload: any): OrderSlip => {
  const orderSlip = payload?.order_slip || {};
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const summary = payload?.summary || {};
  const mapped = mapOrderSlipSummary({
    ...orderSlip,
    grand_total: summary?.grand_total,
  });
  return {
    ...mapped,
    items: items.map((row: any) => mapApiItem(row, mapped.id)),
    grand_total: toNumber(summary?.grand_total, mapped.grand_total),
  };
};

export interface OrderSlipsPageFilters {
  month?: number;
  year?: number;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  search?: string;
  page?: number;
  perPage?: number;
}

export interface OrderSlipsPageResult {
  items: OrderSlip[];
  meta: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

export const getOrderSlipsPage = async (filters: OrderSlipsPageFilters): Promise<OrderSlipsPageResult> => {
  const month = filters.month !== undefined
    ? Math.max(1, Math.min(12, Number(filters.month)))
    : undefined;
  const year = filters.year !== undefined
    ? Math.max(2000, Math.min(2100, Number(filters.year)))
    : undefined;
  const page = Math.max(1, Number(filters.page || 1));
  const perPage = Math.max(1, Math.min(500, Number(filters.perPage || 50)));
  const status = String(filters.status || 'all');
  const search = String(filters.search || '').trim();
  const dateFrom = String(filters.dateFrom || '').trim();
  const dateTo = String(filters.dateTo || '').trim();

  const query = new URLSearchParams({
    main_id: String(API_MAIN_ID),
    status,
    page: String(page),
    per_page: String(perPage),
  });
  if (month !== undefined) query.set('month', String(month));
  if (year !== undefined) query.set('year', String(year));
  if (dateFrom) query.set('date_from', dateFrom);
  if (dateTo) query.set('date_to', dateTo);
  if (search) query.set('search', search);

  const list = await requestApi(`${API_BASE_URL}/order-slips?${query.toString()}`);
  const rows = Array.isArray(list?.items) ? list.items : [];
  return {
    items: rows.map(mapOrderSlipSummary),
    meta: {
      page: toNumber(list?.meta?.page, page),
      per_page: toNumber(list?.meta?.per_page, perPage),
      total: toNumber(list?.meta?.total, rows.length),
      total_pages: toNumber(list?.meta?.total_pages, 1),
    },
  };
};

export const getAllOrderSlips = async (): Promise<OrderSlip[]> => {
  const result = await getOrderSlipsPage({
    status: 'all',
    page: 1,
    perPage: 200,
  });
  return result.items;
};

export const getOrderSlip = async (id: string): Promise<OrderSlip | null> => {
  try {
    const data = await requestApi(
      `${API_BASE_URL}/order-slips/${encodeURIComponent(id)}?main_id=${encodeURIComponent(String(API_MAIN_ID))}`
    );
    return mapOrderSlipDetail(data);
  } catch {
    return null;
  }
};

export const finalizeOrderSlip = async (id: string): Promise<OrderSlip | null> => {
  const payload = {
    main_id: API_MAIN_ID,
    user_id: getUserContext().userId,
  };
  const data = await requestApi(`${API_BASE_URL}/order-slips/${encodeURIComponent(id)}/actions/post`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return mapOrderSlipDetail(data);
};

export const printOrderSlip = async (id: string): Promise<OrderSlip | null> => {
  const payload = {
    main_id: API_MAIN_ID,
    user_id: getUserContext().userId,
  };
  const data = await requestApi(`${API_BASE_URL}/order-slips/${encodeURIComponent(id)}/actions/print`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return mapOrderSlipDetail(data);
};
