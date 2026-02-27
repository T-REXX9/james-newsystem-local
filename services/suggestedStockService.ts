import { getLocalAuthSession } from './localAuthService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

export interface SuggestedStockFilters {
  dateFrom: string;
  dateTo: string;
  customerId?: string;
}

export interface SuggestedStockItem {
  id: string;
  partNo: string;
  itemCode: string;
  description: string;
  inquiryCount: number;
  totalQty: number;
  customerCount: number;
  customers: { id: string; name: string }[];
  remark: string;
  lastInquiryDate: string;
}

export interface SuggestedStockDetail {
  id: string;
  inquiryId: string;
  inquiryNo: string;
  inquiryDate: string;
  customerId: string;
  customerName: string;
  partNo: string;
  itemCode: string;
  description: string;
  qty: number;
  remark: string;
  salesPerson: string;
}

export interface CustomerWithInquiries {
  id: string;
  company: string;
  inquiryCount: number;
}

export interface SupplierOption {
  id: string;
  company: string;
}

export interface PurchaseOrderOption {
  id: string;
  poNo: string;
  supplierName: string;
  status: string;
}

const getMainId = (): number => {
  const session = getLocalAuthSession();
  const mainId = Number(session?.context?.user?.main_userid || API_MAIN_ID || 1);
  return Number.isFinite(mainId) && mainId > 0 ? mainId : 1;
};

const getUserId = (): number => {
  const session = getLocalAuthSession();
  const userId = Number(session?.context?.user?.id || 0);
  return Number.isFinite(userId) && userId > 0 ? userId : 0;
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

const requestApi = async (url: string, init?: RequestInit): Promise<any> => {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(await parseApiError(response));

  const payload = await response.json();
  if (!payload?.ok) {
    throw new Error(payload?.error || 'API request failed');
  }

  return payload.data;
};

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const buildFilters = (filters: SuggestedStockFilters, extra: Record<string, string> = {}) => {
  const query = new URLSearchParams({
    main_id: String(getMainId()),
    date_from: filters.dateFrom,
    date_to: filters.dateTo,
    ...extra,
  });

  if (filters.customerId && filters.customerId !== 'all') {
    query.set('customer_id', filters.customerId);
  }

  return query;
};

export const fetchCustomersWithNotListedInquiries = async (
  dateFrom: string,
  dateTo: string
): Promise<CustomerWithInquiries[]> => {
  try {
    const query = new URLSearchParams({
      main_id: String(getMainId()),
      date_from: dateFrom,
      date_to: dateTo,
    });

    const data = await requestApi(`${API_BASE_URL}/suggested-stock-report/customers?${query.toString()}`);
    const rows = Array.isArray(data?.items) ? data.items : [];

    return rows
      .map((row: any) => ({
        id: String(row?.id || ''),
        company: String(row?.company || ''),
        inquiryCount: toNumber(row?.inquiry_count),
      }))
      .filter((row: CustomerWithInquiries) => row.id !== '' && row.company !== '');
  } catch (err) {
    console.error('Error fetching customers with not listed inquiries:', err);
    return [];
  }
};

export const fetchSuggestedStockSummary = async (
  filters: SuggestedStockFilters
): Promise<SuggestedStockItem[]> => {
  try {
    const query = buildFilters(filters, { page: '1', per_page: '200' });
    const data = await requestApi(`${API_BASE_URL}/suggested-stock-report/summary?${query.toString()}`);
    const rows = Array.isArray(data?.items) ? data.items : [];

    return rows.map((item: any) => {
      const customerBlob = String(item?.customers || '');
      const customers = customerBlob
        .split('||')
        .map((entry: string) => {
          const [id, ...nameParts] = entry.split('::');
          return { id: (id || '').trim(), name: nameParts.join('::').trim() };
        })
        .filter((c) => c.id !== '' || c.name !== '');

      return {
        id: String(item?.id || ''),
        partNo: String(item?.part_no || ''),
        itemCode: String(item?.item_code || ''),
        description: String(item?.description || ''),
        inquiryCount: toNumber(item?.inquiry_count),
        totalQty: toNumber(item?.total_qty),
        customerCount: toNumber(item?.customer_count),
        customers,
        remark: String(item?.report_remark || ''),
        lastInquiryDate: String(item?.last_inquiry_date || ''),
      };
    });
  } catch (err) {
    console.error('Error fetching suggested stock summary:', err);
    return [];
  }
};

export const fetchSuggestedStockDetails = async (
  filters: SuggestedStockFilters
): Promise<SuggestedStockDetail[]> => {
  try {
    const query = buildFilters(filters, { page: '1', per_page: '400' });
    const data = await requestApi(`${API_BASE_URL}/suggested-stock-report/details?${query.toString()}`);
    const rows = Array.isArray(data?.items) ? data.items : [];

    return rows.map((item: any) => ({
      id: String(item?.id || ''),
      inquiryId: String(item?.inquiry_id || ''),
      inquiryNo: String(item?.inquiry_no || ''),
      inquiryDate: String(item?.inquiry_date || ''),
      customerId: String(item?.customer_id || ''),
      customerName: String(item?.customer_name || ''),
      partNo: String(item?.part_no || ''),
      itemCode: String(item?.item_code || ''),
      description: String(item?.description || ''),
      qty: toNumber(item?.qty),
      remark: String(item?.remark || ''),
      salesPerson: String(item?.sales_person || ''),
    }));
  } catch (err) {
    console.error('Error fetching suggested stock details:', err);
    return [];
  }
};

export const updateItemRemark = async (
  itemId: string,
  remark: string
): Promise<boolean> => {
  try {
    await requestApi(`${API_BASE_URL}/suggested-stock-report/remark`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        main_id: getMainId(),
        item_id: Number(itemId),
        remark,
      }),
    });

    return true;
  } catch (err) {
    console.error('Error updating item remark:', err);
    return false;
  }
};

export const fetchSuppliers = async (): Promise<SupplierOption[]> => {
  try {
    const query = new URLSearchParams({ main_id: String(getMainId()) });
    const data = await requestApi(`${API_BASE_URL}/suggested-stock-report/suppliers?${query.toString()}`);
    const rows = Array.isArray(data?.items) ? data.items : [];

    return rows
      .map((s: any) => ({
        id: String(s?.id || ''),
        company: String(s?.company || ''),
      }))
      .filter((s: SupplierOption) => s.id !== '' && s.company !== '');
  } catch (err) {
    console.error('Error fetching suppliers:', err);
    return [];
  }
};

export const fetchPurchaseOrders = async (): Promise<PurchaseOrderOption[]> => {
  try {
    const query = new URLSearchParams({ main_id: String(getMainId()) });
    const data = await requestApi(`${API_BASE_URL}/suggested-stock-report/purchase-orders?${query.toString()}`);
    const rows = Array.isArray(data?.items) ? data.items : [];

    return rows.map((po: any) => ({
      id: String(po?.id || ''),
      poNo: String(po?.po_no || ''),
      supplierName: String(po?.supplier_name || 'Unknown Supplier'),
      status: String(po?.status || 'Pending'),
    }));
  } catch (err) {
    console.error('Error fetching purchase orders:', err);
    return [];
  }
};

export const addItemToPurchaseOrder = async (
  poId: string,
  item: {
    partNo: string;
    itemCode: string;
    description: string;
    qty: number;
    unitPrice: number;
  }
): Promise<boolean> => {
  try {
    const userId = getUserId();
    if (userId <= 0) {
      throw new Error('Please log in again to continue.');
    }

    await requestApi(`${API_BASE_URL}/suggested-stock-report/purchase-orders/${encodeURIComponent(poId)}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        main_id: getMainId(),
        user_id: userId,
        part_no: item.partNo,
        item_code: item.itemCode,
        description: item.description,
        qty: item.qty,
        unit_price: item.unitPrice,
      }),
    });

    return true;
  } catch (err) {
    console.error('Error adding item to purchase order:', err);
    return false;
  }
};

export const createPurchaseOrderWithItem = async (
  supplierId: string,
  warehouseId: string,
  item: {
    partNo: string;
    itemCode: string;
    description: string;
    qty: number;
    unitPrice: number;
  },
  userId: string
): Promise<string | null> => {
  try {
    const fallbackUserId = Number(userId || 0);
    const sessionUserId = getUserId();
    const resolvedUserId = sessionUserId > 0 ? sessionUserId : fallbackUserId;

    if (!Number.isFinite(resolvedUserId) || resolvedUserId <= 0) {
      throw new Error('Please log in again to continue.');
    }

    const data = await requestApi(`${API_BASE_URL}/suggested-stock-report/purchase-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        main_id: getMainId(),
        user_id: resolvedUserId,
        supplier_id: supplierId,
        warehouse_id: warehouseId,
        part_no: item.partNo,
        item_code: item.itemCode,
        description: item.description,
        qty: item.qty,
        unit_price: item.unitPrice,
      }),
    });

    return String(data?.po_refno || '');
  } catch (err) {
    console.error('Error creating purchase order with item:', err);
    return null;
  }
};
