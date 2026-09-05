import { getLocalAuthSession } from './localAuthService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

const resolveMainId = (): number => {
  const session = getLocalAuthSession();
  const dynamicMainId = Number(
    session?.context?.main_userid
      || session?.context?.user?.main_userid
      || session?.userProfile?.main_userid
      || 0
  );
  return Number.isFinite(dynamicMainId) && dynamicMainId > 0 ? dynamicMainId : API_MAIN_ID || 1;
};

export type IncidentMatchSource = 'all' | 'manual' | 'related_transaction' | 'description_match' | 'imported';

export interface IncidentItemsReportFilters {
  search?: string;
  supplier?: string;
  matchSource?: IncidentMatchSource;
  dateFrom?: string;
  dateTo?: string;
  minCount?: number;
  page?: number;
  perPage?: number;
}

export interface IncidentItemsReportRow {
  supplier_id: string;
  supplier_name: string;
  product_id: string;
  item_code: string;
  part_no: string;
  description: string;
  incident_count: number;
  affected_customer_count: number;
  latest_incident_date: string;
  average_confidence: number;
  match_sources: string;
  recent_incidents: Array<{
    incident_report_id: string;
    ir_number?: string;
    date: string;
    contact_id: string;
    customer_name: string;
    summary: string;
  }>;
}

export interface IncidentItemsReportSummary {
  total_incident_items: number;
  affected_suppliers: number;
  affected_items: number;
  top_supplier_name: string;
  top_item_description: string;
  top_incident_count: number;
}

export interface IncidentItemsReportMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
  search: string;
  supplier: string;
  match_source: IncidentMatchSource;
  min_count: number;
}

export interface IncidentItemsReportData {
  items: IncidentItemsReportRow[];
  summary: IncidentItemsReportSummary;
  meta: IncidentItemsReportMeta;
}

export interface IncidentItemIncidentSummary {
  incident_report_id: string;
  ir_number?: string;
  date: string;
  contact_id: string;
  customer_name: string;
  summary: string;
}

export interface IncidentItemIncidentsFilters {
  supplierId?: string;
  supplierName?: string;
  productId?: string;
  itemCode?: string;
  partNo?: string;
  description?: string;
  dateFrom?: string;
  dateTo?: string;
  matchSource?: IncidentMatchSource;
  search?: string;
  supplier?: string;
}

export interface WarehouseIncidentReport {
  id: string;
  ir_number?: string;
  record_source?: 'incident_report' | 'customer_log';
  contact_id: string;
  customer_name?: string;
  report_date: string;
  report_time: string;
  incident_date: string;
  incident_time: string;
  issue_type: 'product_quality' | 'service_quality' | 'delivery' | 'lbc_rto' | 'other';
  description: string;
  reported_by: string;
  done_by: string;
  attachments?: string[];
  related_transactions?: Array<{
    transaction_type: string;
    transaction_id: string;
    transaction_number: string;
    transaction_date: string;
  }>;
  approval_status: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  approval_date?: string;
  decision_note?: string;
  notes?: string;
  product_id?: string;
  item_code?: string;
  part_no?: string;
  item_description?: string;
  affected_quantity?: number | null;
  supplier_id?: string;
  supplier_name?: string;
  customer_incident_count?: number;
  item_incident_count?: number;
  return_action?: {
    id: string;
    disposition: string;
    status: string;
    authorized_by_name?: string;
    authorized_at?: string;
  } | null;
}

export const formatIncidentReportNumber = (
  irNumber?: string | null,
  options?: { recordSource?: string; incidentReportId?: string }
): string => {
  const number = String(irNumber || '').trim();
  if (number) return number;
  if (options?.recordSource === 'customer_log') {
    return String(options.incidentReportId || '').trim().slice(0, 8);
  }
  return '';
};

const parseApiErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = await response.json();
    if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error.trim();
    if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message.trim();
  } catch {
    // no-op
  }
  return `Request failed (${response.status})`;
};

const requestApi = async (url: string): Promise<any> => {
  const session = getLocalAuthSession();
  if (!session?.token) {
    throw new Error('Your session has expired. Please sign in again before viewing the incident report.');
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  if (!response.ok) {
    throw new Error(await parseApiErrorMessage(response));
  }
  const payload = await response.json();
  if (!payload?.ok) {
    throw new Error(payload?.error || 'API request failed');
  }
  return payload.data || {};
};

const toNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const mapRow = (row: any): IncidentItemsReportRow => ({
  supplier_id: String(row?.supplier_id || ''),
  supplier_name: String(row?.supplier_name || ''),
  product_id: String(row?.product_id || ''),
  item_code: String(row?.item_code || ''),
  part_no: String(row?.part_no || ''),
  description: String(row?.description || ''),
  incident_count: toNumber(row?.incident_count, 0),
  affected_customer_count: toNumber(row?.affected_customer_count, 0),
  latest_incident_date: String(row?.latest_incident_date || ''),
  average_confidence: toNumber(row?.average_confidence, 0),
  match_sources: String(row?.match_sources || ''),
  recent_incidents: Array.isArray(row?.recent_incidents)
    ? row.recent_incidents.map((incident: any) => ({
        incident_report_id: String(incident?.incident_report_id || ''),
        ir_number: String(incident?.ir_number || ''),
        date: String(incident?.date || ''),
        contact_id: String(incident?.contact_id || ''),
        customer_name: String(incident?.customer_name || incident?.contact_id || 'Unknown customer'),
        summary: String(incident?.summary || ''),
      }))
    : [],
});

export const fetchIncidentItemsReport = async (
  filters: IncidentItemsReportFilters
): Promise<IncidentItemsReportData> => {
  const params = new URLSearchParams({
    main_id: String(resolveMainId()),
    page: String(Math.max(1, filters.page || 1)),
    per_page: String(Math.max(1, Math.min(300, filters.perPage || 100))),
    match_source: filters.matchSource || 'all',
    min_count: String(Math.max(1, filters.minCount || 1)),
  });

  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.supplier?.trim()) params.set('supplier', filters.supplier.trim());
  if (filters.dateFrom) params.set('date_from', filters.dateFrom);
  if (filters.dateTo) params.set('date_to', filters.dateTo);

  const data = await requestApi(`${API_BASE_URL}/incident-items-report?${params.toString()}`);
  const rows = Array.isArray(data?.items) ? data.items.map(mapRow) : [];
  const summary = data?.summary || {};
  const meta = data?.meta || {};

  return {
    items: rows,
    summary: {
      total_incident_items: toNumber(summary?.total_incident_items, 0),
      affected_suppliers: toNumber(summary?.affected_suppliers, 0),
      affected_items: toNumber(summary?.affected_items, 0),
      top_supplier_name: String(summary?.top_supplier_name || ''),
      top_item_description: String(summary?.top_item_description || ''),
      top_incident_count: toNumber(summary?.top_incident_count, 0),
    },
    meta: {
      page: toNumber(meta?.page, filters.page || 1),
      per_page: toNumber(meta?.per_page, filters.perPage || 100),
      total: toNumber(meta?.total, rows.length),
      total_pages: toNumber(meta?.total_pages, 1),
      search: String(meta?.search || ''),
      supplier: String(meta?.supplier || ''),
      match_source: String(meta?.match_source || filters.matchSource || 'all') as IncidentMatchSource,
      min_count: toNumber(meta?.min_count, filters.minCount || 1),
    },
  };
};

const mapIncidentSummary = (incident: Record<string, unknown> | null | undefined): IncidentItemIncidentSummary => ({
  incident_report_id: String(incident?.incident_report_id || ''),
  ir_number: String(incident?.ir_number || ''),
  date: String(incident?.date || ''),
  contact_id: String(incident?.contact_id || ''),
  customer_name: String(incident?.customer_name || incident?.contact_id || 'Unknown customer'),
  summary: String(incident?.summary || ''),
});

export const fetchIncidentItemIncidents = async (
  filters: IncidentItemIncidentsFilters
): Promise<IncidentItemIncidentSummary[]> => {
  const params = new URLSearchParams({
    main_id: String(resolveMainId()),
    match_source: filters.matchSource || 'all',
  });

  if (filters.supplierId?.trim()) params.set('supplier_id', filters.supplierId.trim());
  if (filters.supplierName?.trim()) params.set('supplier_name', filters.supplierName.trim());
  if (filters.productId?.trim()) params.set('product_id', filters.productId.trim());
  if (filters.itemCode?.trim()) params.set('item_code', filters.itemCode.trim());
  if (filters.partNo?.trim()) params.set('part_no', filters.partNo.trim());
  if (filters.description?.trim()) params.set('description', filters.description.trim());
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.supplier?.trim()) params.set('supplier', filters.supplier.trim());
  if (filters.dateFrom) params.set('date_from', filters.dateFrom);
  if (filters.dateTo) params.set('date_to', filters.dateTo);

  const data = await requestApi(`${API_BASE_URL}/incident-items-report/incidents?${params.toString()}`);
  return Array.isArray(data?.incidents)
    ? data.incidents.map((incident: Record<string, unknown>) => mapIncidentSummary(incident))
    : [];
};

export const fetchWarehouseIncidentReport = async (
  reportId: string
): Promise<WarehouseIncidentReport> => {
  const id = String(reportId || '').trim();
  if (!id) {
    throw new Error('Incident Report ID is required.');
  }

  const params = new URLSearchParams({ main_id: String(resolveMainId()) });
  const data = await requestApi(
    `${API_BASE_URL}/incident-items-report/incidents/${encodeURIComponent(id)}?${params.toString()}`
  );

  return {
    id: String(data?.id || id),
    ir_number: data?.ir_number ? String(data.ir_number) : undefined,
    record_source: data?.record_source === 'customer_log' ? 'customer_log' : 'incident_report',
    contact_id: String(data?.contact_id || ''),
    customer_name: String(data?.customer_name || ''),
    report_date: String(data?.report_date || ''),
    report_time: String(data?.report_time || ''),
    incident_date: String(data?.incident_date || ''),
    incident_time: String(data?.incident_time || ''),
    issue_type: (data?.issue_type || 'other') as WarehouseIncidentReport['issue_type'],
    description: String(data?.description || ''),
    reported_by: String(data?.reported_by || ''),
    done_by: String(data?.done_by || ''),
    attachments: Array.isArray(data?.attachments) ? data.attachments.map(String) : [],
    related_transactions: Array.isArray(data?.related_transactions) ? data.related_transactions : [],
    approval_status: (data?.approval_status || 'pending') as WarehouseIncidentReport['approval_status'],
    approved_by: data?.approved_by ? String(data.approved_by) : undefined,
    approval_date: data?.approval_date ? String(data.approval_date) : undefined,
    decision_note: data?.decision_note ? String(data.decision_note) : undefined,
    notes: data?.notes ? String(data.notes) : undefined,
    product_id: data?.product_id ? String(data.product_id) : undefined,
    item_code: data?.item_code ? String(data.item_code) : undefined,
    part_no: data?.part_no ? String(data.part_no) : undefined,
    item_description: data?.item_description ? String(data.item_description) : undefined,
    affected_quantity: data?.affected_quantity == null || data?.affected_quantity === ''
      ? null
      : toNumber(data.affected_quantity),
    supplier_id: data?.supplier_id ? String(data.supplier_id) : undefined,
    supplier_name: data?.supplier_name ? String(data.supplier_name) : undefined,
    customer_incident_count: toNumber(data?.customer_incident_count, 0),
    item_incident_count: toNumber(data?.item_incident_count, 0),
    return_action: data?.return_action
      ? {
          id: String(data.return_action.id || ''),
          disposition: String(data.return_action.disposition || ''),
          status: String(data.return_action.status || ''),
          authorized_by_name: data.return_action.authorized_by_name
            ? String(data.return_action.authorized_by_name)
            : undefined,
          authorized_at: data.return_action.authorized_at
            ? String(data.return_action.authorized_at)
            : undefined,
        }
      : null,
  };
};
