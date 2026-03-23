import type { Product } from '../types';
import { normalizePriceGroup } from '../constants/pricingGroups';
import { getLocalAuthSession } from './localAuthService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

const toNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toProductStatus = (value: unknown): Product['status'] => {
  const text = String(value ?? '').toLowerCase();
  if (text === 'inactive') return 'Inactive';
  if (text === 'discontinued') return 'Discontinued';
  return 'Active';
};

const normalizeApiProduct = (raw: any): Product => ({
  id: String(raw?.id ?? ''),
  part_no: String(raw?.part_no ?? ''),
  oem_no: String(raw?.oem_no ?? ''),
  brand: String(raw?.brand ?? ''),
  barcode: String(raw?.barcode ?? ''),
  no_of_pieces_per_box: toNumber(raw?.no_of_pieces_per_box),
  item_code: String(raw?.item_code ?? ''),
  description: String(raw?.description ?? ''),
  size: String(raw?.size ?? ''),
  reorder_quantity: toNumber(raw?.reorder_quantity),
  status: toProductStatus(raw?.status),
  category: String(raw?.category ?? ''),
  descriptive_inquiry: String(raw?.descriptive_inquiry ?? ''),
  no_of_holes: String(raw?.no_of_holes ?? ''),
  replenish_quantity: toNumber(raw?.replenish_quantity),
  original_pn_no: String(raw?.original_pn_no ?? ''),
  application: String(raw?.application ?? ''),
  no_of_cylinder: String(raw?.no_of_cylinder ?? ''),
  cost: toNumber(raw?.cost),
  price_aa: toNumber(raw?.price_aa),
  price_bb: toNumber(raw?.price_bb),
  price_cc: toNumber(raw?.price_cc),
  price_dd: toNumber(raw?.price_dd),
  price_vip1: toNumber(raw?.price_vip1),
  price_vip2: toNumber(raw?.price_vip2),
  stock_wh1: toNumber(raw?.stock_wh1),
  stock_wh2: toNumber(raw?.stock_wh2),
  stock_wh3: toNumber(raw?.stock_wh3),
  stock_wh4: toNumber(raw?.stock_wh4),
  stock_wh5: toNumber(raw?.stock_wh5),
  stock_wh6: toNumber(raw?.stock_wh6),
  is_deleted: toNumber(raw?.is_deleted) === 1,
});

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

const getLocalProductContext = () => {
  const session = getLocalAuthSession();
  const userId = Number(session?.context?.user?.id || 1);
  return {
    mainId: API_MAIN_ID,
    userId: Number.isFinite(userId) && userId > 0 ? userId : 1,
  };
};

const compactObject = (payload: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));

export type ProductListStatus = 'all' | 'active' | 'inactive';

export interface FetchProductsPageParams {
  search?: string;
  status?: ProductListStatus;
  page?: number;
  perPage?: number;
}

export interface FetchProductsPageResult {
  items: Product[];
  meta: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

export const fetchProducts = async (): Promise<Product[]> => {
  const perPage = 500;
  let page = 1;
  let totalPages = 1;
  const merged: Product[] = [];

  while (page <= totalPages) {
    const query = new URLSearchParams({
      main_id: String(API_MAIN_ID),
      page: String(page),
      per_page: String(perPage),
      status: 'all',
    });

    const response = await fetch(`${API_BASE_URL}/products?${query.toString()}`);
    if (!response.ok) throw new Error(await parseApiErrorMessage(response));

    const payload = await response.json();
    const rows = Array.isArray(payload?.data?.items) ? payload.data.items : [];
    merged.push(...rows.map(normalizeApiProduct));
    totalPages = Number(payload?.data?.meta?.total_pages || 1);
    page += 1;
  }

  return merged;
};

export const fetchProductsPage = async (params: FetchProductsPageParams = {}): Promise<FetchProductsPageResult> => {
  const {
    search = '',
    status = 'all',
    page = 1,
    perPage = 100,
  } = params;

  const query = new URLSearchParams({
    main_id: String(API_MAIN_ID),
    search,
    status,
    page: String(Math.max(1, page)),
    per_page: String(Math.min(500, Math.max(1, perPage))),
  });

  const response = await fetch(`${API_BASE_URL}/products?${query.toString()}`);
  if (!response.ok) throw new Error(await parseApiErrorMessage(response));

  const payload = await response.json();
  const rows = Array.isArray(payload?.data?.items) ? payload.data.items : [];
  const meta = payload?.data?.meta || {};

  return {
    items: rows.map(normalizeApiProduct),
    meta: {
      page: Number(meta.page || page),
      per_page: Number(meta.per_page || perPage),
      total: Number(meta.total || 0),
      total_pages: Number(meta.total_pages || 1),
    },
  };
};

export const searchProducts = async (
  query: string,
  status: ProductListStatus = 'active',
): Promise<Product[]> => {
  const page = await fetchProductsPage({
    search: query,
    status,
    page: 1,
    perPage: 50,
  });
  return page.items;
};

export const createProduct = async (product: Omit<Product, 'id'>): Promise<void> => {
  const { mainId, userId } = getLocalProductContext();
  const response = await fetch(`${API_BASE_URL}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...compactObject(product as unknown as Record<string, unknown>),
      main_id: mainId,
      user_id: userId,
    }),
  });
  if (!response.ok) throw new Error(await parseApiErrorMessage(response));
};

export const updateProduct = async (id: string, updates: Partial<Product>): Promise<void> => {
  const { mainId, userId } = getLocalProductContext();
  const response = await fetch(`${API_BASE_URL}/products/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...compactObject(updates as Record<string, unknown>),
      main_id: mainId,
      user_id: userId,
    }),
  });
  if (!response.ok) throw new Error(await parseApiErrorMessage(response));
};

export const deleteProduct = async (id: string): Promise<void> => {
  const query = new URLSearchParams({ main_id: String(API_MAIN_ID) });
  const response = await fetch(`${API_BASE_URL}/products/${encodeURIComponent(id)}?${query.toString()}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error(await parseApiErrorMessage(response));
};

/**
 * Get product price based on customer price group.
 * Accepts new names (`regular`, `silver`, `gold`, `platinum`) and
 * legacy-compatible names (`AA`, `BB`, `CC`, `DD`, `VIP1`, `VIP2`).
 * `platinum` currently reuses the gold pricing column because there is no
 * dedicated database column.
 * @param product The product object
 * @param priceGroup The customer's price group
 * @returns The calculated price
 */
export const getProductPrice = (product: Product, priceGroup?: string): number => {
  if (!product) return 0;
  if (!priceGroup?.trim()) return product.price_aa || 0;

  const normalizedGroup = normalizePriceGroup(priceGroup);
  const directGroup = priceGroup.trim();
  const candidates = [
    normalizedGroup,
    directGroup,
    directGroup.toLowerCase(),
    directGroup.toUpperCase(),
  ];

  if (candidates.includes('Regular') || candidates.includes('regular') || candidates.includes('AA')) {
    return product.price_aa || 0;
  }

  if (candidates.includes('Silver') || candidates.includes('silver') || candidates.includes('VIP1')) {
    return product.price_vip1 || 0;
  }

  if (candidates.includes('Gold') || candidates.includes('gold') || candidates.includes('VIP2')) {
    return product.price_vip2 || 0;
  }

  if (candidates.includes('Platinum') || candidates.includes('platinum')) {
    return product.price_vip2 || 0;
  }

  if (candidates.includes('BB') || candidates.includes('bbb') || candidates.includes('BBB')) {
    return product.price_bb || 0;
  }

  if (candidates.includes('CC') || candidates.includes('ccc') || candidates.includes('CCC')) {
    return product.price_cc || 0;
  }

  if (candidates.includes('DD') || candidates.includes('ddd') || candidates.includes('DDD')) {
    return product.price_dd || 0;
  }

  return product.price_aa || 0;
};
