import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../localAuthService', () => ({
  getLocalAuthSession: () => ({ context: { user: { id: 7 } } }),
}));

describe('purchase order recovery', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: { order: { refno: 'po-ref', po_number: 'PO-2601', status: 'Unposted' }, items: [], summary: {} } }),
    }));
  });

  it('uses the controlled unpost action with the acting user', async () => {
    const { purchaseOrderService } = await import('../purchaseOrderService');
    await purchaseOrderService.unpostPurchaseOrder('po-ref', 'Correction required');
    const [url, init] = (global.fetch as any).mock.calls[0];
    expect(String(url)).toContain('/purchase-orders/po-ref/actions/unpost');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toMatchObject({ main_id: 1, user_id: 7 });
  });
});
