import { getLocalAuthSession } from './localAuthService';
import { purchaseRequestService } from './purchaseRequestService';
import type { PurchaseRequestWithItems } from '../purchaseRequest.types';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

export type SuggestedStockSortOption =
  | 'qty-desc'
  | 'description-asc'
  | 'description-desc'
  | 'inquiries-desc'
  | 'inquiries-asc';

export const SUGGESTED_STOCK_DEFAULT_SORT: SuggestedStockSortOption = 'qty-desc';

export interface SuggestedStockFilters {
  dateFrom: string;
  dateTo: string;
  customerId?: string;
  partNo?: string;
  sortBy?: SuggestedStockSortOption;
  kivFolder?: boolean;
}

export interface SuggestedStockItem {
  id: string;
  partNo: string;
  itemCode: string;
  description: string;
  brand: string;
  databaseItemId: string;
  databaseItemCode: string;
  databasePartNo: string;
  isListed: boolean;
  inquiryCount: number;
  totalQty: number;
  customerCount: number;
  customers: { id: string; name: string }[];
  remark: string;
  lastInquiryDate: string;
  isKiv: boolean;
  productCreated: boolean;
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
  if (filters.partNo && filters.partNo.trim() !== '') {
    query.set('part_no', filters.partNo.trim());
  }
  if (filters.sortBy && filters.sortBy.trim() !== '') {
    query.set('sort_by', filters.sortBy.trim());
  }
  if (filters.kivFolder) {
    query.set('kiv', '1');
  }

  return query;
};

const fetchAllReportPages = async (
  endpoint: 'summary' | 'details',
  filters: SuggestedStockFilters,
  perPage: number
): Promise<any[]> => {
  const rows: any[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const query = buildFilters(filters, {
      page: String(page),
      per_page: String(perPage),
    });
    const data = await requestApi(
      `${API_BASE_URL}/suggested-stock-report/${endpoint}?${query.toString()}`
    );
    if (Array.isArray(data?.items)) rows.push(...data.items);
    totalPages = Math.max(1, toNumber(data?.meta?.total_pages, 1));
    page += 1;
  } while (page <= totalPages);

  return rows;
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
      .sort((a, b) => a.company.localeCompare(b.company))
      .filter((row: CustomerWithInquiries) => row.id !== '' && row.company !== '');
  } catch (err) {
    console.error('Error fetching customers with not listed inquiries:', err);
    return [];
  }
};

const mapSummaryRows = (rows: any[]): SuggestedStockItem[] =>
  rows.map((item: any) => {
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
      brand: String(item?.brand || ''),
      databaseItemId: String(item?.database_item_id || ''),
      databaseItemCode: String(item?.database_item_code || ''),
      databasePartNo: String(item?.database_part_no || ''),
      isListed: String(item?.database_item_code || '') !== '' || String(item?.database_part_no || '') !== '',
      inquiryCount: toNumber(item?.inquiry_count),
      totalQty: toNumber(item?.total_qty),
      customerCount: toNumber(item?.customer_count),
      customers,
      remark: String(item?.report_remark || ''),
      lastInquiryDate: String(item?.last_inquiry_date || ''),
      isKiv: String(item?.is_kiv || '') === '1' || Boolean(item?.is_kiv),
      productCreated: String(item?.product_created || '') === '1' || Boolean(item?.product_created),
    };
  });

export const fetchSuggestedStockSummaryPage = async (
  filters: SuggestedStockFilters,
  page = 1,
  perPage = 50
): Promise<{ items: SuggestedStockItem[]; hasMore: boolean }> => {
  const query = buildFilters(filters, {
    page: String(page),
    per_page: String(perPage),
  });
  const data = await requestApi(`${API_BASE_URL}/suggested-stock-report/summary?${query.toString()}`);
  const items = mapSummaryRows(Array.isArray(data?.items) ? data.items : []);
  const hasMore = Boolean(data?.meta?.has_more);
  return { items, hasMore };
};

export const fetchSuggestedStockSummary = async (
  filters: SuggestedStockFilters
): Promise<SuggestedStockItem[]> => {
  try {
    const rows: SuggestedStockItem[] = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const result = await fetchSuggestedStockSummaryPage(filters, page, 200);
      rows.push(...result.items);
      hasMore = result.hasMore;
      page += 1;
    }
    return rows;
  } catch (err) {
    console.error('Error fetching suggested stock summary:', err);
    return [];
  }
};

export const fetchSuggestedStockDetails = async (
  filters: SuggestedStockFilters
): Promise<SuggestedStockDetail[]> => {
  try {
    const rows = await fetchAllReportPages('details', filters, 300);

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

export const clearNotListedRemarks = async (input: {
  inquiryItemId?: string | number;
  partNo?: string;
  itemCode?: string;
}): Promise<number> => {
  const inquiryItemId = Number(input.inquiryItemId || 0);
  const partNo = String(input.partNo || '').trim();
  const itemCode = String(input.itemCode || '').trim();
  if (inquiryItemId <= 0 && partNo === '' && itemCode === '') {
    throw new Error('inquiry item id, part number, or item code is required');
  }

  const data = await requestApi(`${API_BASE_URL}/suggested-stock-report/clear-not-listed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      main_id: getMainId(),
      inquiry_item_id: inquiryItemId > 0 ? inquiryItemId : undefined,
      part_no: partNo || undefined,
      item_code: itemCode || undefined,
    }),
  });

  return toNumber(data?.cleared);
};

type SuggestedStockKivItem = Pick<SuggestedStockItem, 'partNo' | 'itemCode' | 'description'>;

const toKivPayload = (items: SuggestedStockKivItem[]) =>
  items
    .map((item) => ({
      part_no: String(item.partNo || '').trim(),
      item_code: String(item.itemCode || '').trim(),
      description: String(item.description || '').trim(),
    }))
    .filter((item) => item.part_no !== '' || item.item_code !== '' || item.description !== '');

export const addSuggestedStockItemsToKiv = async (
  items: SuggestedStockKivItem[]
): Promise<number> => {
  const payload = toKivPayload(items);
  if (payload.length === 0) {
    throw new Error('Select at least one item to move to the KIV folder');
  }

  const data = await requestApi(`${API_BASE_URL}/suggested-stock-report/kiv`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      main_id: getMainId(),
      user_id: getUserId() || undefined,
      items: payload,
    }),
  });

  return toNumber(data?.added, payload.length);
};

export const removeSuggestedStockItemsFromKiv = async (
  items: SuggestedStockKivItem[]
): Promise<number> => {
  const payload = toKivPayload(items);
  if (payload.length === 0) {
    throw new Error('Select at least one item to restore from the KIV folder');
  }

  const data = await requestApi(`${API_BASE_URL}/suggested-stock-report/kiv/remove`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      main_id: getMainId(),
      items: payload,
    }),
  });

  return toNumber(data?.removed, payload.length);
};

export const createPurchaseRequestFromSuggestions = async (
  items: SuggestedStockItem[],
  quantities: Record<string, number> = {}
): Promise<PurchaseRequestWithItems> => {
  if (items.length === 0) throw new Error('Select at least one suggested item');
  if (items.some((item) => !item.productCreated || !item.databaseItemId)) {
    throw new Error('Each selected item must have a matching Product Created record before it can be added to a PR. Refresh the report after creating the product.');
  }

  const sourceIds = items.map((item) => item.id).filter(Boolean);
  return purchaseRequestService.createPurchaseRequest({
    pr_number: '',
    request_date: new Date().toISOString().slice(0, 10),
    notes: `Created from Item Suggested for Stock (${sourceIds.length} suggestion${sourceIds.length === 1 ? '' : 's'})`,
    reference_no: `Suggested Stock:${sourceIds.join(',')}`,
    items: items.map((item) => ({
      // The API provides the exact inventory session for Product Created rows.
      // Persist it on tblpr_item to retain the product/history relationship.
      item_id: item.databaseItemId || undefined,
      item_code: item.databaseItemCode || item.itemCode || undefined,
      part_number: item.databasePartNo || item.partNo || undefined,
      description: item.description || undefined,
      quantity: Math.max(1, Number(quantities[item.id] ?? item.totalQty) || 1),
      unit_cost: 0,
    })),
  });
};

export const markSuggestedStockItemsAddedToPr = async (
  items: SuggestedStockItem[]
): Promise<number> => {
  const payload = items.map((item) => ({
    part_no: item.partNo,
    item_code: item.itemCode,
    description: item.description,
  }));
  const data = await requestApi(`${API_BASE_URL}/suggested-stock-report/added-to-pr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ main_id: getMainId(), items: payload }),
  });
  return toNumber(data?.removed);
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
