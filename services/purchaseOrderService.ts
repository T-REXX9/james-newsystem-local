// @ts-nocheck
import {
  PurchaseOrder,
  PurchaseOrderInsert,
  PurchaseOrderUpdate,
  PurchaseOrderItem,
  PurchaseOrderItemInsert,
  PurchaseOrderItemUpdate,
  PurchaseOrderWithDetails,
  Product,
  Supplier,
} from '../purchaseOrderTypes';
import { fetchProductsPage } from './productLocalApiService';
import { getLocalAuthSession } from './localAuthService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

const toNumber = (value: unknown): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const normalizePurchaseOrderStatus = (value: unknown): string => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized || normalized === 'draft') return 'Pending';
  if (normalized === 'approved' || normalized === 'posted') return 'Posted';
  if (normalized === 'partial delivery') return 'Partial Delivery';
  if (normalized === 'cancelled') return 'Cancelled';
  return String(value ?? 'Pending');
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

const getUserContext = () => {
  const session = getLocalAuthSession();
  const userId = Number(session?.context?.user?.id || 1);
  return {
    mainId: API_MAIN_ID,
    userId: Number.isFinite(userId) && userId > 0 ? userId : 1,
  };
};

const toSupplier = (raw: any): Supplier => ({
  id: String(raw?.id ?? ''),
  company: String(raw?.name ?? raw?.company ?? ''),
  address: String(raw?.address ?? ''),
  transactionType: 'PO',
});

const toProduct = (raw: any): Product => ({
  id: String(raw?.id ?? raw?.product_session ?? raw?.product_id ?? ''),
  part_no: String(raw?.part_no ?? ''),
  description: String(raw?.description ?? ''),
  item_code: String(raw?.item_code ?? ''),
  brand: String(raw?.brand ?? ''),
  cost: toNumber(raw?.supplier_price ?? 0),
});

const toPurchaseOrderItem = (raw: any): PurchaseOrderItem => ({
  id: String(raw?.id ?? ''),
  po_id: String(raw?.po_refno ?? ''),
  item_id: String(raw?.product_session ?? raw?.product_id ?? ''),
  qty: toNumber(raw?.qty),
  unit_price: toNumber(raw?.supplier_price),
  amount: toNumber(raw?.line_total),
  eta_date: raw?.eta_date || null,
  quantity_received: toNumber(raw?.receiving_qty),
  product: toProduct(raw),
});

const toPurchaseOrder = (raw: any): PurchaseOrderWithDetails => {
  const supplierName = String(raw?.supplier_name ?? '');
  const supplierAddress = String(raw?.address ?? '');

  return {
    id: String(raw?.refno ?? raw?.id ?? ''),
    po_number: String(raw?.po_number ?? ''),
    order_date: String(raw?.order_date ?? new Date().toISOString().slice(0, 10)),
    supplier_id: String(raw?.supplier_id ?? ''),
    warehouse_id: 'WH1',
    remarks: String(raw?.reference ?? ''),
    pr_reference: String(raw?.pr_number ?? ''),
    status: normalizePurchaseOrderStatus(raw?.status ?? 'Pending'),
    grand_total: toNumber(raw?.total_cogs ?? 0),
    supplier: {
      id: String(raw?.supplier_id ?? ''),
      company: supplierName,
      address: supplierAddress,
      transactionType: 'PO',
    },
    items: [],
    creator: null,
    approver: null,
  } as PurchaseOrderWithDetails;
};

const toPurchaseOrderDetail = (payload: any): PurchaseOrderWithDetails => {
  const order = payload?.order || {};
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const summary = payload?.summary || {};

  return {
    id: String(order?.refno ?? order?.id ?? ''),
    po_number: String(order?.po_number ?? ''),
    order_date: String(order?.order_date ?? new Date().toISOString().slice(0, 10)),
    supplier_id: String(order?.supplier_id ?? ''),
    warehouse_id: 'WH1',
    remarks: String(order?.reference ?? ''),
    pr_reference: String(order?.pr_number ?? ''),
    status: normalizePurchaseOrderStatus(order?.status ?? 'Pending'),
    grand_total: toNumber(summary?.total_cogs ?? 0),
    supplier: {
      id: String(order?.supplier_id ?? ''),
      company: String(order?.supplier_name ?? ''),
      address: String(order?.address ?? ''),
      transactionType: 'PO',
    },
    items: items.map(toPurchaseOrderItem),
    creator: null,
    approver: null,
  } as PurchaseOrderWithDetails;
};

export const purchaseOrderService = {
  async getPurchaseOrders(filters?: { month?: number; year?: number; status?: string; search?: string; page?: number; perPage?: number }): Promise<PurchaseOrderWithDetails[]> {
    const now = new Date();
    const month = Math.max(1, Math.min(12, Number(filters?.month || now.getMonth() + 1)));
    const year = Number(filters?.year || now.getFullYear());
    const status = String(filters?.status || 'all').trim().toLowerCase() || 'all';
    const search = String(filters?.search || '').trim();
    const page = Math.max(1, Number(filters?.page || 1));
    const perPage = Math.max(1, Math.min(500, Number(filters?.perPage || 200)));

    const query = new URLSearchParams({
      main_id: String(API_MAIN_ID),
      month: String(month),
      year: String(year),
      status,
      page: String(page),
      per_page: String(perPage),
    });
    if (search) query.set('search', search);

    const response = await fetch(`${API_BASE_URL}/purchase-orders?${query.toString()}`);
    if (!response.ok) throw new Error(await parseApiErrorMessage(response));

    const payload = await response.json();
    const items = Array.isArray(payload?.data?.items) ? payload.data.items : [];
    return items.map(toPurchaseOrder);
  },

  async getPurchaseOrderById(id: string): Promise<PurchaseOrderWithDetails> {
    const response = await fetch(
      `${API_BASE_URL}/purchase-orders/${encodeURIComponent(String(id))}?main_id=${encodeURIComponent(String(API_MAIN_ID))}`
    );
    if (!response.ok) throw new Error(await parseApiErrorMessage(response));

    const payload = await response.json();
    return toPurchaseOrderDetail(payload?.data || {});
  },

  async createPurchaseOrder(po: PurchaseOrderInsert): Promise<PurchaseOrder> {
    const { mainId, userId } = getUserContext();

    const response = await fetch(`${API_BASE_URL}/purchase-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        main_id: mainId,
        user_id: userId,
        po_number: po?.po_number || undefined,
        order_date: po?.order_date,
        supplier_id: po?.supplier_id || '',
        status: normalizePurchaseOrderStatus(po?.status || 'Pending'),
        reference: po?.remarks || '',
      }),
    });
    if (!response.ok) throw new Error(await parseApiErrorMessage(response));

    const payload = await response.json();
    const created = payload?.data?.order || {};
    return {
      id: String(created?.refno ?? created?.id ?? ''),
      po_number: String(created?.po_number ?? ''),
      order_date: String(created?.order_date ?? new Date().toISOString().slice(0, 10)),
      supplier_id: String(created?.supplier_id ?? ''),
      warehouse_id: 'WH1',
      remarks: String(created?.reference ?? ''),
      pr_reference: String(created?.pr_number ?? ''),
      status: normalizePurchaseOrderStatus(created?.status ?? 'Pending'),
      grand_total: 0,
    } as PurchaseOrder;
  },

  async updatePurchaseOrder(id: string, updates: PurchaseOrderUpdate): Promise<PurchaseOrder> {
    const response = await fetch(`${API_BASE_URL}/purchase-orders/${encodeURIComponent(String(id))}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        main_id: API_MAIN_ID,
        order_date: updates?.order_date,
        supplier_id: updates?.supplier_id,
        status: normalizePurchaseOrderStatus(updates?.status),
        reference: updates?.remarks,
        terms: (updates as any)?.terms,
        address: (updates as any)?.address,
        pr_number: (updates as any)?.pr_reference,
      }),
    });
    if (!response.ok) throw new Error(await parseApiErrorMessage(response));

    const payload = await response.json();
    const order = payload?.data?.order || {};
    const summary = payload?.data?.summary || {};

    return {
      id: String(order?.refno ?? order?.id ?? ''),
      po_number: String(order?.po_number ?? ''),
      order_date: String(order?.order_date ?? new Date().toISOString().slice(0, 10)),
      supplier_id: String(order?.supplier_id ?? ''),
      warehouse_id: 'WH1',
      remarks: String(order?.reference ?? ''),
      pr_reference: String(order?.pr_number ?? ''),
      status: normalizePurchaseOrderStatus(order?.status ?? 'Pending'),
      grand_total: toNumber(summary?.total_cogs ?? 0),
    } as PurchaseOrder;
  },

  async deletePurchaseOrder(id: string): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/purchase-orders/${encodeURIComponent(String(id))}?main_id=${encodeURIComponent(String(API_MAIN_ID))}`,
      { method: 'DELETE' }
    );
    if (!response.ok) throw new Error(await parseApiErrorMessage(response));
  },

  async getPurchaseOrderItems(poId: string): Promise<PurchaseOrderItem[]> {
    const detail = await this.getPurchaseOrderById(poId);
    return detail.items || [];
  },

  async addPurchaseOrderItem(item: PurchaseOrderItemInsert): Promise<PurchaseOrderItem> {
    const { mainId, userId } = getUserContext();
    const poRefno = String(item?.po_id || '');
    if (!poRefno) {
      throw new Error('po_id is required');
    }

    const response = await fetch(`${API_BASE_URL}/purchase-orders/${encodeURIComponent(poRefno)}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        main_id: mainId,
        user_id: userId,
        product_session: String(item?.item_id || ''),
        qty: toNumber(item?.qty),
        eta_date: (item as any)?.eta_date || undefined,
      }),
    });
    if (!response.ok) throw new Error(await parseApiErrorMessage(response));

    const payload = await response.json();
    return toPurchaseOrderItem(payload?.data || {});
  },

  async updatePurchaseOrderItem(id: string, updates: PurchaseOrderItemUpdate): Promise<PurchaseOrderItem> {
    const response = await fetch(`${API_BASE_URL}/purchase-order-items/${encodeURIComponent(String(id))}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        main_id: API_MAIN_ID,
        qty: updates?.qty,
        supplier_price: updates?.unit_price,
        eta_date: (updates as any)?.eta_date,
      }),
    });
    if (!response.ok) throw new Error(await parseApiErrorMessage(response));

    const payload = await response.json();
    return toPurchaseOrderItem(payload?.data || {});
  },

  async deletePurchaseOrderItem(id: string): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/purchase-order-items/${encodeURIComponent(String(id))}?main_id=${encodeURIComponent(String(API_MAIN_ID))}`,
      { method: 'DELETE' }
    );
    if (!response.ok) throw new Error(await parseApiErrorMessage(response));
  },

  async getSuppliers(): Promise<Supplier[]> {
    const response = await fetch(
      `${API_BASE_URL}/purchase-orders/suppliers?main_id=${encodeURIComponent(String(API_MAIN_ID))}`
    );
    if (!response.ok) throw new Error(await parseApiErrorMessage(response));

    const payload = await response.json();
    const rows = Array.isArray(payload?.data) ? payload.data : [];
    return rows.map(toSupplier);
  },

  async getProducts(): Promise<Product[]> {
    const merged: Product[] = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const result = await fetchProductsPage({
        search: '',
        status: 'all',
        page,
        perPage: 200,
      });
      merged.push(...result.items);
      totalPages = Number(result?.meta?.total_pages || 1);
      page += 1;
    }

    return merged;
  },

  async generatePONumber(): Promise<string> {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const sec = String(now.getSeconds()).padStart(2, '0');
    return `PO-${yy}${mm}${dd}${hh}${min}${sec}`;
  },
};

export const getPurchaseOrder = async (id: string): Promise<PurchaseOrderWithDetails | null> => {
  try {
    return await purchaseOrderService.getPurchaseOrderById(id);
  } catch {
    return null;
  }
};

export const getAllPurchaseOrders = async (filters?: { status?: string }): Promise<PurchaseOrderWithDetails[]> => {
  return purchaseOrderService.getPurchaseOrders({ status: filters?.status });
};

export const createPurchaseOrder = async (data: PurchaseOrderInsert & { items?: PurchaseOrderItemInsert[] }) => {
  return purchaseOrderService.createPurchaseOrder(data as PurchaseOrderInsert);
};

export const updatePurchaseOrder = async (
  id: string,
  updates: PurchaseOrderUpdate & { items?: PurchaseOrderItemInsert[] }
) => {
  return purchaseOrderService.updatePurchaseOrder(id, updates as PurchaseOrderUpdate);
};

export const markAsDelivered = async (id: string) => {
  await purchaseOrderService.updatePurchaseOrder(id, { status: 'Posted' } as PurchaseOrderUpdate);
  return purchaseOrderService.getPurchaseOrderById(id);
};
