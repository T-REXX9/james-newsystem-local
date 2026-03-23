import { describe, expect, it } from 'vitest';
import { resolveStockMovementNavigationTarget } from '../stockMovementNavigation';

const baseLog = {
  id: '1',
  item_id: 'ITEM-1',
  date: '2026-02-16',
  reference_no: 'REF-123',
  partner: 'Partner',
  warehouse_id: 'WH1',
  qty_in: 1,
  qty_out: 0,
  status_indicator: '+' as const,
  unit_price: 0,
  processed_by: '1',
  notes: '',
  created_at: '2026-02-16',
};

describe('resolveStockMovementNavigationTarget', () => {
  it('maps invoice reference', () => {
    const target = resolveStockMovementNavigationTarget({
      ...baseLog,
      transaction_type: 'Invoice',
    } as any);
    expect(target).toEqual({
      tab: 'sales-transaction-invoice',
      payload: { invoiceRefNo: 'REF-123' },
    });
  });

  it('maps receiving reference', () => {
    const target = resolveStockMovementNavigationTarget({
      ...baseLog,
      transaction_type: 'Receiving',
    } as any);
    expect(target).toEqual({
      tab: 'warehouse-purchasing-receiving-stock',
      payload: { rrRefNo: 'REF-123' },
    });
  });

  it('maps transfer receipt reference with transferId', () => {
    const target = resolveStockMovementNavigationTarget({
      ...baseLog,
      transaction_type: 'Transfer Receipt',
    } as any);
    expect(target).toEqual({
      tab: 'warehouse-inventory-transfer-stock',
      payload: { transferId: 'REF-123', transferNo: 'REF-123' },
    });
  });

  it('maps Transfer Product reference with transferId', () => {
    const target = resolveStockMovementNavigationTarget({
      ...baseLog,
      transaction_type: 'Transfer Product',
    } as any);
    expect(target).toEqual({
      tab: 'warehouse-inventory-transfer-stock',
      payload: { transferId: 'REF-123', transferNo: 'REF-123' },
    });
  });

  it('maps stock adjustment reference', () => {
    const target = resolveStockMovementNavigationTarget({
      ...baseLog,
      transaction_type: 'Stock Adjustment',
    } as any);
    expect(target).toEqual({
      tab: 'warehouse-inventory-stock-adjustment',
      payload: { adjustmentNo: 'REF-123' },
    });
  });

  it('maps credit memo reference', () => {
    const target = resolveStockMovementNavigationTarget({
      ...baseLog,
      transaction_type: 'Credit Memo',
    } as any);
    expect(target).toEqual({
      tab: 'accounting-transactions-sales-return-credit',
      payload: { creditMemoRefNo: 'REF-123' },
    });
  });

  it('returns null for unsupported or blank refs', () => {
    const unsupported = resolveStockMovementNavigationTarget({
      ...baseLog,
      transaction_type: 'Unknown Tx',
    } as any);
    expect(unsupported).toBeNull();

    const blankRef = resolveStockMovementNavigationTarget({
      ...baseLog,
      reference_no: '   ',
      transaction_type: 'Invoice',
    } as any);
    expect(blankRef).toBeNull();
  });
});
