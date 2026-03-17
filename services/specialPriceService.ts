import {
  SpecialPriceAreaPicker,
  SpecialPriceCategoryPicker,
  SpecialPriceCustomerPicker,
  SpecialPriceDetail,
  SpecialPriceProduct,
  SpecialPriceRecord,
} from '../maintenance.types';
import { getLocalAuthToken } from './localAuthService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}

type JsonObject = Record<string, unknown>;

const parseApiErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as JsonObject;
    if (typeof payload.error === 'string' && payload.error.trim()) return payload.error.trim();
    if (typeof payload.message === 'string' && payload.message.trim()) return payload.message.trim();
  } catch {
    // ignore parse errors
  }

  return `API request failed (${response.status})`;
};

const defaultMeta = (): PaginationMeta => ({
  page: 1,
  per_page: 100,
  total: 0,
  total_pages: 0,
});

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getPayloadData = async (response: Response): Promise<unknown> => {
  const payload = (await response.json()) as unknown;
  if (isObject(payload) && 'data' in payload) {
    return payload.data;
  }
  return payload;
};

const toPaginationMeta = (raw: unknown): PaginationMeta => {
  if (!isObject(raw)) return defaultMeta();

  return {
    page: Number(raw.page ?? 1),
    per_page: Number(raw.per_page ?? 100),
    total: Number(raw.total ?? 0),
    total_pages: Number(raw.total_pages ?? 0),
  };
};

const normalizePriceType = (type: string): string => {
  if (type === 'Fix') return 'Fix Amount';
  return type;
};

const toSpecialPriceRecord = (raw: unknown): SpecialPriceRecord => {
  const value = isObject(raw) ? raw : {};

  return {
    refno: String(value.refno ?? ''),
    item_session: String(value.item_session ?? ''),
    item_code: String(value.item_code ?? ''),
    part_no: String(value.part_no ?? ''),
    description: String(value.description ?? ''),
    type: normalizePriceType(String(value.type ?? '')),
    amount: Number(value.amount ?? 0),
  };
};

const toSpecialPriceDetail = (raw: unknown): SpecialPriceDetail => {
  const value = isObject(raw) ? raw : {};

  return {
    ...toSpecialPriceRecord(value),
    customers: Array.isArray(value.customers)
      ? value.customers.map((item) => {
          const customer = isObject(item) ? item : {};
          return {
            patient_refno: String(customer.patient_refno ?? ''),
            company: String(customer.company ?? ''),
            patient_code: String(customer.patient_code ?? ''),
          };
        })
      : [],
    areas: Array.isArray(value.areas)
      ? value.areas.map((item) => {
          const area = isObject(item) ? item : {};
          return {
            area_code: String(area.area_code ?? ''),
            area_name: String(area.area_name ?? ''),
          };
        })
      : [],
    categories: Array.isArray(value.categories)
      ? value.categories.map((item) => {
          const category = isObject(item) ? item : {};
          return {
            category_id: String(category.category_id ?? ''),
            name: String(category.name ?? ''),
          };
        })
      : [],
  };
};

const toPaginatedResult = <T>(raw: unknown, mapper: (item: unknown) => T): PaginatedResult<T> => {
  const value = isObject(raw) ? raw : {};
  const items = Array.isArray(value.items) ? value.items.map(mapper) : [];

  return {
    items,
    meta: toPaginationMeta(value.meta),
  };
};

const createQuery = (search: string, page: number, perPage: number): URLSearchParams => {
  const query = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });

  if (search.trim()) {
    query.set('search', search.trim());
  }

  return query;
};

const getAuthHeader = (): Record<string, string> => {
  const token = getLocalAuthToken();
  if (!token) {
    throw new Error('Authentication required for special price requests');
  }

  return { Authorization: `Bearer ${token}` };
};

const requestJson = async (input: string, init: RequestInit = {}): Promise<unknown> => {
  const headers = new Headers(init.headers);
  Object.entries(getAuthHeader()).forEach(([key, value]) => headers.set(key, value));

  const response = await fetch(input, {
    ...init,
    headers,
  });
  if (!response.ok) throw new Error(await parseApiErrorMessage(response));

  return getPayloadData(response);
};

export const fetchSpecialPrices = async (
  search = '',
  page = 1,
  perPage = 100
): Promise<PaginatedResult<SpecialPriceRecord>> => {
  const payload = await requestJson(`${API_BASE_URL}/special-prices?${createQuery(search, page, perPage).toString()}`);
  return toPaginatedResult(payload, toSpecialPriceRecord);
};

export const fetchSpecialPriceDetail = async (refno: string): Promise<SpecialPriceDetail> => {
  const payload = await requestJson(`${API_BASE_URL}/special-prices/${encodeURIComponent(refno)}`);
  return toSpecialPriceDetail(payload);
};

export const createSpecialPrice = async (
  itemSession: string,
  type: string,
  amount: number
): Promise<SpecialPriceDetail> => {
  const payload = await requestJson(`${API_BASE_URL}/special-prices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      item_session: itemSession,
      type: normalizePriceType(type),
      amount,
    }),
  });
  return toSpecialPriceDetail(payload);
};

export const updateSpecialPrice = async (
  refno: string,
  type: string,
  amount: number
): Promise<SpecialPriceDetail> => {
  const payload = await requestJson(`${API_BASE_URL}/special-prices/${encodeURIComponent(refno)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: normalizePriceType(type),
      amount,
    }),
  });
  return toSpecialPriceDetail(payload);
};

export const deleteSpecialPrice = async (refno: string): Promise<void> => {
  await requestJson(`${API_BASE_URL}/special-prices/${encodeURIComponent(refno)}`, {
    method: 'DELETE',
  });
};

export const fetchProducts = async (
  search = '',
  page = 1,
  perPage = 100
): Promise<PaginatedResult<SpecialPriceProduct>> => {
  const payload = await requestJson(`${API_BASE_URL}/special-prices/products?${createQuery(search, page, perPage).toString()}`);
  return toPaginatedResult(payload, (item) => {
    const value = isObject(item) ? item : {};
    return {
      lsession: String(value.lsession ?? ''),
      litemcode: String(value.litemcode ?? ''),
      lpartno: String(value.lpartno ?? ''),
      ldescription: String(value.ldescription ?? ''),
    };
  });
};

export const fetchCustomerPicker = async (
  search = '',
  page = 1,
  perPage = 100
): Promise<PaginatedResult<SpecialPriceCustomerPicker>> => {
  const payload = await requestJson(`${API_BASE_URL}/special-prices/customers?${createQuery(search, page, perPage).toString()}`);
  return toPaginatedResult(payload, (item) => {
    const value = isObject(item) ? item : {};
    return {
      lsessionid: String(value.lsessionid ?? ''),
      lcompany: String(value.lcompany ?? ''),
      lpatient_code: String(value.lpatient_code ?? ''),
    };
  });
};

export const fetchAreaPicker = async (
  search = '',
  page = 1,
  perPage = 100
): Promise<PaginatedResult<SpecialPriceAreaPicker>> => {
  const payload = await requestJson(`${API_BASE_URL}/special-prices/areas?${createQuery(search, page, perPage).toString()}`);
  return toPaginatedResult(payload, (item) => {
    const value = isObject(item) ? item : {};
    return {
      code: String(value.code ?? ''),
      name: String(value.name ?? ''),
    };
  });
};

export const fetchCategoryPicker = async (
  search = '',
  page = 1,
  perPage = 100
): Promise<PaginatedResult<SpecialPriceCategoryPicker>> => {
  const payload = await requestJson(`${API_BASE_URL}/special-prices/categories?${createQuery(search, page, perPage).toString()}`);
  return toPaginatedResult(payload, (item) => {
    const value = isObject(item) ? item : {};
    return {
      id: String(value.id ?? ''),
      name: String(value.name ?? ''),
    };
  });
};

export const addCustomer = async (refno: string, patientRefno: string): Promise<SpecialPriceDetail> => {
  const payload = await requestJson(`${API_BASE_URL}/special-prices/${encodeURIComponent(refno)}/customers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patient_refno: patientRefno,
    }),
  });
  return toSpecialPriceDetail(payload);
};

export const removeCustomer = async (refno: string, patientRefno: string): Promise<void> => {
  await requestJson(
    `${API_BASE_URL}/special-prices/${encodeURIComponent(refno)}/customers/${encodeURIComponent(patientRefno)}`,
    { method: 'DELETE' }
  );
};

export const addArea = async (refno: string, areaCode: string): Promise<SpecialPriceDetail> => {
  const payload = await requestJson(`${API_BASE_URL}/special-prices/${encodeURIComponent(refno)}/areas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      area_code: areaCode,
    }),
  });
  return toSpecialPriceDetail(payload);
};

export const removeArea = async (refno: string, areaCode: string): Promise<void> => {
  await requestJson(
    `${API_BASE_URL}/special-prices/${encodeURIComponent(refno)}/areas/${encodeURIComponent(areaCode)}`,
    { method: 'DELETE' }
  );
};

export const addCategory = async (refno: string, categoryId: string): Promise<SpecialPriceDetail> => {
  const payload = await requestJson(`${API_BASE_URL}/special-prices/${encodeURIComponent(refno)}/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category_id: categoryId,
    }),
  });
  return toSpecialPriceDetail(payload);
};

export const removeCategory = async (refno: string, categoryId: string): Promise<void> => {
  await requestJson(
    `${API_BASE_URL}/special-prices/${encodeURIComponent(refno)}/categories/${encodeURIComponent(categoryId)}`,
    { method: 'DELETE' }
  );
};
