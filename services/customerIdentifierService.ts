import { getLocalAuthSession } from './localAuthService';
import { parseApiErrorMessage } from './localApiAuth';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';

export type CustomerIdentifier =
  | 'New Customer'
  | 'Existing Customer'
  | 'Verified Prospective'
  | 'Unverified Prospective'
  | 'Blacklisted'
  | 'Do Not Call';

export const fetchCustomerIdentifiers = async (): Promise<Map<string, CustomerIdentifier[]>> => {
  const session = getLocalAuthSession();
  const headers = new Headers();
  if (session?.token) headers.set('Authorization', `Bearer ${session.token}`);
  const response = await fetch(`${API_BASE_URL}/customer-identifiers`, {
    headers,
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(await parseApiErrorMessage(response));
  const payload = await response.json();
  const items = payload?.data?.items;
  const result = new Map<string, CustomerIdentifier[]>();
  if (Array.isArray(items)) {
    for (const item of items) {
      const customerId = String(item?.customer_id ?? '').trim();
      const identifiers = item?.identifiers;
      if (!customerId) continue;
      if (!Array.isArray(identifiers)) continue;
      const normalized = identifiers.filter((identifier): identifier is CustomerIdentifier =>
        ['New Customer', 'Existing Customer', 'Verified Prospective', 'Unverified Prospective', 'Blacklisted', 'Do Not Call'].includes(String(identifier))
      );
      if (normalized.length > 0) result.set(customerId, normalized);
    }
  }
  return result;
};
