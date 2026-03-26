import { SalesInquiry, SalesInquiryDTO, SalesInquiryItem, SalesInquiryStatus, SalesOrder } from '../types';
import { getLocalAuthSession } from './localAuthService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

const toNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const getUserContext = () => {
  const session = getLocalAuthSession();
  const userId = Number(session?.context?.user?.id || 1);
  return {
    mainId: API_MAIN_ID,
    userId: Number.isFinite(userId) && userId > 0 ? userId : 1,
  };
};

const mapApiStatusToUi = (status: unknown): SalesInquiryStatus => {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'submitted') return SalesInquiryStatus.APPROVED;
  if (normalized === 'cancelled' || normalized === 'canceled') return SalesInquiryStatus.CANCELLED;
  return SalesInquiryStatus.DRAFT;
};

const mapUiStatusToApi = (status: SalesInquiryStatus | string | undefined): string => {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === String(SalesInquiryStatus.APPROVED).toLowerCase()) return 'Submitted';
  if (normalized === String(SalesInquiryStatus.CANCELLED).toLowerCase()) return 'Cancelled';
  return 'Pending';
};

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

const requestApi = async (url: string, init?: RequestInit): Promise<any> => {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(await parseApiErrorMessage(response));
  }
  const payload = await response.json();
  if (!payload?.ok) {
    throw new Error(payload?.error || 'API request failed');
  }
  return payload.data;
};

const mapApiItem = (row: any, inquiryId: string): SalesInquiryItem => ({
  id: String(row?.id ?? ''),
  inquiry_id: inquiryId,
  item_id: String(row?.item_id ?? ''),
  qty: toNumber(row?.qty, 0),
  part_no: String(row?.part_no ?? ''),
  item_code: String(row?.item_code ?? ''),
  location: String(row?.location ?? ''),
  description: String(row?.description ?? ''),
  unit_price: toNumber(row?.unit_price, 0),
  amount: toNumber(row?.amount, toNumber(row?.qty, 0) * toNumber(row?.unit_price, 0)),
  remark: String(row?.remark ?? ''),
  approval_status: toNumber(row?.approved, 1) > 0 ? 'approved' : 'pending',
});

const mapApiInquiry = (row: any): SalesInquiry => {
  const inquiryId = String(row?.inquiry_refno || row?.id || '');
  const mappedItems: SalesInquiryItem[] = Array.isArray(row?.items)
    ? row.items.map((item: any) => mapApiItem(item, inquiryId))
    : [];

  return {
    id: inquiryId,
    inquiry_no: String(row?.inquiry_no || ''),
    contact_id: String(row?.contact_id || ''),
    sales_date: String(row?.sales_date || ''),
    sales_person: String(row?.sales_person || ''),
    delivery_address: String(row?.delivery_address || ''),
    reference_no: String(row?.reference_no || ''),
    customer_reference: String(row?.customer_reference || ''),
    send_by: '',
    price_group: String(row?.price_group || ''),
    credit_limit: toNumber(row?.credit_limit, 0),
    terms: String(row?.terms || ''),
    promise_to_pay: String(row?.promise_to_pay || ''),
    po_number: String(row?.po_number || ''),
    remarks: String(row?.remarks || ''),
    inquiry_type: String(row?.inquiry_type || ''),
    urgency: String(row?.urgency || ''),
    urgency_date: String(row?.urgency_date || ''),
    grand_total: toNumber(row?.grand_total, 0),
    created_by: String(row?.sales_person_id || ''),
    created_at: String(row?.sales_date || ''),
    updated_at: undefined,
    status: mapApiStatusToUi(row?.status),
    is_deleted: toNumber(row?.is_cancelled, 0) > 0,
    deleted_at: undefined,
    items: mappedItems,
    so_no: String(row?.so_no || ''),
    so_refno: String(row?.so_refno || ''),
    invoice_no: String(row?.invoice_no || ''),
    dr_no: String(row?.dr_no || ''),
  };
};

const buildInquiryPayload = (dto: SalesInquiryDTO) => ({
  main_id: API_MAIN_ID,
  user_id: getUserContext().userId,
  contact_id: dto.contact_id,
  sales_date: dto.sales_date,
  sales_person: dto.sales_person,
  delivery_address: dto.delivery_address,
  reference_no: dto.reference_no,
  customer_reference: dto.customer_reference,
  price_group: dto.price_group,
  credit_limit: dto.credit_limit,
  terms: dto.terms,
  promise_to_pay: dto.promise_to_pay,
  po_number: dto.po_number,
  remarks: dto.remarks || '',
  inquiry_type: dto.inquiry_type,
  urgency: dto.urgency,
  urgency_date: dto.urgency_date || null,
  status: mapUiStatusToApi(dto.status),
  items: dto.items.map((item) => ({
    item_id: item.item_id || '',
    item_refno: item.item_id || '',
    part_no: item.part_no || '',
    item_code: item.item_code || '',
    description: item.description || '',
    location: item.location || '',
    qty: toNumber(item.qty, 0),
    unit_price: toNumber(item.unit_price, 0),
    remark: item.remark || '',
    approved: item.approval_status === 'approved' ? 1 : 0,
  })),
});

export const createSalesInquiry = async (data: SalesInquiryDTO): Promise<SalesInquiry> => {
  if (!data.items || data.items.length === 0) {
    throw new Error('Please add at least one line item before saving the inquiry.');
  }

  const payload = buildInquiryPayload(data);
  const created = await requestApi(`${API_BASE_URL}/sales-inquiries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return mapApiInquiry(created);
};

export const updateSalesInquiry = async (id: string, data: SalesInquiryDTO): Promise<SalesInquiry> => {
  if (!data.items || data.items.length === 0) {
    throw new Error('Please add at least one line item before saving the inquiry.');
  }

  const payload = {
    ...buildInquiryPayload(data),
    main_id: API_MAIN_ID,
  };

  const updated = await requestApi(`${API_BASE_URL}/sales-inquiries/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return mapApiInquiry(updated);
};

export const getSalesInquiry = async (id: string): Promise<SalesInquiry | null> => {
  try {
    const record = await requestApi(
      `${API_BASE_URL}/sales-inquiries/${encodeURIComponent(id)}?main_id=${encodeURIComponent(String(API_MAIN_ID))}`
    );
    return mapApiInquiry(record);
  } catch (err) {
    return null;
  }
};

export const getAllSalesInquiries = async (): Promise<SalesInquiry[]> => {
  const list = await requestApi(
    `${API_BASE_URL}/sales-inquiries?main_id=${encodeURIComponent(String(API_MAIN_ID))}&status=all&page=1&per_page=200`
  );

  const rows = Array.isArray(list?.items) ? list.items : [];
  return rows.map(mapApiInquiry);
};

export const updateInquiryStatus = async (id: string, status: SalesInquiryStatus): Promise<void> => {
  const payload = {
    main_id: API_MAIN_ID,
    status: mapUiStatusToApi(status),
  };

  await requestApi(`${API_BASE_URL}/sales-inquiries/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
};

export const approveInquiry = async (id: string): Promise<SalesInquiry | null> => {
  await updateInquiryStatus(id, SalesInquiryStatus.APPROVED);
  return getSalesInquiry(id);
};

const mapConvertedSalesOrder = (payload: any): SalesOrder => {
  const order = payload?.order || {};
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const summary = payload?.summary || {};
  const id = String(order?.sales_refno || '');
  return {
    id,
    order_no: String(order?.sales_no || ''),
    inquiry_id: String(order?.inquiry_refno || ''),
    contact_id: String(order?.contact_id || ''),
    sales_date: String(order?.sales_date || ''),
    sales_person: String(order?.sales_person || ''),
    delivery_address: String(order?.delivery_address || ''),
    reference_no: String(order?.reference_no || ''),
    customer_reference: String(order?.customer_reference || ''),
    send_by: '',
    price_group: String(order?.price_group || ''),
    credit_limit: toNumber(order?.credit_limit, 0),
    terms: String(order?.terms || ''),
    promise_to_pay: String(order?.promise_to_pay || ''),
    po_number: String(order?.po_number || ''),
    remarks: String(order?.remarks || ''),
    inquiry_type: '',
    urgency: String(order?.urgency || ''),
    urgency_date: String(order?.urgency_date || ''),
    grand_total: toNumber(summary?.grand_total, 0),
    status: String(order?.status || 'Submitted') as any,
    approved_by: '',
    approved_at: '',
    created_by: String(order?.created_by || ''),
    created_at: String(order?.sales_date || ''),
    updated_at: '',
    is_deleted: false,
    items: items.map((row: any) => ({
      id: String(row?.id || ''),
      order_id: id,
      item_id: String(row?.item_refno || row?.item_id || ''),
      qty: toNumber(row?.qty, 0),
      part_no: String(row?.part_no || ''),
      item_code: String(row?.item_code || ''),
      location: String(row?.location || ''),
      description: String(row?.description || ''),
      unit_price: toNumber(row?.unit_price, 0),
      amount: toNumber(row?.amount, toNumber(row?.qty, 0) * toNumber(row?.unit_price, 0)),
      remark: String(row?.remark || ''),
      approval_status: 'approved',
    })),
  };
};

export const convertToOrder = async (inquiryId: string): Promise<SalesOrder> => {
  const context = getUserContext();
  const payload = {
    main_id: context.mainId,
    user_id: context.userId,
  };
  const converted = await requestApi(`${API_BASE_URL}/sales-inquiries/${encodeURIComponent(inquiryId)}/actions/convert-to-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return mapConvertedSalesOrder(converted);
};

export const deleteSalesInquiry = async (id: string): Promise<boolean> => {
  await requestApi(
    `${API_BASE_URL}/sales-inquiries/${encodeURIComponent(id)}?main_id=${encodeURIComponent(String(API_MAIN_ID))}`,
    { method: 'DELETE' }
  );
  return true;
};
