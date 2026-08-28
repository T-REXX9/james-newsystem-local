import { requestLocalApi } from './localApiClient';
export interface RecoveryItem {
  id: string;
  item_type: 'contact' | 'product';
  item_id: string;
  label: string;
  deleted_at: string;
}
export const getAllRecycleBinItems = (): Promise<RecoveryItem[]> => requestLocalApi('/recycle-bin');
export const restoreItem = (id: string) => requestLocalApi(`/recycle-bin/${encodeURIComponent(id)}`, 'POST', { action: 'restore' });
export const discardRecovery = (id: string) => requestLocalApi(`/recycle-bin/${encodeURIComponent(id)}`, 'POST', { action: 'discard' });
