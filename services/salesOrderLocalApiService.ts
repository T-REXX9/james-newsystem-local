import { Contact, SalesOrder, SalesOrderItem, SalesOrderStatus } from '../types';
import { getLocalAuthSession } from './localAuthService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || 'http://127.0.0.1:8081/api/v1';
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

const normalizeOldSystemStatus = (status: unknown): string => {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'submitted') return 'Submitted';
  if (normalized === 'approved') return 'Approved';
  if (normalized === 'posted') return 'Posted';
  if (normalized === 'cancelled' || normalized === 'canceled') return 'Cancelled';
  return 'Pending';
};

const mapApiItem = (item: any, orderId: string): SalesOrderItem => ({
  id: String(item?.id ?? ''),
  order_id: orderId,
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

const mapApiOrderSummary = (raw: any): SalesOrder => {
  const orderId = String(raw?.sales_refno || raw?.id || '');
  return {
    id: orderId,
    order_no: String(raw?.sales_no || ''),
    inquiry_id: String(raw?.inquiry_refno || ''),
    contact_id: String(raw?.contact_id || ''),
    sales_date: String(raw?.sales_date || new Date().toISOString().slice(0, 10)),
    sales_person: String(raw?.sales_person || ''),
    delivery_address: String(raw?.delivery_address || ''),
    reference_no: String(raw?.reference_no || ''),
    customer_reference: String(raw?.customer_reference || ''),
    send_by: '',
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
    status: normalizeOldSystemStatus(raw?.status || raw?.transaction_status) as SalesOrderStatus,
    approved_by: '',
    approved_at: '',
    created_by: String(raw?.created_by || ''),
    created_at: String(raw?.sales_date || ''),
    updated_at: '',
    items: [],
    is_deleted: toNumber(raw?.is_cancelled, 0) > 0,
  };
};

const mapApiOrderDetail = (payload: any): SalesOrder => {
  const order = payload?.order || {};
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const summary = payload?.summary || {};
  const mapped = mapApiOrderSummary({
    ...order,
    grand_total: summary?.grand_total,
  });
  return {
    ...mapped,
    items: items.map((item: any) => mapApiItem(item, mapped.id)),
    grand_total: toNumber(summary?.grand_total, mapped.grand_total),
  };
};

export interface SalesOrdersPageFilters {
  month?: number;
  year?: number;
  status?: string;
  search?: string;
  page?: number;
  perPage?: number;
}

export interface SalesOrdersPageResult {
  items: SalesOrder[];
  meta: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

export const getSalesOrdersPage = async (filters: SalesOrdersPageFilters): Promise<SalesOrdersPageResult> => {
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

  const query = new URLSearchParams({
    main_id: String(API_MAIN_ID),
    status,
    page: String(page),
    per_page: String(perPage),
  });
  if (month !== undefined) query.set('month', String(month));
  if (year !== undefined) query.set('year', String(year));
  if (search) query.set('search', search);

  const list = await requestApi(`${API_BASE_URL}/sales-orders?${query.toString()}`);
  const rows = Array.isArray(list?.items) ? list.items : [];
  return {
    items: rows.map(mapApiOrderSummary),
    meta: {
      page: toNumber(list?.meta?.page, page),
      per_page: toNumber(list?.meta?.per_page, perPage),
      total: toNumber(list?.meta?.total, rows.length),
      total_pages: toNumber(list?.meta?.total_pages, 1),
    },
  };
};

export const getAllSalesOrders = async (): Promise<SalesOrder[]> => {
  const now = new Date();
  const result = await getSalesOrdersPage({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    status: 'all',
    page: 1,
    perPage: 200,
  });
  return result.items;
};

export const getSalesOrder = async (id: string): Promise<SalesOrder | null> => {
  try {
    const data = await requestApi(
      `${API_BASE_URL}/sales-orders/${encodeURIComponent(id)}?main_id=${encodeURIComponent(String(API_MAIN_ID))}`
    );
    return mapApiOrderDetail(data);
  } catch {
    return null;
  }
};

export const getSalesOrderByInquiry = async (inquiryRefno: string): Promise<SalesOrder | null> => {
  try {
    const flow = await requestApi(
      `${API_BASE_URL}/sales/flow/inquiry/${encodeURIComponent(inquiryRefno)}?main_id=${encodeURIComponent(String(API_MAIN_ID))}`
    );
    const salesRefno = String(flow?.sales_order?.lrefno || '');
    if (!salesRefno) return null;
    return await getSalesOrder(salesRefno);
  } catch {
    return null;
  }
};

export const confirmSalesOrder = async (id: string): Promise<SalesOrder | null> => {
  const existing = await getSalesOrder(id);
  if (!existing) throw new Error('Sales order not found');
  const current = String(existing.status || '').toLowerCase();
  const action = current === 'pending' ? 'submit' : 'approve';

  const payload = {
    main_id: API_MAIN_ID,
    user_id: getUserContext().userId,
  };
  const data = await requestApi(`${API_BASE_URL}/sales-orders/${encodeURIComponent(id)}/actions/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return mapApiOrderDetail(data);
};

export const convertToDocument = async (_orderId: string): Promise<never> => {
  throw new Error('Sales order to document conversion is not available in local API mode yet.');
};

export const readDocumentPolicyFromStorage = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(DOCUMENT_POLICY_STORAGE_KEY);
  } catch {
    return null;
  }
};

export const DOCUMENT_POLICY_STORAGE_KEY = 'document:selectedTransactionType';

export const syncDocumentPolicyState = (transactionType?: string | null): void => {
  if (typeof window === 'undefined') return;
  try {
    if (transactionType) {
      window.sessionStorage.setItem(DOCUMENT_POLICY_STORAGE_KEY, transactionType);
    } else {
      window.sessionStorage.removeItem(DOCUMENT_POLICY_STORAGE_KEY);
    }
  } catch {
    // no-op
  }

  try {
    window.dispatchEvent(
      new CustomEvent('documentPolicy:update', {
        detail: { transactionType: transactionType || null },
      })
    );
  } catch {
    // no-op
  }
};

export const isOrderSlipAllowedForTransactionType = (transactionType?: string | null): boolean => {
  if (!transactionType) return true;
  const normalized = String(transactionType).toLowerCase();
  return !(normalized.includes('invoice') || normalized.includes('sales invoice'));
};

export const isInvoiceAllowedForTransactionType = (transactionType?: string | null): boolean => {
  if (!transactionType) return true;
  const normalized = String(transactionType).toLowerCase();
  return !(normalized.includes('order slip') || normalized === 'po');
};

export const getDocumentTypeForTransaction = (
  transactionType?: string | null
): 'orderslip' | 'invoice' | null => {
  if (!transactionType) return null;
  if (isOrderSlipAllowedForTransactionType(transactionType) && !isInvoiceAllowedForTransactionType(transactionType)) {
    return 'orderslip';
  }
  if (isInvoiceAllowedForTransactionType(transactionType) && !isOrderSlipAllowedForTransactionType(transactionType)) {
    return 'invoice';
  }
  return null;
};

export const getSalesOrdersByCustomer = async (customerId: string): Promise<SalesOrder[]> => {
  const all = await getAllSalesOrders();
  return all.filter((row) => row.contact_id === customerId);
};

export const buildCustomerLabel = (order: SalesOrder, customer?: Contact | null): string => {
  return customer?.company || order.contact_id || '';
};
