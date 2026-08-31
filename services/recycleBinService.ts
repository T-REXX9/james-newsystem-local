import { requestLocalApi } from './localApiClient';
export interface RecoveryItem {
  id: string;
  item_type: 'contact' | 'product' | 'purchase_request' | 'purchase_order' | 'receiving_report';
  record_type?: string;
  item_id: string;
  label: string;
  record_number?: string;
  module?: string;
  status?: string;
  delete_reason?: string;
  deleted_at: string;
  deleted_by?: string | number | null;
}
export const getAllRecycleBinItems = (): Promise<RecoveryItem[]> => requestLocalApi('/recycle-bin');
export const restoreRecycleBinItem = (item: Pick<RecoveryItem, 'item_type' | 'item_id'>): Promise<{ restored: boolean }> =>
  requestLocalApi(`/recycle-bin/${encodeURIComponent(item.item_type)}/${encodeURIComponent(item.item_id)}/restore`, 'POST');
