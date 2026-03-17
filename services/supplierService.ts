import { Supplier } from '../maintenance.types';
import { getLocalAuthSession } from './localAuthService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

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

const toSupplier = (raw: any): Supplier => ({
  id: String(raw?.id ?? ''),
  name: String(raw?.name ?? ''),
  code: raw?.code == null ? null : String(raw.code),
  address: raw?.address == null ? null : String(raw.address),
  contact_person: raw?.contact_person == null ? null : String(raw.contact_person),
  tin: raw?.tin == null ? null : String(raw.tin),
  remarks: raw?.remarks == null ? null : String(raw.remarks),
});

export const fetchSuppliers = async (search?: string): Promise<Supplier[]> => {
  const query = new URLSearchParams({
    main_id: String(API_MAIN_ID),
    page: '1',
    per_page: '500',
  });

  if (String(search || '').trim()) {
    query.set('search', String(search).trim());
  }

  const response = await fetch(`${API_BASE_URL}/suppliers?${query.toString()}`);
  if (!response.ok) throw new Error(await parseApiErrorMessage(response));

  const payload = await response.json();
  const data = payload?.data;
  const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
  return items.map(toSupplier);
};

export const fetchSupplierById = async (id: string): Promise<Supplier> => {
  const response = await fetch(
    `${API_BASE_URL}/suppliers/${encodeURIComponent(String(id))}?main_id=${encodeURIComponent(String(API_MAIN_ID))}`
  );
  if (!response.ok) throw new Error(await parseApiErrorMessage(response));

  const payload = await response.json();
  return toSupplier(payload?.data || {});
};

export const createSupplier = async (data: Partial<Supplier>): Promise<Supplier> => {
  const { mainId } = getUserContext();

  const response = await fetch(`${API_BASE_URL}/suppliers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      main_id: mainId,
      name: data?.name || '',
      code: data?.code || '',
      address: data?.address || '',
      contact_person: data?.contact_person || '',
      tin: data?.tin || '',
      remarks: data?.remarks || '',
    }),
  });
  if (!response.ok) throw new Error(await parseApiErrorMessage(response));

  const payload = await response.json();
  return toSupplier(payload?.data || {});
};

export const updateSupplier = async (id: string, data: Partial<Supplier>): Promise<Supplier> => {
  const response = await fetch(`${API_BASE_URL}/suppliers/${encodeURIComponent(String(id))}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      main_id: API_MAIN_ID,
      name: data?.name || '',
      code: data?.code || '',
      address: data?.address || '',
      contact_person: data?.contact_person || '',
      tin: data?.tin || '',
      remarks: data?.remarks || '',
    }),
  });
  if (!response.ok) throw new Error(await parseApiErrorMessage(response));

  const payload = await response.json();
  return toSupplier(payload?.data || {});
};

export const deleteSupplier = async (id: string): Promise<void> => {
  const response = await fetch(
    `${API_BASE_URL}/suppliers/${encodeURIComponent(String(id))}?main_id=${encodeURIComponent(String(API_MAIN_ID))}`,
    { method: 'DELETE' }
  );
  if (!response.ok) throw new Error(await parseApiErrorMessage(response));
};
