import type { InventoryLog, InventoryLogFilters, OrderSlip } from '../types';
import { fetchStockMovementLogs, createStockMovementLog, updateStockMovementLog, deleteStockMovementLog } from './stockMovementLocalApiService';

export async function fetchInventoryLogs(filters: InventoryLogFilters = {}): Promise<InventoryLog[]> {
  if (!filters.item_id) throw new Error('Select a product to load its local stock movements.');
  const logs: InventoryLog[] = [];
  for (let page = 1; ; page += 1) {
    const result = await fetchStockMovementLogs({ ...filters, item_id: filters.item_id, page });
    logs.push(...result.logs);
    if (page >= result.meta.total_pages) return logs;
  }
}
export const createInventoryLog = (data: Omit<InventoryLog, 'id' | 'created_at' | 'updated_at' | 'processed_by'>) => createStockMovementLog(data);
export const updateInventoryLog = (id: string, updates: Partial<InventoryLog>) => updateStockMovementLog(id, updates);
export const deleteInventoryLog = deleteStockMovementLog;
export const getInventoryLogsByItem = (itemId: string, warehouseId?: string) => fetchInventoryLogs({ item_id: itemId, warehouse_id: warehouseId });

// Local document actions already post stock movements transactionally on the server.
// Replaying the retired client-side helpers would duplicate inventory movements.
const serverPostingRequired = (): never => { throw new Error('Inventory is posted by the local API. Use the originating document action; client-side inventory posting is disabled.'); };
export async function createInventoryLogFromPO(poId: string, userId: string): Promise<InventoryLog[]> { return serverPostingRequired(); }
export async function createInventoryLogFromInvoice(invoiceId: string, userId: string): Promise<InventoryLog[]> { return serverPostingRequired(); }
export async function createInventoryLogFromOrderSlip(slipOrId: string | OrderSlip, userId: string): Promise<InventoryLog[]> { return serverPostingRequired(); }
export async function createInventoryLogFromStockAdjustment(adjustmentId: string, userId: string): Promise<InventoryLog[]> { return serverPostingRequired(); }
export async function createInventoryLogFromReturn(returnId: string, userId: string): Promise<InventoryLog[]> { return serverPostingRequired(); }
