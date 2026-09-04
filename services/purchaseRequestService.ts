// @ts-nocheck
import {
  PurchaseRequest,
  PurchaseRequestWithItems,
  CreatePRPayload,
  CreatePRItemPayload,
} from '../purchaseRequest.types';
import { getLocalAuthSession } from './localAuthService';
import { getCentralStock } from '../utils/productStock';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);
const API_TIMEOUT_MS = 20_000;

const getUserContext = () => {
  const session = getLocalAuthSession();
  const userId = Number(session?.context?.user?.id || 1);
  const sessionMainId = Number(session?.context?.user?.main_userid || 0);
  return {
    // Suggested Stock resolves its tenant from the signed-in session. Use the
    // same tenant here so its newly created PR belongs to the same company.
    mainId: Number.isFinite(sessionMainId) && sessionMainId > 0 ? sessionMainId : API_MAIN_ID,
    userId: Number.isFinite(userId) && userId > 0 ? userId : 1,
  };
};

const parseApiErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = await response.json();
    if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error.trim();
    if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message.trim();
  } catch {
    // no-op
  }
  return `API request failed (${response.status})`;
};

const requestApi = async (url: string, init?: RequestInit): Promise<any> => {
  const controller = new AbortController();
  const forwardAbort = () => controller.abort();
  init?.signal?.addEventListener('abort', forwardAbort, { once: true });
  const timeoutId = globalThis.setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  // Inject bearer token automatically if a session exists. Callers may still
  // override by passing their own Authorization header.
  const token = getLocalAuthSession()?.token;
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
    ...(token && !(init?.headers as Record<string, string> | undefined)?.Authorization
      ? { Authorization: `Bearer ${token}` }
      : {}),
  };

  try {
    const response = await fetch(url, { ...init, headers, signal: controller.signal });
    if (!response.ok) throw new Error(await parseApiErrorMessage(response));
    const payload = await response.json();
    if (!payload?.ok) throw new Error(payload?.error || 'API request failed');
    return payload.data;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('The purchase request server took too long to respond. Please try again.');
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
    init?.signal?.removeEventListener('abort', forwardAbort);
  }
};

const toNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const normalizeStatus = (value: unknown): string => {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'submitted') return 'Submitted';
  if (text === 'approved') return 'Approved';
  if (text === 'cancelled' || text === 'canceled') return 'Cancelled';
  if (text === 'unposted') return 'Unposted';
  if (text === 'deleted') return 'Deleted';
  if (text === 'draft') return 'Draft';
  return 'Pending';
};

const mapSummaryRow = (row: any): PurchaseRequestWithItems => {
  const itemCount = toNumber(row?.item_count, 0);
  const orderedQty = toNumber(row?.total_qty, 0);
  const receivedQty = toNumber(row?.received_qty, 0);
  return {
    id: String(row?.refno || row?.id || ''),
    pr_number: String(row?.pr_number || ''),
    request_date: String(row?.request_date || ''),
    notes: String(row?.notes || ''),
    reference_no: '',
    status: normalizeStatus(row?.status),
    created_by: String(row?.created_by || ''),
    created_by_name: String(row?.created_by_name || ''),
    created_at: String(row?.request_datetime || ''),
    updated_at: null,
    items: Array.from({ length: Math.max(0, itemCount) }).map(() => ({} as any)),
    item_count: itemCount,
    total_qty: toNumber(row?.total_qty, 0),
    total_cost: toNumber(row?.total_cost, 0),
    ordered_qty: orderedQty,
    received_qty: receivedQty,
    remaining_qty: toNumber(row?.remaining_qty, Math.max(0, orderedQty - receivedQty)),
    cycle_status: row?.cycle_status || (toNumber(row?.po_count, 0) > 0 ? 'PO Created' : 'Pending'),
    incomplete_delivery_reason: String(row?.incomplete_delivery_reason || ''),
    po_refno: String(row?.po_refno || ''),
    po_numbers: String(row?.po_numbers || ''),
  } as PurchaseRequestWithItems;
};

const mapDetail = (data: any): PurchaseRequestWithItems => {
  const request = data?.request || {};
  const items = Array.isArray(data?.items) ? data.items : [];
  const orderedQty = toNumber(request?.ordered_qty, items.reduce((sum: number, item: any) => sum + toNumber(item?.quantity), 0));
  const receivedQty = toNumber(request?.received_qty, 0);
  return {
    id: String(request?.refno || request?.id || ''),
    pr_number: String(request?.pr_number || ''),
    request_date: String(request?.request_date || ''),
    notes: String(request?.notes || ''),
    reference_no: '',
    status: normalizeStatus(request?.status),
    created_by: String(request?.created_by || ''),
    created_by_name: String(request?.created_by_name || ''),
    created_at: String(request?.request_datetime || ''),
    updated_at: null,
    ordered_qty: orderedQty,
    received_qty: receivedQty,
    remaining_qty: Math.max(0, orderedQty - receivedQty),
    cycle_status: request?.cycle_status || (items.some((item: any) => item?.po_refno) ? 'PO Created' : 'Pending'),
    items: items.map((item: any) => ({
      id: String(item?.id || ''),
      pr_id: String(request?.refno || ''),
      item_id: String(item?.item_id || ''),
      item_code: String(item?.item_code || ''),
      part_number: String(item?.part_number || ''),
      original_part_no: String(item?.original_part_no || item?.opn_number || ''),
      brand: String(item?.brand || ''),
      description: String(item?.description || ''),
      quantity: toNumber(item?.quantity, 0),
      unit: String(item?.unit || 'PCS'),
      unit_cost: toNumber(item?.unit_cost, 0),
      supplier_id: String(item?.supplier_id || ''),
      supplier_name: String(item?.supplier_name || ''),
      eta_date: String(item?.eta_date || ''),
      po_refno: String(item?.po_refno || ''),
      po_number: String(item?.po_number || ''),
      created_at: null,
      updated_at: null,
      sr_cases: toNumber(item?.sr_cases, 0),
      ir_cases: toNumber(item?.ir_cases, 0),
      recommendation: item?.recommendation === 'Good' || (toNumber(item?.sr_cases, 0) + toNumber(item?.ir_cases, 0) === 0) ? 'Good' : 'Review Supplier',
    })),
  } as PurchaseRequestWithItems;
};

const mapCreateItemPayload = (item: CreatePRItemPayload) => ({
  item_id: item.item_id,
  item_code: item.item_code,
  part_number: item.part_number,
  original_part_no: item.original_part_no,
  brand: item.brand,
  description: item.description,
  quantity: toNumber(item.quantity, 0),
  unit: item.unit || 'PCS',
  unit_cost: toNumber(item.unit_cost ?? 0, 0),
  supplier_id: item.supplier_id || '',
  supplier_name: item.supplier_name || '',
  eta_date: item.eta_date || '',
});

export const purchaseRequestService = {
  async getPurchaseRequests(filters?: { month?: number; year?: number; status?: string; search?: string; availableForPO?: boolean; includeSubmitted?: boolean }): Promise<PurchaseRequestWithItems[]> {
    const query = new URLSearchParams({
      main_id: String(API_MAIN_ID),
      page: '1',
      per_page: '500',
    });
    if (filters?.month) query.set('month', String(filters.month));
    if (filters?.year) query.set('year', String(filters.year));
    if (filters?.status && filters.status !== 'All' && filters.status !== 'All Statuses') query.set('status', filters.status);
    if (filters?.search?.trim()) query.set('search', filters.search.trim());
    if (filters?.availableForPO) query.set('available_for_po', '1');
    if (filters?.includeSubmitted) query.set('include_submitted', '1');

    const data = await requestApi(`${API_BASE_URL}/purchase-requests?${query.toString()}`);
    const rows = Array.isArray(data?.items) ? data.items : [];
    return rows.map(mapSummaryRow);
  },

  async getPurchaseRequestById(id: string): Promise<PurchaseRequestWithItems> {
    const data = await requestApi(
      `${API_BASE_URL}/purchase-requests/${encodeURIComponent(id)}?main_id=${encodeURIComponent(String(API_MAIN_ID))}`
    );
    return mapDetail(data);
  },

  async createPurchaseRequest(payload: CreatePRPayload): Promise<PurchaseRequestWithItems> {
    const ctx = getUserContext();
    const data = await requestApi(`${API_BASE_URL}/purchase-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        main_id: ctx.mainId,
        user_id: ctx.userId,
        pr_number: payload.pr_number,
        request_date: payload.request_date,
        notes: payload.notes || '',
        reference_no: payload.reference_no || '',
        status: payload.status || 'Pending',
        items: (payload.items || []).map(mapCreateItemPayload),
      }),
    });
    return mapDetail(data);
  },

  async updatePurchaseRequest(id: string, updates: Partial<PurchaseRequest>): Promise<void> {
    await requestApi(`${API_BASE_URL}/purchase-requests/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        main_id: API_MAIN_ID,
        status: updates.status,
        request_date: updates.request_date,
        notes: updates.notes,
        reference_no: updates.reference_no,
        pr_number: updates.pr_number,
      }),
    });
  },

  async deletePurchaseRequest(id: string, reason: string): Promise<void> {
    const ctx = getUserContext();
    await requestApi(
      `${API_BASE_URL}/purchase-requests/${encodeURIComponent(id)}?main_id=${encodeURIComponent(String(API_MAIN_ID))}`,
      { method: 'DELETE', headers: { 'Content-Type': 'application/json', ...(getLocalAuthSession()?.token ? { Authorization: `Bearer ${getLocalAuthSession()?.token}` } : {}) }, body: JSON.stringify({ main_id: ctx.mainId, user_id: ctx.userId, reason }) }
    );
  },

  async unpostPurchaseRequest(id: string, reason: string): Promise<void> {
    const ctx = getUserContext();
    await requestApi(`${API_BASE_URL}/purchase-requests/${encodeURIComponent(id)}/actions/unpost`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(getLocalAuthSession()?.token ? { Authorization: `Bearer ${getLocalAuthSession()?.token}` } : {}) },
      body: JSON.stringify({ main_id: ctx.mainId, user_id: ctx.userId, reason }),
    });
  },

  async addPRItem(prId: string, item: CreatePRItemPayload): Promise<void> {
    const ctx = getUserContext();
    await requestApi(`${API_BASE_URL}/purchase-requests/${encodeURIComponent(prId)}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        main_id: ctx.mainId,
        user_id: ctx.userId,
        ...mapCreateItemPayload(item),
      }),
    });
  },

  async updatePRItem(itemId: string, updates: any): Promise<void> {
    await requestApi(`${API_BASE_URL}/purchase-request-items/${encodeURIComponent(itemId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        main_id: API_MAIN_ID,
        quantity: updates.quantity,
        unit_cost: updates.unit_cost,
        supplier_id: updates.supplier_id,
        eta_date: updates.eta_date,
        notes: updates.notes,
      }),
    });
  },

  async deletePRItem(itemId: string): Promise<void> {
    await requestApi(
      `${API_BASE_URL}/purchase-request-items/${encodeURIComponent(itemId)}?main_id=${encodeURIComponent(String(API_MAIN_ID))}`,
      { method: 'DELETE' }
    );
  },

  async generatePRNumber(): Promise<string> {
    const data = await requestApi(
      `${API_BASE_URL}/purchase-requests/next-number?main_id=${encodeURIComponent(String(API_MAIN_ID))}`
    );
    return String(data?.pr_number || '');
  },

  async getSuppliers() {
    const data = await requestApi(
      `${API_BASE_URL}/purchase-orders/suppliers?main_id=${encodeURIComponent(String(API_MAIN_ID))}`
    );
    const rows = Array.isArray(data) ? data : [];
    return rows.map((row: any) => ({
      id: String(row?.id || ''),
      company: String(row?.name || ''),
      payment_terms: '',
    }));
  },

  async getProducts() {
    const all: any[] = [];
    let page = 1;
    let totalPages = 1;
    do {
      const data = await requestApi(
        `${API_BASE_URL}/products?main_id=${encodeURIComponent(String(API_MAIN_ID))}&status=active&page=${page}&per_page=500`
      );
      const rows = Array.isArray(data?.items) ? data.items : [];
      all.push(...rows);
      totalPages = toNumber(data?.meta?.total_pages, 1);
      page += 1;
    } while (page <= totalPages && page <= 20);

    return all.map((row: any) => ({
      id: String(row?.id || ''),
      item_code: String(row?.item_code || ''),
      part_number: String(row?.part_no || ''),
      original_part_no: String(row?.original_pn_no || ''),
      brand: String(row?.brand || ''),
      name: String(row?.description || ''),
      description: String(row?.description || ''),
      cost: toNumber(row?.cost, 0),
      quantity: getCentralStock(row),
    }));
  },

  async getSupplierItemCost(supplierId: string, itemId: string) {
    const request = await this.getPurchaseRequests({ status: 'all' });
    for (const pr of request) {
      const match = (pr.items || []).find((item: any) => item.item_id === itemId && item.supplier_id === supplierId);
      if (match && Number(match.unit_cost) > 0) return Number(match.unit_cost);
    }
    return 0;
  },

  async convertToPO(prIds: string[], approverId: string, options?: { supplierId?: string; itemIds?: string[] }): Promise<string> {
    const prId = String(prIds?.[0] || '');
    if (!prId) throw new Error('No purchase request selected for conversion');
    const ctx = getUserContext();
    const data = await requestApi(
      `${API_BASE_URL}/purchase-requests/${encodeURIComponent(prId)}/actions/convert-po`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          main_id: ctx.mainId,
          user_id: ctx.userId,
          approver_id: approverId || String(ctx.userId),
          supplier_id: options?.supplierId || '',
          item_ids: options?.itemIds || [],
        }),
      }
    );
    return String(data?.conversion?.po_refno || data?.conversion?.po_number || '');
  },
};
