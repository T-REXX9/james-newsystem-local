import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../localAuthService', () => ({
  getLocalAuthSession: () => ({
    context: {
      user: { id: 7 },
    },
  }),
}));

const okResponse = (data: any) =>
  Promise.resolve({
    ok: true,
    json: async () => ({ ok: true, data }),
  } as Response);

const errorResponse = (status: number, error: string) =>
  Promise.resolve({
    ok: false,
    status,
    json: async () => ({ ok: false, error }),
  } as Response);

describe('purchaseOrderService (local API)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('getPurchaseOrders maps API list payload', async () => {
    (global.fetch as any).mockImplementation(() =>
      okResponse({
        items: [
          {
            refno: 'POREF1',
            po_number: 'PO-001',
            order_date: '2026-02-18',
            supplier_id: 'SUP1',
            supplier_name: 'Supplier 1',
            status: 'Pending',
            total_cogs: 1000,
          },
        ],
      })
    );

    const { purchaseOrderService } = await import('../purchaseOrderService');
    const rows = await purchaseOrderService.getPurchaseOrders({ month: 2, year: 2026 });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('POREF1');
    expect(rows[0].po_number).toBe('PO-001');
    expect(rows[0].grand_total).toBe(1000);
  });

  it('createPurchaseOrder posts with auth user context', async () => {
    (global.fetch as any).mockImplementation(() =>
      okResponse({
        order: {
          refno: 'POREF2',
          po_number: 'PO-002',
          order_date: '2026-02-18',
          supplier_id: 'SUP2',
          status: 'Draft',
        },
      })
    );

    const { purchaseOrderService } = await import('../purchaseOrderService');
    const created = await purchaseOrderService.createPurchaseOrder({
      po_number: 'PO-002',
      supplier_id: 'SUP2',
      order_date: '2026-02-18',
      remarks: 'test',
      status: 'Draft',
    } as any);

    expect(created.id).toBe('POREF2');
    expect((global.fetch as any).mock.calls[0][0]).toContain('/purchase-orders');
    const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(body.user_id).toBe(7);
  });

  it('getPurchaseOrderById maps order + items details', async () => {
    (global.fetch as any).mockImplementation(() =>
      okResponse({
        order: {
          refno: 'POREF3',
          po_number: 'PO-003',
          supplier_id: 'SUP3',
          supplier_name: 'Supplier 3',
          order_date: '2026-02-18',
          status: 'Pending',
        },
        items: [
          {
            id: 11,
            po_refno: 'POREF3',
            product_session: 'P1',
            qty: 5,
            supplier_price: 99,
            line_total: 495,
            description: 'Item',
          },
        ],
        summary: { total_cogs: 495 },
      })
    );

    const { purchaseOrderService } = await import('../purchaseOrderService');
    const detail = await purchaseOrderService.getPurchaseOrderById('POREF3');
    expect(detail.id).toBe('POREF3');
    expect(detail.items).toHaveLength(1);
    expect(detail.items[0].qty).toBe(5);
    expect(detail.grand_total).toBe(495);
  });

  it('updatePurchaseOrder throws parsed API error', async () => {
    (global.fetch as any).mockImplementation(() => errorResponse(422, 'Purchase order not found'));
    const { purchaseOrderService } = await import('../purchaseOrderService');
    await expect(
      purchaseOrderService.updatePurchaseOrder('MISSING', { status: 'Cancelled' } as any)
    ).rejects.toThrow('Purchase order not found');
  });

  it('deletePurchaseOrder calls DELETE endpoint', async () => {
    (global.fetch as any).mockImplementation(() => okResponse({}));
    const { purchaseOrderService } = await import('../purchaseOrderService');
    await purchaseOrderService.deletePurchaseOrder('PODEL');
    const [, init] = (global.fetch as any).mock.calls[0];
    expect(init.method).toBe('DELETE');
  });
});

