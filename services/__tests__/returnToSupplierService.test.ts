import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../localAuthService', () => ({
  getLocalAuthSession: () => ({ context: { user: { id: 7 } } }),
}));

describe('returnToSupplierService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: { record: { refno: 'rs-ref', return_no: 'RS26-1' }, summary: {} } }),
    }));
  });

  it('creates the return against centralized inventory and preserves the received item reference', async () => {
    const { returnToSupplierService } = await import('../returnToSupplierService');
    await returnToSupplierService.createReturn({
      return_date: '2026-08-16',
      return_type: 'purchase',
      rr_id: 'rr-ref',
      rr_no: 'RR-2601',
      supplier_id: 'supplier-ref',
      supplier_name: 'Supplier',
      po_no: 'PO-2601',
      remarks: 'Defective',
      items: [{
        rr_item_id: 'inventory-session',
        item_id: 'item-id',
        item_code: 'ITEM-1',
        part_no: 'PART-1',
        description: 'Part',
        qty_returned: 2,
        unit_cost: 10,
        total_amount: 20,
        return_reason: 'Defective',
      }],
    });

    const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(body).toMatchObject({ warehouse: 'CENTRALIZED', rr_refno: 'rr-ref' });
    expect(body.items[0]).toMatchObject({ inv_refno: 'inventory-session', qty_returned: 2 });
  });

  it('posts the return through the stock-affecting action', async () => {
    const { returnToSupplierService } = await import('../returnToSupplierService');
    await returnToSupplierService.finalizeReturn('rs-ref');
    expect(String((global.fetch as any).mock.calls[0][0])).toContain('/return-to-suppliers/rs-ref/actions/post');
    expect((global.fetch as any).mock.calls[0][1].method).toBe('POST');
  });
});
