/**
 * Compatibility import facade backed exclusively by local API implementations.
 * New callers should import the feature's local API service directly.
 */
import type { UserProfile } from '../types';
import { fetchProfilesLocal } from './accessLocalApiService';
import { requestLocalApi } from './localApiClient';
import { fetchContactCustomerLogsForDailyCall, createCustomerLogForDailyCall } from './dailyCallMonitoringService';

export { fetchContacts, createContact, updateContact, bulkUpdateContacts, fetchCustomerMetrics } from './customerDatabaseLocalApiService';
export { fetchProducts, fetchProductsPage, createProduct, updateProduct, deleteProduct } from './productLocalApiService';
export { dispatchWorkflowNotification } from './notificationLocalApiService';
export { fetchDailyCallPurchaseHistory as fetchPurchaseHistory } from './dailyCallCustomerDetailService';

export async function fetchProfiles(): Promise<UserProfile[]> {
  const profiles: UserProfile[] = [];
  for (let page = 1; ; page += 1) {
    const result = await fetchProfilesLocal({ page, perPage: 200 });
    profiles.push(...result.items);
    if (page >= result.meta.total_pages) return profiles;
  }
}
export async function bulkUpdateProducts(ids: string[], updates: Record<string, unknown>): Promise<void> {
  await requestLocalApi('/products/bulk-update', 'POST', { ids, updates });
}

// Personal comments use the same persisted customer log as daily call monitoring.
export async function fetchPersonalComments(contactId: string) {
  const logs = await fetchContactCustomerLogsForDailyCall(contactId);
  return logs.filter(log => log.entry_type === 'Note' && log.topic === 'Comment' && log.status !== 'Management Instruction')
    .map(log => ({ id: log.id, contact_id: log.contact_id, author_id: log.created_by, author_name: log.created_by_name,
      text: log.note || log.comments || '', timestamp: log.occurred_at }));
}
export async function createPersonalComment(contactId: string, authorId: string, authorName: string, text: string, authorAvatar?: string): Promise<void> {
  await createCustomerLogForDailyCall({ contact_id: contactId, entry_type: 'Note', topic: 'Comment', status: 'Note', note: text });
}
