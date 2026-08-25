import { getLocalAuthSession } from './localAuthService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

export const REORDER_WAREHOUSE_OPTIONS = [
  { id: 'total', label: 'Centralized Quantity' },
] as const;

export type ReorderWarehouseType = (typeof REORDER_WAREHOUSE_OPTIONS)[number]['id'];

export interface ReorderReportFilters {
  warehouseType: ReorderWarehouseType;
  search?: string;
  hideZeroReorder?: boolean;
  hideZeroReplenish?: boolean;
  showHidden?: boolean;
  page?: number;
  perPage?: number;
}

export interface ReorderReportEntry {
  id: string;
  product_session: string;
  item_code: string;
  part_no: string;
  description: string;
  is_hidden: boolean;
  reorder_qty: number;
  replenish_qty: number;
  current_stock: number;
  physical_stock: number;
  reserved_stock: number;
  available_stock: number;
  total_rr: number;
  total_return: number;
  target_quantity: number;
  suggested_reorder_qty: number;
  open_pr_qty: number;
  po_ordered_qty: number;
  open_po_qty: number;
  received_qty: number;
  accepted_qty: number;
  remaining_qty: number;
  preferred_supplier_id: string;
  preferred_supplier_name: string;
  preferred_supplier_cost: number;
  overall_status: string;
  can_create_pr: boolean;
  pr_documents: ReorderPrDocument[];
  po_documents: ReorderPoDocument[];
  rr_documents: ReorderRrDocument[];
  pr_refno: string;
  pr_no: string;
  pr_status: string;
  po_refno: string;
  po_no: string;
  po_status: string;
  rr_refno: string;
  rr_no: string;
  rr_status: string;
  last_arrival_date: string;
  last_arrival_qty: number;
}

export interface ReorderPrDocument {
  refno: string;
  number: string;
  requested_qty: number;
  request_date: string;
  status: string;
  supplier_id: string;
  supplier_name: string;
  po_refno: string;
}

export interface ReorderPoDocument {
  refno: string;
  number: string;
  status: string;
  supplier_id: string;
  supplier_name: string;
  ordered_qty: number;
  accepted_qty: number;
  outstanding_qty: number;
  unit_cost: number;
  order_date: string;
  expected_delivery_date: string;
  pr_refno: string;
  pr_number: string;
}

export interface ReorderRrDocument {
  refno: string;
  number: string;
  status: string;
  po_refno: string;
  po_number: string;
  received_qty: number;
  accepted_qty: number;
  receiving_date: string;
  received_by: string;
}

const parseApiErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = await response.json();
    if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error.trim();
    if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message.trim();
  } catch {
    // ignore parsing issues
  }
  return `API request failed (${response.status})`;
};

const requestApi = async (url: string, init?: RequestInit, retries = 1): Promise<any> => {
  const response = await fetch(url, init);
  const method = String(init?.method || 'GET').toUpperCase();
  if (method === 'GET' && retries > 0 && [500, 502, 503, 504].includes(response.status)) {
    await new Promise((resolve) => window.setTimeout(resolve, 300));
    return requestApi(url, init, retries - 1);
  }
  if (!response.ok) {
    throw new Error(await parseApiErrorMessage(response));
  }
  const payload = await response.json();
  if (!payload?.ok) throw new Error(payload?.error || 'API request failed');
  return payload.data;
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toString = (value: unknown): string => String(value ?? '');

const toBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

const normalizePrDocument = (raw: any): ReorderPrDocument => ({
  refno: toString(raw?.refno),
  number: toString(raw?.number),
  requested_qty: toNumber(raw?.requested_qty),
  request_date: toString(raw?.request_date),
  status: toString(raw?.status),
  supplier_id: toString(raw?.supplier_id),
  supplier_name: toString(raw?.supplier_name),
  po_refno: toString(raw?.po_refno),
});

const normalizePoDocument = (raw: any): ReorderPoDocument => ({
  refno: toString(raw?.refno),
  number: toString(raw?.number),
  status: toString(raw?.status),
  supplier_id: toString(raw?.supplier_id),
  supplier_name: toString(raw?.supplier_name),
  ordered_qty: toNumber(raw?.ordered_qty),
  accepted_qty: toNumber(raw?.accepted_qty),
  outstanding_qty: toNumber(raw?.outstanding_qty),
  unit_cost: toNumber(raw?.unit_cost),
  order_date: toString(raw?.order_date),
  expected_delivery_date: toString(raw?.expected_delivery_date),
  pr_refno: toString(raw?.pr_refno),
  pr_number: toString(raw?.pr_number),
});

const normalizeRrDocument = (raw: any): ReorderRrDocument => ({
  refno: toString(raw?.refno),
  number: toString(raw?.number),
  status: toString(raw?.status),
  po_refno: toString(raw?.po_refno),
  po_number: toString(raw?.po_number),
  received_qty: toNumber(raw?.received_qty),
  accepted_qty: toNumber(raw?.accepted_qty),
  receiving_date: toString(raw?.receiving_date),
  received_by: toString(raw?.received_by),
});

const normalizeEntry = (raw: any): ReorderReportEntry => ({
  id: toString(raw?.id),
  product_session: toString(raw?.product_session),
  item_code: toString(raw?.item_code),
  part_no: toString(raw?.part_no),
  description: toString(raw?.description),
  is_hidden: toBoolean(raw?.is_hidden),
  reorder_qty: toNumber(raw?.reorder_qty),
  replenish_qty: toNumber(raw?.replenish_qty),
  current_stock: toNumber(raw?.current_stock),
  physical_stock: toNumber(raw?.physical_stock ?? raw?.current_stock),
  reserved_stock: toNumber(raw?.reserved_stock),
  available_stock: toNumber(raw?.available_stock ?? raw?.current_stock),
  total_rr: toNumber(raw?.total_rr),
  total_return: toNumber(raw?.total_return),
  target_quantity: toNumber(raw?.target_quantity),
  suggested_reorder_qty: toNumber(raw?.suggested_reorder_qty),
  open_pr_qty: toNumber(raw?.open_pr_qty),
  po_ordered_qty: toNumber(raw?.po_ordered_qty),
  open_po_qty: toNumber(raw?.open_po_qty),
  received_qty: toNumber(raw?.received_qty),
  accepted_qty: toNumber(raw?.accepted_qty),
  remaining_qty: toNumber(raw?.remaining_qty),
  preferred_supplier_id: toString(raw?.preferred_supplier_id),
  preferred_supplier_name: toString(raw?.preferred_supplier_name),
  preferred_supplier_cost: toNumber(raw?.preferred_supplier_cost),
  overall_status: toString(raw?.overall_status || 'Needs PR'),
  can_create_pr: raw?.can_create_pr === undefined ? true : toBoolean(raw?.can_create_pr),
  pr_documents: Array.isArray(raw?.pr_documents) ? raw.pr_documents.map(normalizePrDocument) : [],
  po_documents: Array.isArray(raw?.po_documents) ? raw.po_documents.map(normalizePoDocument) : [],
  rr_documents: Array.isArray(raw?.rr_documents) ? raw.rr_documents.map(normalizeRrDocument) : [],
  pr_refno: toString(raw?.pr_refno),
  pr_no: toString(raw?.pr_no),
  pr_status: toString(raw?.pr_status),
  po_refno: toString(raw?.po_refno),
  po_no: toString(raw?.po_no),
  po_status: toString(raw?.po_status),
  rr_refno: toString(raw?.rr_refno),
  rr_no: toString(raw?.rr_no),
  rr_status: toString(raw?.rr_status),
  last_arrival_date: toString(raw?.last_arrival_date),
  last_arrival_qty: toNumber(raw?.last_arrival_qty),
});

const CLOSED_WORKFLOW_STATUSES = new Set([
  'cancelled', 'canceled', 'rejected', 'disapproved', 'completed', 'closed',
]);
const COMPLETED_RECEIVING_STATUSES = new Set(['posted', 'received', 'delivered', 'completed']);

export const isReorderWorkflowActive = (row: ReorderReportEntry): boolean => {
  const overallStatus = String(row.overall_status || '').trim().toLowerCase();
  if (typeof row.can_create_pr === 'boolean' && overallStatus) {
    return !row.can_create_pr
      || ['pr pending', 'awaiting po', 'ordered', 'partially received', 'overdue'].includes(overallStatus);
  }

  // Legacy fallback for callers that do not yet provide the server-computed
  // overall status. Old completed document references must not override an
  // explicit `Needs PR` / `can_create_pr` decision from the report API.
  if (row.rr_refno) {
    const status = row.rr_status.trim().toLowerCase();
    return status === '' || !COMPLETED_RECEIVING_STATUSES.has(status) && !CLOSED_WORKFLOW_STATUSES.has(status);
  }
  if (row.po_refno) {
    const status = row.po_status.trim().toLowerCase();
    return status === '' || !CLOSED_WORKFLOW_STATUSES.has(status);
  }
  if (row.pr_refno) {
    const status = row.pr_status.trim().toLowerCase();
    return status === '' || !CLOSED_WORKFLOW_STATUSES.has(status);
  }
  return false;
};

export const getReorderWorkflowStages = (row: ReorderReportEntry) => ({
  pr: row.pr_documents.at(-1)?.status || (row.pr_refno ? (row.pr_status || 'Active') : 'Not started'),
  po: row.po_documents.at(-1)?.status || (row.po_refno ? (row.po_status || 'Active') : 'Not started'),
  receiving: row.rr_documents.at(-1)?.status || (row.rr_refno ? (row.rr_status || 'Active') : 'Not started'),
});

const getUserContext = () => {
  const session = getLocalAuthSession();
  const userId = Number(session?.context?.user?.id || 0);
  const mainId = Number(
    session?.context?.main_userid
      || session?.context?.user?.main_userid
      || session?.userProfile?.main_userid
      || API_MAIN_ID
  );
  return {
    mainId: Number.isFinite(mainId) && mainId > 0 ? mainId : API_MAIN_ID,
    userId: Number.isFinite(userId) && userId > 0 ? userId : 0,
  };
};

const dedupeEntries = (rows: ReorderReportEntry[]): ReorderReportEntry[] => {
  const unique = new Map<string, ReorderReportEntry>();
  rows.forEach((row) => {
    const productKey = row.product_session.trim()
      || `${row.item_code.trim().toLowerCase()}::${row.part_no.trim().toLowerCase()}`;
    if (!unique.has(productKey)) unique.set(productKey, row);
  });
  return Array.from(unique.values());
};

export const fetchReorderReportEntries = async (filters: ReorderReportFilters): Promise<{
  items: ReorderReportEntry[];
  meta: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}> => {
  const ctx = getUserContext();
  const query = new URLSearchParams({
    main_id: String(ctx.mainId),
    warehouse_type: filters.warehouseType,
    page: String(Math.max(1, filters.page || 1)),
    per_page: String(Math.max(1, Math.min(500, filters.perPage || 100))),
  });

  if (filters.search?.trim()) query.set('search', filters.search.trim());
  if (filters.hideZeroReorder) query.set('hide_zero_reorder', '1');
  if (filters.hideZeroReplenish) query.set('hide_zero_replenish', '1');
  if (filters.showHidden) query.set('include_hidden', '1');

  const data = await requestApi(`${API_BASE_URL}/reorder-report?${query.toString()}`);
  const rows = Array.isArray(data?.items) ? data.items : [];
  const meta = data?.meta || {};

  return {
    items: dedupeEntries(rows.map(normalizeEntry)),
    meta: {
      page: toNumber(meta?.page) || 1,
      per_page: toNumber(meta?.per_page) || 100,
      total: toNumber(meta?.total) || 0,
      total_pages: toNumber(meta?.total_pages) || 1,
    },
  };
};

export const fetchReorderDescriptionOptions = async (): Promise<string[]> => {
  const ctx = getUserContext();
  const query = new URLSearchParams({ main_id: String(ctx.mainId) });
  const data = await requestApi(`${API_BASE_URL}/inventory-report/options?${query.toString()}`);
  const descriptions = Array.isArray(data?.descriptions) ? data.descriptions : [];
  const unique = new Map<string, string>();

  descriptions.forEach((value: unknown) => {
    const description = String(value ?? '').trim();
    const key = description.toLocaleLowerCase();
    if (description && !unique.has(key)) unique.set(key, description);
  });

  return Array.from(unique.values()).sort((left, right) => left.localeCompare(right));
};

export const hideReorderReportItems = async (itemIds: string[]): Promise<number> => {
  const normalizedIds = itemIds
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0)
    .map((id) => id.toString());

  if (normalizedIds.length === 0) return 0;

  const ctx = getUserContext();
  const data = await requestApi(`${API_BASE_URL}/reorder-report/hide-items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      main_id: ctx.mainId,
      user_id: ctx.userId,
      item_ids: normalizedIds,
    }),
  });

  return toNumber(data?.hidden);
};

export const restoreReorderReportItems = async (itemIds: string[]): Promise<number> => {
  const normalizedIds = itemIds
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0)
    .map((id) => id.toString());

  if (normalizedIds.length === 0) return 0;

  const ctx = getUserContext();
  const data = await requestApi(`${API_BASE_URL}/reorder-report/restore-items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      main_id: ctx.mainId,
      user_id: ctx.userId,
      item_ids: normalizedIds,
    }),
  });

  return toNumber(data?.restored);
};
