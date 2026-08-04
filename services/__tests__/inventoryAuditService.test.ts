import { describe, expect, it } from 'vitest';
import { centralizeInventoryAuditWarehouses } from '../inventoryAuditService';

describe('centralizeInventoryAuditWarehouses', () => {
  it('collapses legacy warehouse quantities into one centralized count', () => {
    expect(centralizeInventoryAuditWarehouses([
      {
        warehouse: 'WH1',
        stock: 3,
        location: 'Rack A',
        physical_count: 2,
        discrepancy: -1,
        remarks: 'First count',
        adjustment_item_id: 10,
      },
      {
        warehouse: 'WH2',
        stock: 4,
        location: 'Rack B',
        physical_count: 5,
        discrepancy: 1,
        remarks: 'Second count',
        adjustment_item_id: 11,
      },
    ])).toEqual([{
      warehouse: 'CENTRALIZED',
      stock: 7,
      location: 'Rack A, Rack B',
      physicalCount: 7,
      discrepancy: 0,
      remarks: 'First count; Second count',
      adjustmentItemId: null,
    }]);
  });

  it('does not treat a partially entered physical count as complete', () => {
    const [centralized] = centralizeInventoryAuditWarehouses([
      { warehouse: 'WH1', stock: 3, physical_count: 2, discrepancy: -1 },
      { warehouse: 'WH2', stock: 4, physical_count: null, discrepancy: null },
    ]);

    expect(centralized.stock).toBe(7);
    expect(centralized.physicalCount).toBeNull();
    expect(centralized.discrepancy).toBeNull();
  });
});
