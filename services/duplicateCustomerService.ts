import type { Contact } from '../types';
import { requestLocalApi } from './localApiClient';

export interface PotentialDuplicateMatch {
  session_id: string;
  company: string;
  status: string;
  profile_type: string;
  is_blacklisted: boolean;
  matched_fields: string[];
}

export interface DuplicateCustomerGroup {
  session_ids: string[];
  matched_fields: string[];
}

export interface CustomerMergePreview {
  merge_id: number;
  customers: Contact[];
  survivor_session_id: string;
  duplicate_session_id: string;
  final_company_name: string;
  counts: Record<string, number | null>;
  financial_totals: Record<string, number | null>;
  conflicts: Record<string, string>;
  field_decisions: Record<string, 'survivor' | 'duplicate'>;
  blocking_warnings: string[];
  executable: boolean;
  preview_checksum: string;
  inventory: Array<{ table: string; column: string; rows_found: number | null; supported: boolean; status: string }>;
}

export interface CustomerMergeResult {
  merge_id: number;
  status: string;
  survivor_session_id: string;
  duplicate_session_id: string;
  final_company_name: string;
}

const firstContactName = (contact: Contact): string =>
  String(contact.contactPersons?.[0]?.name || contact.name || '').trim();

export async function findPotentialDuplicates(contact: Contact): Promise<PotentialDuplicateMatch[]> {
  const query = new URLSearchParams({
    company: contact.company || '',
    tin: contact.tin || '',
    phone: contact.phone || '',
    mobile: contact.mobile || '',
    address: contact.address || '',
    delivery_address: contact.deliveryAddress || '',
    city: contact.city || '',
    province: contact.province || '',
    contact_person: firstContactName(contact),
    exclude_session_id: contact.id,
  });
  const result = await requestLocalApi<{ items?: PotentialDuplicateMatch[] }>(
    `/customer-database/name-check?${query.toString()}`,
  );
  return Array.isArray(result?.items) ? result.items : [];
}

export async function fetchDuplicateCustomerGroups(): Promise<DuplicateCustomerGroup[]> {
  const result = await requestLocalApi<{ items?: DuplicateCustomerGroup[] }>(
    '/customer-database/duplicate-groups',
  );
  return Array.isArray(result?.items) ? result.items : [];
}

export function previewCustomerMerge(input: {
  survivor_session_id: string;
  duplicate_session_id: string;
  final_company_name: string;
  merge_reason: string;
  idempotency_key: string;
  field_decisions?: Record<string, 'survivor' | 'duplicate'>;
}): Promise<CustomerMergePreview> {
  return requestLocalApi<CustomerMergePreview>('/customer-merges/preview', 'POST', input);
}

export function executeCustomerMerge(input: {
  survivor_session_id: string;
  duplicate_session_id: string;
  final_company_name: string;
  merge_reason: string;
  confirmation: 'MERGE CUSTOMER RECORDS';
  idempotency_key: string;
  field_decisions?: Record<string, 'survivor' | 'duplicate'>;
}): Promise<CustomerMergeResult> {
  return requestLocalApi<CustomerMergeResult>('/customer-merges/execute', 'POST', input);
}
