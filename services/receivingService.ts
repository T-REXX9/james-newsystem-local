// @ts-nocheck
import {
    ReceivingReport,
    ReceivingReportInsert,
    ReceivingReportUpdate,
    ReceivingReportItem,
    ReceivingReportItemInsert,
    ReceivingReportItemUpdate,
    ReceivingReportWithDetails,
    Product,
    Supplier,
} from '../receiving.types';
import { fetchProductsPage } from './productLocalApiService';
import { getLocalAuthSession } from './localAuthService';
import { purchaseOrderService } from './purchaseOrderService';

export interface EligiblePurchaseOrder {
    id: string;
    poNumber: string;
    prNumber: string;
    supplierId: string;
    supplierName: string;
    orderDate: string;
    remainingLineCount: number;
}

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

const toNumber = (value: unknown): number => {
    const n = Number(value ?? 0);
    return Number.isFinite(n) ? n : 0;
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

const getAuthHeaders = (extra?: Record<string, string>): Record<string, string> => {
    const token = getLocalAuthSession()?.token;
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(extra || {}),
    };
};

const toUiStatus = (apiStatus: unknown): string => {
    const normalized = String(apiStatus || '').trim().toLowerCase();
    if (normalized === 'delivered' || normalized === 'posted') return 'Posted';
    if (normalized === 'cancelled' || normalized === 'canceled') return 'Cancelled';
    if (normalized === 'unposted') return 'Unposted';
    if (normalized === 'deleted') return 'Deleted';
    return 'Draft';
};

const toApiStatus = (uiStatus: unknown): string => {
    const normalized = String(uiStatus || '').trim().toLowerCase();
    if (normalized === 'posted' || normalized === 'delivered') return 'Delivered';
    if (normalized === 'cancelled' || normalized === 'canceled') return 'Cancelled';
    if (normalized === 'unposted') return 'Unposted';
    return 'Pending';
};

const toApiStatusFilter = (status: string | undefined): string => {
    const normalized = String(status || '').trim().toLowerCase();
    if (!normalized) return 'all';
    if (normalized === 'draft' || normalized === 'pending') return 'pending';
    if (normalized === 'posted' || normalized === 'delivered') return 'delivered';
    if (normalized === 'cancelled' || normalized === 'canceled') return 'cancelled';
    if (normalized === 'all') return 'all';
    return normalized;
};

const toSupplier = (raw: any): Supplier => ({
    id: String(raw?.id ?? ''),
    company: String(raw?.name ?? raw?.company ?? ''),
    address: String(raw?.address ?? ''),
    transactionType: 'PO',
});

const toReceivingItem = (raw: any, rrId: string): ReceivingReportItem => {
    const qty = toNumber(raw?.qty);
    const unitCost = toNumber(raw?.unit_cost);
    const brand = String(raw?.brand ?? '');
    const itemId = String(raw?.product_session ?? raw?.product_id ?? '');
    return {
        id: String(raw?.id ?? ''),
        rr_id: rrId,
        item_id: itemId,
        item_code: String(raw?.item_code ?? ''),
        part_no: String(raw?.part_no ?? ''),
        description: String(raw?.description ?? ''),
        qty_received: qty,
        unit_cost: unitCost,
        total_amount: toNumber(raw?.line_total ?? qty * unitCost),
        qty_ordered: toNumber(raw?.qty_ordered ?? 0),
        qty_returned: toNumber(raw?.qty_returned ?? 0),
        created_at: raw?.created_at ? String(raw.created_at) : new Date().toISOString(),
        original_part_no: String(raw?.original_part_no ?? raw?.opn_number ?? ''),
        po_item_id: toNumber(raw?.po_item_id ?? 0),
        brand,
        product: {
            id: itemId,
            item_code: String(raw?.item_code ?? ''),
            part_no: String(raw?.part_no ?? ''),
            description: String(raw?.description ?? ''),
            brand,
        },
    } as ReceivingReportItem;
};

const toReceivingListItem = (raw: any): ReceivingReportWithDetails => {
    const rrId = String(raw?.refno ?? raw?.id ?? '');
    return {
        id: rrId,
        rr_no: String(raw?.rr_number ?? ''),
        receive_date: String(raw?.receive_date ?? new Date().toISOString().slice(0, 10)),
        supplier_id: String(raw?.supplier_id ?? ''),
        supplier_name: String(raw?.supplier_name ?? ''),
        po_no: String(raw?.po_number ?? ''),
        remarks: String(raw?.reference ?? ''),
        warehouse_id: 'WH1',
        grand_total: toNumber(raw?.total_cost ?? 0),
        status: toUiStatus(raw?.status),
        po_refno: String(raw?.po_refno ?? ''),
        eta_date: raw?.eta_date ? String(raw.eta_date) : null,
        item_count: toNumber(raw?.item_count ?? 0),
        total_qty: toNumber(raw?.total_qty ?? 0),
        created_at: raw?.posted_date
            ? new Date(raw.posted_date).toISOString()
            : new Date().toISOString(),
        received_by: String(raw?.created_by ?? ''),
        items: [],
    } as ReceivingReportWithDetails;
};

const toReceivingDetail = (payload: any, purchaseOrder: Awaited<ReturnType<typeof purchaseOrderService.getPurchaseOrderById>> | null = null): ReceivingReportWithDetails => {
    const record = payload?.record || {};
    const rawItems = Array.isArray(payload?.items) ? payload.items : [];
    const summary = payload?.summary || {};
    const rrId = String(record?.refno ?? record?.id ?? '');
    const poItems = purchaseOrder?.items || [];

    const mappedItems = rawItems.map((item: any) => {
        const mapped = toReceivingItem(item, rrId) as ReceivingReportItem & {
            po_item_id?: number;
            qty_ordered?: number;
            brand?: string;
        };
        const poItem = poItems.find((candidate) => (
            (mapped.po_item_id && String(candidate.id) === String(mapped.po_item_id))
            || String(candidate.item_id || '') === String(mapped.item_id || '')
        ));
        return {
            ...mapped,
            po_item_id: mapped.po_item_id || (poItem ? Number(poItem.id) : 0),
            qty_ordered: mapped.qty_ordered || Number(poItem?.qty || mapped.qty_received || 0),
            product: mapped.product || poItem?.product || null,
            brand: mapped.brand || String(poItem?.product?.brand || ''),
        };
    });

    return {
        id: rrId,
        rr_no: String(record?.rr_number ?? ''),
        receive_date: String(record?.receive_date ?? new Date().toISOString().slice(0, 10)),
        supplier_id: String(record?.supplier_id ?? ''),
        supplier_name: String(record?.supplier_name ?? ''),
        po_no: String(record?.po_number ?? ''),
        remarks: String(record?.reference ?? ''),
        warehouse_id: String(rawItems?.[0]?.warehouse_name || rawItems?.[0]?.warehouse_id || 'WH1'),
        grand_total: toNumber(summary?.total_cost ?? 0),
        status: toUiStatus(record?.status),
        created_at: record?.posted_date
            ? new Date(record.posted_date).toISOString()
            : new Date().toISOString(),
        received_by: String(record?.created_by ?? ''),
        po_refno: String(record?.po_refno ?? ''),
        eta_date: record?.eta_date ? String(record.eta_date) : null,
        item_count: toNumber(summary?.item_count ?? mappedItems.length),
        total_qty: toNumber(summary?.total_qty ?? 0),
        po: purchaseOrder ? {
            id: String(purchaseOrder.id),
            po_number: String(purchaseOrder.po_number || ''),
            order_date: String(purchaseOrder.order_date || ''),
            pr_reference: String(purchaseOrder.pr_reference || ''),
            status: String(purchaseOrder.status || ''),
            items: poItems.map((item) => ({
                id: String(item.id),
                qty: Number(item.qty || 0),
                eta_date: item.eta_date || null,
            })),
        } : null,
        items: mappedItems,
    } as ReceivingReportWithDetails;
};

export const receivingService = {
    async getReceivingReports(filters?: { month?: number | string; year?: number | string; status?: string; search?: string }): Promise<ReceivingReportWithDetails[]> {
        const rawMonth = String(filters?.month ?? '').trim();
        const rawYear = String(filters?.year ?? '').trim();
        const month = rawMonth && rawMonth.toLowerCase() !== 'all' ? Math.max(1, Math.min(12, Number(rawMonth))) : null;
        const year = rawYear && rawYear.toLowerCase() !== 'all' ? Number(rawYear) : null;
        const status = toApiStatusFilter(filters?.status);
        const search = String(filters?.search || '').trim();

        const query = new URLSearchParams({
            main_id: String(API_MAIN_ID),
            status,
            page: '1',
            per_page: '200',
        });
        if (month !== null && Number.isFinite(month)) query.set('month', String(month));
        if (year !== null && Number.isFinite(year)) query.set('year', String(year));
        if (search) query.set('search', search);

        const response = await fetch(`${API_BASE_URL}/receiving-stocks?${query.toString()}`);
        if (!response.ok) throw new Error(await parseApiErrorMessage(response));

        const payload = await response.json();
        const rows = Array.isArray(payload?.data?.items) ? payload.data.items : [];
        return rows.map(toReceivingListItem);
    },

    async getReceivingReportById(id: string): Promise<ReceivingReportWithDetails> {
        const response = await fetch(
            `${API_BASE_URL}/receiving-stocks/${encodeURIComponent(String(id))}?main_id=${encodeURIComponent(String(API_MAIN_ID))}`
        );
        if (!response.ok) throw new Error(await parseApiErrorMessage(response));

        const payload = await response.json();
        const data = payload?.data || {};
        let purchaseOrder = null;
        const poRefno = String(data?.record?.po_refno ?? '').trim();
        if (poRefno) {
            try {
                purchaseOrder = await purchaseOrderService.getPurchaseOrderById(poRefno);
            } catch (error) {
                console.warn('Unable to load the linked purchase order for receiving detail', error);
            }
        }
        return toReceivingDetail(data, purchaseOrder);
    },

    async createReceivingReport(rr: ReceivingReportInsert): Promise<ReceivingReport> {
        const { mainId, userId } = getUserContext();

        const response = await fetch(`${API_BASE_URL}/receiving-stocks`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                main_id: mainId,
                user_id: userId,
                rr_number: rr?.rr_no || undefined,
                receive_date: rr?.receive_date,
                supplier_id: rr?.supplier_id || '',
                po_number: rr?.po_no || '',
                reference: rr?.remarks || '',
                status: toApiStatus(rr?.status),
            }),
        });
        if (!response.ok) throw new Error(await parseApiErrorMessage(response));

        const payload = await response.json();
        const record = payload?.data?.record || {};

        return {
            id: String(record?.refno ?? record?.id ?? ''),
            rr_no: String(record?.rr_number ?? ''),
            receive_date: String(record?.receive_date ?? new Date().toISOString().slice(0, 10)),
            supplier_id: String(record?.supplier_id ?? ''),
            supplier_name: String(record?.supplier_name ?? ''),
            po_no: String(record?.po_number ?? ''),
            remarks: String(record?.reference ?? ''),
            warehouse_id: 'WH1',
            grand_total: 0,
            status: toUiStatus(record?.status),
            created_at: new Date().toISOString(),
            received_by: String(record?.created_by ?? ''),
        } as ReceivingReport;
    },

    async createReceivingReportWithItems(
        rr: Omit<ReceivingReportInsert, 'rr_no' | 'grand_total' | 'status'> & {
            rr_no?: string | null;
            status?: string | null;
        },
        items: Omit<ReceivingReportItemInsert, 'rr_id'>[]
    ): Promise<ReceivingReport> {
        const { mainId, userId } = getUserContext();

        const response = await fetch(`${API_BASE_URL}/receiving-stocks`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                main_id: mainId,
                user_id: userId,
                rr_number: rr?.rr_no || undefined,
                receive_date: rr?.receive_date,
                supplier_id: rr?.supplier_id || '',
                po_refno: (rr as any)?.po_refno || '',
                po_number: rr?.po_no || '',
                reference: rr?.remarks || '',
                status: toApiStatus(rr?.status || 'Draft'),
                items: (items || []).map((item) => ({
                    product_session: String(item?.item_id || ''),
                    po_item_id: (item as any)?.po_item_id,
                    qty: toNumber(item?.qty_received),
                    unit_cost: toNumber(item?.unit_cost),
                    item_code: item?.item_code || '',
                    part_no: item?.part_no || '',
                    description: item?.description || '',
                    warehouse_id: rr?.warehouse_id || 'WH1',
                    location_id: 'Main',
                })),
            }),
        });
        if (!response.ok) throw new Error(await parseApiErrorMessage(response));

        const payload = await response.json();
        const detail = toReceivingDetail(payload?.data || {});

        return {
            id: detail.id,
            rr_no: detail.rr_no,
            receive_date: detail.receive_date,
            supplier_id: detail.supplier_id,
            supplier_name: detail.supplier_name,
            po_no: detail.po_no,
            remarks: detail.remarks,
            warehouse_id: detail.warehouse_id,
            grand_total: detail.grand_total,
            status: detail.status,
            created_at: detail.created_at,
            received_by: detail.received_by,
        } as ReceivingReport;
    },

    async updateReceivingReport(id: string, updates: ReceivingReportUpdate): Promise<ReceivingReport> {
        const response = await fetch(`${API_BASE_URL}/receiving-stocks/${encodeURIComponent(String(id))}`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                main_id: API_MAIN_ID,
                receive_date: updates?.receive_date,
                supplier_id: updates?.supplier_id,
                po_number: updates?.po_no,
                reference: updates?.remarks,
                status: toApiStatus(updates?.status),
            }),
        });
        if (!response.ok) throw new Error(await parseApiErrorMessage(response));

        const payload = await response.json();
        const detail = toReceivingDetail(payload?.data || {});

        return {
            id: detail.id,
            rr_no: detail.rr_no,
            receive_date: detail.receive_date,
            supplier_id: detail.supplier_id,
            supplier_name: detail.supplier_name,
            po_no: detail.po_no,
            remarks: detail.remarks,
            warehouse_id: detail.warehouse_id,
            grand_total: detail.grand_total,
            status: detail.status,
            created_at: detail.created_at,
            received_by: detail.received_by,
        } as ReceivingReport;
    },

    async deleteReceivingReport(id: string, reason: string): Promise<void> {
        const { mainId, userId } = getUserContext();
        const response = await fetch(
            `${API_BASE_URL}/receiving-stocks/${encodeURIComponent(String(id))}?main_id=${encodeURIComponent(String(API_MAIN_ID))}`,
            { method: 'DELETE', headers: getAuthHeaders(), body: JSON.stringify({ main_id: mainId, user_id: userId, reason }) }
        );
        if (!response.ok) throw new Error(await parseApiErrorMessage(response));
    },

    async unpostReceivingReport(id: string, reason: string): Promise<void> {
        const { mainId, userId } = getUserContext();
        const response = await fetch(`${API_BASE_URL}/receiving-stocks/${encodeURIComponent(String(id))}/actions/unpost`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ main_id: mainId, user_id: userId, reason }),
        });
        if (!response.ok) throw new Error(await parseApiErrorMessage(response));
    },

    async finalizeReceivingReport(
        id: string,
        options?: { closeRemainingPoQty?: boolean; shortReceiptReason?: string }
    ): Promise<void> {
        const response = await fetch(`${API_BASE_URL}/receiving-stocks/${encodeURIComponent(String(id))}/finalize`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                main_id: API_MAIN_ID,
                status: 'Delivered',
                close_remaining_po_qty: Boolean(options?.closeRemainingPoQty),
                short_receipt_reason: String(options?.shortReceiptReason || ''),
            }),
        });
        if (!response.ok) throw new Error(await parseApiErrorMessage(response));
    },

    async addReceivingReportItem(item: ReceivingReportItemInsert): Promise<ReceivingReportItem> {
        const { mainId, userId } = getUserContext();
        const rrId = String(item?.rr_id || '');
        if (!rrId) throw new Error('rr_id is required');

        const response = await fetch(`${API_BASE_URL}/receiving-stocks/${encodeURIComponent(rrId)}/items`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                main_id: mainId,
                user_id: userId,
                product_session: String(item?.item_id || ''),
                qty: toNumber(item?.qty_received),
                unit_cost: toNumber(item?.unit_cost),
                item_code: item?.item_code || '',
                part_no: item?.part_no || '',
                description: item?.description || '',
                location_id: 'Main',
                warehouse_id: 'WH1',
            }),
        });
        if (!response.ok) throw new Error(await parseApiErrorMessage(response));

        const payload = await response.json();
        return toReceivingItem(payload?.data || {}, rrId);
    },

    async updateReceivingReportItem(id: string, updates: ReceivingReportItemUpdate): Promise<ReceivingReportItem> {
        const response = await fetch(`${API_BASE_URL}/receiving-stock-items/${encodeURIComponent(String(id))}`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                main_id: API_MAIN_ID,
                qty: toNumber(updates?.qty_received),
                unit_cost: toNumber(updates?.unit_cost),
            }),
        });
        if (!response.ok) throw new Error(await parseApiErrorMessage(response));

        const payload = await response.json();
        const row = payload?.data || {};
        const rrId = String(row?.receiving_refno || updates?.rr_id || '');
        return toReceivingItem(row, rrId);
    },

    async deleteReceivingReportItem(id: string): Promise<void> {
        const response = await fetch(
            `${API_BASE_URL}/receiving-stock-items/${encodeURIComponent(String(id))}?main_id=${encodeURIComponent(String(API_MAIN_ID))}`,
            { method: 'DELETE' }
        );
        if (!response.ok) throw new Error(await parseApiErrorMessage(response));
    },

    async checkDuplicateRR(rrNo: string): Promise<boolean> {
        if (!rrNo || !rrNo.trim()) return false;
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        const list = await this.getReceivingReports({ month, year, search: rrNo.trim() });
        return list.some((rr) => String(rr.rr_no || '').trim().toLowerCase() === rrNo.trim().toLowerCase());
    },

    async generateRRNumber(): Promise<string> {
        const now = new Date();
        const yy = String(now.getFullYear()).slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        const sec = String(now.getSeconds()).padStart(2, '0');
        return `RR-${yy}${mm}${dd}${hh}${min}${sec}`;
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

    async getEligiblePurchaseOrders(): Promise<EligiblePurchaseOrder[]> {
        const response = await fetch(
            `${API_BASE_URL}/receiving-stocks/purchase-orders/eligible?main_id=${encodeURIComponent(String(API_MAIN_ID))}&limit=200`
        );
        if (!response.ok) throw new Error(await parseApiErrorMessage(response));
        const payload = await response.json();
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        return rows.map((row: any) => ({
            id: String(row?.refno ?? ''),
            poNumber: String(row?.po_number ?? ''),
            prNumber: String(row?.pr_number ?? ''),
            supplierId: String(row?.supplier_id ?? ''),
            supplierName: String(row?.supplier_name ?? ''),
            orderDate: String(row?.order_date ?? ''),
            remainingLineCount: toNumber(row?.remaining_line_count),
        }));
    },

    async getEligiblePurchaseOrderDetails(id: string) {
        return purchaseOrderService.getPurchaseOrderById(id);
    },

    async getProducts(): Promise<Product[]> {
        const merged: Product[] = [];
        let page = 1;
        let totalPages = 1;

        while (page <= totalPages) {
            const result = await fetchProductsPage({
                search: '',
                status: 'active',
                page,
                perPage: 200,
            });
            merged.push(...result.items);
            totalPages = Number(result?.meta?.total_pages || 1);
            page += 1;
        }

        return merged as Product[];
    },
};
