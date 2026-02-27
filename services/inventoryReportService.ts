export interface InventoryReportFilters {
  category?: string;
  partNumber?: string;
  itemCode?: string;
  dateFrom?: string;
  dateTo?: string;
  stockStatus?: 'all' | 'with_stock' | 'without_stock';
  reportType?: 'inventory' | 'product';
}

export interface WarehouseOption {
  id: string;
  name: string;
}

export interface InventoryReportRow {
  id: string;
  partNo: string;
  itemCode: string;
  description: string;
  category: string;
  location?: string;
  cost?: number;
  warehouseStock: Record<string, number>;
  totalStock: number;
  value?: number;
}

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

export const WAREHOUSES = [
  { id: 'WH1', name: 'Warehouse 1' },
  { id: 'WH2', name: 'Warehouse 2' },
  { id: 'WH3', name: 'Warehouse 3' },
  { id: 'WH4', name: 'Warehouse 4' },
  { id: 'WH5', name: 'Warehouse 5' },
  { id: 'WH6', name: 'Warehouse 6' },
];

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

export interface InventoryReportOptions {
  categories: string[];
  partNumbers: { id: string; partNo: string }[];
  itemCodes: { id: string; itemCode: string }[];
  warehouses: WarehouseOption[];
}

export const fetchInventoryReportOptions = async (): Promise<InventoryReportOptions> => {
  try {
    const params = new URLSearchParams({
      main_id: String(API_MAIN_ID),
    });
    const data = await requestApi(`${API_BASE_URL}/inventory-report/options?${params.toString()}`);

    const categories = Array.isArray(data?.categories) ? data.categories.map(String).filter(Boolean) : [];
    const partNumbersRaw = Array.isArray(data?.part_numbers) ? data.part_numbers : [];
    const itemCodesRaw = Array.isArray(data?.item_codes) ? data.item_codes : [];
    const warehousesRaw = Array.isArray(data?.warehouses) ? data.warehouses : [];

    return {
      categories,
      partNumbers: partNumbersRaw.map((partNo: string, index: number) => ({ id: String(index + 1), partNo: String(partNo) })),
      itemCodes: itemCodesRaw.map((itemCode: string, index: number) => ({ id: String(index + 1), itemCode: String(itemCode) })),
      warehouses: warehousesRaw
        .map((wh: any) => ({ id: String(wh?.id || ''), name: String(wh?.name || '') }))
        .filter((wh: WarehouseOption) => wh.id !== '' && wh.name !== ''),
    };
  } catch (error) {
    console.error('Error fetching inventory report options:', error);
    return {
      categories: [],
      partNumbers: [],
      itemCodes: [],
      warehouses: [],
    };
  }
};

export const fetchCategories = async (): Promise<string[]> => {
  try {
    const options = await fetchInventoryReportOptions();
    return options.categories;
  } catch (err) {
    console.error('Error fetching categories:', err);
    return [];
  }
};

export const fetchPartNumbers = async (): Promise<{ id: string; partNo: string }[]> => {
  try {
    const options = await fetchInventoryReportOptions();
    return options.partNumbers;
  } catch (err) {
    console.error('Error fetching part numbers:', err);
    return [];
  }
};

export const fetchItemCodes = async (): Promise<{ id: string; itemCode: string }[]> => {
  try {
    const options = await fetchInventoryReportOptions();
    return options.itemCodes;
  } catch (err) {
    console.error('Error fetching item codes:', err);
    return [];
  }
};

export const fetchInventoryReport = async (
  filters: InventoryReportFilters
): Promise<{ rows: InventoryReportRow[]; warehouses: WarehouseOption[] }> => {
  try {
    const params = new URLSearchParams({
      main_id: String(API_MAIN_ID),
      stock_status: filters.stockStatus || 'all',
      report_type: filters.reportType || 'inventory',
    });
    if (filters.category) params.set('category', filters.category);
    if (filters.partNumber) params.set('part_number', filters.partNumber);
    if (filters.itemCode) params.set('item_code', filters.itemCode);
    if (filters.dateFrom) params.set('date_from', filters.dateFrom);
    if (filters.dateTo) params.set('date_to', filters.dateTo);

    const data = await requestApi(`${API_BASE_URL}/inventory-report?${params.toString()}`);
    const warehousesRaw = Array.isArray(data?.warehouses) ? data.warehouses : [];
    const warehouses: WarehouseOption[] = warehousesRaw
      .map((wh: any) => ({ id: String(wh?.id || ''), name: String(wh?.name || '') }))
      .filter((wh: WarehouseOption) => wh.id !== '' && wh.name !== '');

    const rows: InventoryReportRow[] = (Array.isArray(data?.items) ? data.items : []).map((row: any) => ({
      id: String(row?.id ?? ''),
      partNo: String(row?.part_no || ''),
      itemCode: String(row?.item_code || ''),
      description: String(row?.description || ''),
      category: String(row?.category || ''),
      location: String(row?.location || ''),
      cost: toNumber(row?.cost, 0),
      warehouseStock:
        typeof row?.warehouse_stock === 'object' && row?.warehouse_stock !== null ? row.warehouse_stock : {},
      totalStock: toNumber(row?.total_stock, 0),
      value: toNumber(row?.value, 0),
    }));

    return { rows, warehouses };
  } catch (err) {
    console.error('Error fetching inventory report:', err);
    return { rows: [], warehouses: [] };
  }
};
