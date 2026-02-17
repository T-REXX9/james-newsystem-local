import { CreateReturnDTO, RRItemForReturn, SupplierReturn, SupplierReturnItem } from '../returnToSupplier.types';
import { getLocalAuthSession } from './localAuthService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || 'http://127.0.0.1:8081/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

const requestApi = async (url: string, init?: RequestInit): Promise<any> => {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || `API request failed (${response.status})`);
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

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const mapStatus = (status: unknown): SupplierReturn['status'] => {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'posted') return 'Posted';
  if (normalized === 'cancelled' || normalized === 'canceled') return 'Cancelled';
  return 'Pending';
};

const mapSupplierReturn = (raw: any): SupplierReturn => ({
  id: String(raw?.refno || raw?.id || ''),
  return_no: String(raw?.return_no || ''),
  reference_no: String(raw?.refno || ''),
  return_type: String(raw?.return_type || 'purchase').toLowerCase() === 'other' ? 'other' : 'purchase',
  return_date: String(raw?.return_date || ''),
  rr_id: String(raw?.rr_refno || ''),
  rr_no: String(raw?.rr_no || ''),
  supplier_id: String(raw?.supplier_refno || raw?.supplier_id || ''),
  supplier_name: String(raw?.supplier_name || ''),
  po_no: String(raw?.po_no || ''),
  status: mapStatus(raw?.status),
  grand_total: toNumber(raw?.grand_total, 0),
  remarks: String(raw?.remarks || ''),
  created_by: String(raw?.created_by_id || raw?.created_by || ''),
  created_at: String(raw?.created_at || ''),
});

const mapSupplierReturnItem = (raw: any): SupplierReturnItem => ({
  id: String(raw?.id || ''),
  return_id: String(raw?.return_refno || ''),
  rr_item_id: String(raw?.rr_item_id || ''),
  item_id: String(raw?.item_id || ''),
  item_code: String(raw?.item_code || ''),
  part_no: String(raw?.part_no || ''),
  description: String(raw?.description || ''),
  qty_returned: toNumber(raw?.qty_returned, 0),
  unit_cost: toNumber(raw?.unit_cost, 0),
  total_amount: toNumber(raw?.total_amount, 0),
  return_reason: String(raw?.return_reason || raw?.remarks || ''),
  remarks: String(raw?.remarks || ''),
  created_at: '',
});

export const returnToSupplierService = {
  getAllReturns: async (): Promise<SupplierReturn[]> => {
    const query = new URLSearchParams({
      main_id: String(API_MAIN_ID),
      status: 'all',
      page: '1',
      per_page: '200',
    });

    const data = await requestApi(`${API_BASE_URL}/return-to-suppliers?${query.toString()}`);
    const rows = Array.isArray(data?.items) ? data.items : [];
    return rows.map(mapSupplierReturn);
  },

  getReturnById: async (id: string): Promise<SupplierReturn | null> => {
    try {
      const data = await requestApi(
        `${API_BASE_URL}/return-to-suppliers/${encodeURIComponent(id)}?main_id=${encodeURIComponent(String(API_MAIN_ID))}`
      );
      return mapSupplierReturn(data?.record || data || {});
    } catch {
      return null;
    }
  },

  getReturnItems: async (returnId: string): Promise<SupplierReturnItem[]> => {
    const data = await requestApi(
      `${API_BASE_URL}/return-to-suppliers/${encodeURIComponent(returnId)}/items?main_id=${encodeURIComponent(String(API_MAIN_ID))}`
    );
    const rows = Array.isArray(data) ? data : [];
    return rows.map(mapSupplierReturnItem);
  },

  createReturn: async (returnData: CreateReturnDTO): Promise<SupplierReturn> => {
    const userContext = getUserContext();

    const payloadItems = (returnData.items || []).map((item) => ({
      inv_refno: item.rr_item_id || item.item_id,
      item_refno: item.rr_item_id,
      item_code: item.item_code,
      part_no: item.part_no,
      description: item.description,
      qty_returned: item.qty_returned,
      unit_cost: item.unit_cost,
      remarks: item.remarks || item.return_reason,
      return_reason: item.return_reason,
    }));

    const payload = {
      main_id: userContext.mainId,
      user_id: userContext.userId,
      return_date: returnData.return_date,
      return_type: returnData.return_type,
      rr_refno: returnData.rr_id,
      rr_no: returnData.rr_no,
      supplier_refno: returnData.supplier_id,
      po_no: returnData.po_no || '',
      remarks: returnData.remarks || '',
      items: payloadItems,
    };

    const created = await requestApi(`${API_BASE_URL}/return-to-suppliers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return mapSupplierReturn({ ...(created?.record || {}), grand_total: created?.summary?.grand_total || 0 });
  },

  finalizeReturn: async (returnId: string): Promise<void> => {
    await requestApi(`${API_BASE_URL}/return-to-suppliers/${encodeURIComponent(returnId)}/actions/post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ main_id: API_MAIN_ID }),
    });
  },

  deleteReturn: async (id: string): Promise<void> => {
    await requestApi(`${API_BASE_URL}/return-to-suppliers/${encodeURIComponent(id)}?main_id=${encodeURIComponent(String(API_MAIN_ID))}`, {
      method: 'DELETE',
    });
  },

  getRRItemsForReturn: async (rrId: string): Promise<RRItemForReturn[]> => {
    const data = await requestApi(
      `${API_BASE_URL}/return-to-suppliers/rr/${encodeURIComponent(rrId)}/items?main_id=${encodeURIComponent(String(API_MAIN_ID))}`
    );

    const rows = Array.isArray(data) ? data : [];
    return rows.map((item: any) => ({
      id: String(item?.item_refno || item?.item_id || item?.id || ''),
      item_id: String(item?.item_refno || item?.item_id || ''),
      item_code: String(item?.item_code || ''),
      part_number: String(item?.part_no || ''),
      description: String(item?.description || ''),
      quantity_received: toNumber(item?.quantity_received, 0),
      unit_cost: toNumber(item?.unit_cost, 0),
      qty_returned_already: toNumber(item?.qty_returned_already, 0),
    }));
  },

  searchRRs: async (query: string): Promise<any[]> => {
    const params = new URLSearchParams({
      main_id: String(API_MAIN_ID),
      search: query,
      limit: '10',
    });

    const rows = await requestApi(`${API_BASE_URL}/return-to-suppliers/rr/search?${params.toString()}`);
    const list = Array.isArray(rows) ? rows : [];
    return list.map((row: any) => ({
      id: String(row?.refno || row?.id || ''),
      rr_no: String(row?.rr_no || ''),
      rr_number: String(row?.rr_no || ''),
      supplier_id: String(row?.supplier_refno || row?.supplier_id || ''),
      supplier_name: String(row?.supplier_name || ''),
      po_no: String(row?.po_no || ''),
      po_number: String(row?.po_no || ''),
      receive_date: String(row?.receive_date || ''),
      created_at: String(row?.receive_date || ''),
    }));
  },
};
