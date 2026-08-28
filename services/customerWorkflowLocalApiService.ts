import { CUSTOMER_UPDATED_EVENT } from '../utils/customerWorkflowEvents';
import type { Contact } from '../types';
import { getLocalAuthSession } from './localAuthService';
import { requestLocalApi } from './localApiClient';
import { mapContactUpdatesToApi, mapContactPersonPayloadToApi } from './customerDatabaseLocalApiService';

export interface CustomerHistoryRecord {
  id: string;
  number: string;
  date: string;
  status: string;
  amount: number;
  notes: string;
}
export interface CustomerRequest {
  id: string;
  contact_id: string;
  kind: 'customer_update' | 'discount';
  payload: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected';
  submitted_by_name: string;
  submitted_at: string;
  reviewed_at: string | null;
  review_note: string;
}
const pathFor = (id: string) => `/customer-workflows/${encodeURIComponent(id)}`;
const requireSession = () => {
  if (!getLocalAuthSession()?.token) throw new Error('Please sign in again to access customer records.');
};
async function history(id: string, kind: 'inquiries' | 'returns'): Promise<CustomerHistoryRecord[]> {
  requireSession();
  const rows: CustomerHistoryRecord[] = [];
  for (let page = 1; ; page++) {
    const result = await requestLocalApi<{ items: Record<string, unknown>[]; meta: { total_pages: number } }>(`${pathFor(id)}/${kind}?page=${page}`);
    if (!Array.isArray(result?.items)) throw new Error('Invalid customer history response');
    rows.push(...result.items.map(row => kind === 'returns' ? {
      id: String(row.lrefno), number: String(row.lcredit_no || row.lrefno), date: String(row.ldate || ''),
      status: String(row.lstatus || 'Pending'), amount: Number(row.total_amount || 0), notes: String(row.lremark || ''),
    } : {
      id: String(row.inquiry_refno), number: String(row.inquiry_no || row.inquiry_refno), date: String(row.sales_date || ''),
      status: Number(row.is_cancelled) ? 'Cancelled' : row.so_refno ? 'Converted' : String(row.status || 'Pending'),
      amount: Number(row.grand_total || 0), notes: String(row.remarks || ''),
    }));
    if (page >= Number(result.meta?.total_pages || 1)) return rows;
  }
}
export const fetchCustomerInquiries = (id: string) => history(id, 'inquiries');
export const fetchCustomerReturns = (id: string) => history(id, 'returns');
export const fetchCustomerRequests = (id: string): Promise<CustomerRequest[]> => {
  requireSession();
  return requestLocalApi(`${pathFor(id)}/requests`);
};
export const createDiscountRequest = (request: { contact_id: string; discount_percentage: number; reason: string }) => {
  requireSession();
  return requestLocalApi(`${pathFor(request.contact_id)}/requests`, 'POST', {
    kind: 'discount', payload: { discount_percentage: request.discount_percentage, reason: request.reason },
  });
};
export const requestCustomerUpdate = (id: string, changes: Partial<Contact>) => {
  requireSession();
  const payload: Record<string, unknown> = mapContactUpdatesToApi(changes);
  if (changes.contactPersons) payload.contacts = changes.contactPersons
    .filter(person => person.name.trim())
    .map(person => ({ ...mapContactPersonPayloadToApi(person), ...(/^\d+$/.test(person.id) ? { id: person.id } : {}) }));
  if (!Object.keys(payload).length) throw new Error('No supported customer fields were changed.');
  return requestLocalApi(`${pathFor(id)}/requests`, 'POST', { kind: 'customer_update', payload });
};
export const reviewCustomerRequest = async (contactId: string, id: string, decision: 'approved' | 'rejected', note: string) => {
  requireSession();
  const result = await requestLocalApi(`${pathFor(contactId)}/requests/${encodeURIComponent(id)}/review`, 'POST', { decision, note });
  if (decision === 'approved' && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(CUSTOMER_UPDATED_EVENT, { detail: { contactId } }));
  return result;
};
