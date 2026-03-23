import type { InventoryLogWithProduct } from '../types';

export interface StockMovementNavigationTarget {
  tab: string;
  payload: Record<string, string>;
}

export const resolveStockMovementNavigationTarget = (
  log: InventoryLogWithProduct
): StockMovementNavigationTarget | null => {
  const tx = String(log.transaction_type || '').toLowerCase();
  const ref = String(log.reference_no || '').trim();
  if (!ref) return null;

  if (tx === 'invoice') {
    return { tab: 'sales-transaction-invoice', payload: { invoiceRefNo: ref } };
  }
  if (tx === 'order slip') {
    return { tab: 'sales-transaction-order-slip', payload: { orderSlipRefNo: ref } };
  }
  if (tx === 'purchase order') {
    return { tab: 'warehouse-purchasing-purchase-order', payload: { poRefNo: ref } };
  }
  if (tx === 'receiving' || tx.includes('receiv')) {
    // Old-system behavior: receiving references open the receiving report page.
    return { tab: 'warehouse-purchasing-receiving-stock', payload: { rrRefNo: ref } };
  }
  if (tx === 'transfer product' || tx === 'transfer receipt' || tx === 'stock transfer' || tx.includes('transfer')) {
    return { tab: 'warehouse-inventory-transfer-stock', payload: { transferId: ref, transferNo: ref } };
  }
  if (tx === 'stock adjustment' || tx.includes('adjust')) {
    return { tab: 'warehouse-inventory-stock-adjustment', payload: { adjustmentNo: ref } };
  }
  if (tx === 'credit memo' || tx.includes('credit')) {
    return { tab: 'accounting-transactions-sales-return-credit', payload: { creditMemoRefNo: ref } };
  }

  return null;
};
