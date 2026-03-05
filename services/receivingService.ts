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

const toUiStatus = (apiStatus: unknown): string => {
    const normalized = String(apiStatus || '').trim().toLowerCase();
    if (normalized === 'delivered' || normalized === 'posted') return 'Posted';
    if (normalized === 'cancelled' || normalized === 'canceled') return 'Cancelled';
    return 'Draft';
};

const toApiStatus = (uiStatus: unknown): string => {
    const normalized = String(uiStatus || '').trim().toLowerCase();
    if (normalized === 'posted' || normalized === 'delivered') return 'Delivered';
    if (normalized === 'cancelled' || normalized === 'canceled') return 'Cancelled';
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
    return {
        id: String(raw?.id ?? ''),
        rr_id: rrId,
        item_id: String(raw?.product_session ?? raw?.product_id ?? ''),
        item_code: String(raw?.item_code ?? ''),
        part_no: String(raw?.part_no ?? ''),
        description: String(raw?.description ?? ''),
        qty_received: qty,
        unit_cost: unitCost,
        total_amount: toNumber(raw?.line_total ?? qty * unitCost),
        qty_ordered: 0,
        qty_returned: 0,
        created_at: new Date().toISOString(),
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
        created_at: raw?.posted_date
            ? new Date(raw.posted_date).toISOString()
            : new Date().toISOString(),
        received_by: String(raw?.created_by ?? ''),
        items: [],
    } as ReceivingReportWithDetails;
};

const toReceivingDetail = (payload: any): ReceivingReportWithDetails => {
    const record = payload?.record || {};
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const summary = payload?.summary || {};
    const rrId = String(record?.refno ?? record?.id ?? '');

    return {
        id: rrId,
        rr_no: String(record?.rr_number ?? ''),
        receive_date: String(record?.receive_date ?? new Date().toISOString().slice(0, 10)),
        supplier_id: String(record?.supplier_id ?? ''),
        supplier_name: String(record?.supplier_name ?? ''),
        po_no: String(record?.po_number ?? ''),
        remarks: String(record?.reference ?? ''),
        warehouse_id: String(items?.[0]?.warehouse_name || items?.[0]?.warehouse_id || 'WH1'),
        grand_total: toNumber(summary?.total_cost ?? 0),
        status: toUiStatus(record?.status),
        created_at: record?.posted_date
            ? new Date(record.posted_date).toISOString()
            : new Date().toISOString(),
        received_by: String(record?.created_by ?? ''),
        items: items.map((item: any) => ({
            ...toReceivingItem(item, rrId),
            product: null,
        })),
    } as ReceivingReportWithDetails;
};

export const receivingService = {
    async getReceivingReports(filters?: { month?: number; year?: number; status?: string; search?: string }): Promise<ReceivingReportWithDetails[]> {
        const now = new Date();
        const month = Math.max(1, Math.min(12, Number(filters?.month || now.getMonth() + 1)));
        const year = Number(filters?.year || now.getFullYear());
        const status = toApiStatusFilter(filters?.status);
        const search = String(filters?.search || '').trim();

        const query = new URLSearchParams({
            main_id: String(API_MAIN_ID),
            month: String(month),
            year: String(year),
            status,
            page: '1',
            per_page: '200',
        });
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
        return toReceivingDetail(payload?.data || {});
    },

    async createReceivingReport(rr: ReceivingReportInsert): Promise<ReceivingReport> {
        const { mainId, userId } = getUserContext();

        const response = await fetch(`${API_BASE_URL}/receiving-stocks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                main_id: mainId,
                user_id: userId,
                rr_number: rr?.rr_no || undefined,
                receive_date: rr?.receive_date,
                supplier_id: rr?.supplier_id || '',
                po_number: rr?.po_no || '',
                reference: rr?.remarks || '',
                status: toApiStatus(rr?.status || 'Draft'),
                items: (items || []).map((item) => ({
                    product_session: String(item?.item_id || ''),
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
            headers: { 'Content-Type': 'application/json' },
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

    async deleteReceivingReport(id: string): Promise<void> {
        const response = await fetch(
            `${API_BASE_URL}/receiving-stocks/${encodeURIComponent(String(id))}?main_id=${encodeURIComponent(String(API_MAIN_ID))}`,
            { method: 'DELETE' }
        );
        if (!response.ok) throw new Error(await parseApiErrorMessage(response));
    },

    async finalizeReceivingReport(id: string): Promise<void> {
        const response = await fetch(`${API_BASE_URL}/receiving-stocks/${encodeURIComponent(String(id))}/finalize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                main_id: API_MAIN_ID,
                status: 'Delivered',
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
            headers: { 'Content-Type': 'application/json' },
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
            headers: { 'Content-Type': 'application/json' },
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

        return merged as Product[];
    },
};
