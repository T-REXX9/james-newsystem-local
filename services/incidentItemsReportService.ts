const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

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
  latest_incident_date: string;
  average_confidence: number;
  match_sources: string;
  recent_incidents: Array<{
    incident_report_id: string;
    date: string;
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
  const response = await fetch(url);
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
  latest_incident_date: String(row?.latest_incident_date || ''),
  average_confidence: toNumber(row?.average_confidence, 0),
  match_sources: String(row?.match_sources || ''),
  recent_incidents: Array.isArray(row?.recent_incidents)
    ? row.recent_incidents.map((incident: any) => ({
        incident_report_id: String(incident?.incident_report_id || ''),
        date: String(incident?.date || ''),
        summary: String(incident?.summary || ''),
      }))
    : [],
});

export const fetchIncidentItemsReport = async (
  filters: IncidentItemsReportFilters
): Promise<IncidentItemsReportData> => {
  const params = new URLSearchParams({
    main_id: String(API_MAIN_ID),
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
