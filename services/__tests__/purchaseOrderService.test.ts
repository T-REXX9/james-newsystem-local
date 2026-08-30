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
    const fetchMock = (global as any).fetch;
    if (fetchMock && typeof fetchMock.mockReset === 'function') {
      fetchMock.mockReset();
    } else {
      (global as any).fetch = vi.fn();
    }
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
            item_count: 5,
            total_qty: 40,
            first_eta_date: '2026-02-20',
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
    expect(rows[0].item_count).toBe(5);
    expect(rows[0].total_qty).toBe(40);
    expect(rows[0].first_eta_date).toBe('2026-02-20');
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
    await purchaseOrderService.deletePurchaseOrder('PODEL', 'Duplicate purchase order');
    const [, init] = (global.fetch as any).mock.calls[0];
    expect(init.method).toBe('DELETE');
  });

  it('loads only active products for new purchase-order item choices', async () => {
    (global.fetch as any).mockImplementation(() =>
      okResponse({ items: [], meta: { page: 1, total_pages: 1 } })
    );

    const { purchaseOrderService } = await import('../purchaseOrderService');
    await purchaseOrderService.getProducts();

    expect(String((global.fetch as any).mock.calls[0][0])).toContain('status=active');
  });


  it('updates a purchase order and maps the refreshed record', async () => {
    (global.fetch as any).mockImplementation(() => okResponse({
      order: { refno: 'POREF4', po_number: 'PO-004', order_date: '2026-02-19', supplier_id: 'SUP4', status: 'Posted' },
      summary: { total_cogs: 250 },
    }));
    const { purchaseOrderService } = await import('../purchaseOrderService');
    const updated = await purchaseOrderService.updatePurchaseOrder('POREF4', {
      status: 'Posted', supplier_id: 'SUP4', order_date: '2026-02-19', remarks: 'updated',
    } as any);
    expect(updated).toMatchObject({ id: 'POREF4', status: 'Posted', grand_total: 250 });
    expect((global.fetch as any).mock.calls[0][1].method).toBe('PATCH');
  });

  it('unposts a purchase order through the guarded action endpoint', async () => {
    (global.fetch as any).mockImplementation(() => okResponse({
      order: { refno: 'POREF5', po_number: 'PO-005', status: 'Unposted' }, items: [], summary: {},
    }));
    const { purchaseOrderService } = await import('../purchaseOrderService');
    await expect(purchaseOrderService.unpostPurchaseOrder('POREF5', 'Correction required')).resolves.toMatchObject({ id: 'POREF5', status: 'Unposted' });
    expect(String((global.fetch as any).mock.calls[0][0])).toContain('/actions/unpost');
    expect(JSON.parse((global.fetch as any).mock.calls[0][1].body)).toMatchObject({ main_id: 1, user_id: 7 });
  });

  it('loads purchase-order items through the detail endpoint', async () => {
    (global.fetch as any).mockImplementation(() => okResponse({
      order: { refno: 'POREF6', po_number: 'PO-006', status: 'Pending' },
      items: [{ id: 21, product_session: 'P21', qty: 4, supplier_price: 12 }], summary: {},
    }));
    const { purchaseOrderService } = await import('../purchaseOrderService');
    await expect(purchaseOrderService.getPurchaseOrderItems('POREF6')).resolves.toHaveLength(1);
  });

  it('adds, updates, and deletes purchase-order items', async () => {
    (global.fetch as any)
      .mockImplementationOnce(() => okResponse({ id: 31, po_refno: 'POREF7', product_session: 'P31', qty: 2, supplier_price: 15 }))
      .mockImplementationOnce(() => okResponse({ id: 31, po_refno: 'POREF7', product_session: 'P31', qty: 3, supplier_price: 16 }))
      .mockImplementationOnce(() => okResponse({}));
    const { purchaseOrderService } = await import('../purchaseOrderService');
    await expect(purchaseOrderService.addPurchaseOrderItem({ po_id: 'POREF7', item_id: 'P31', qty: 2 } as any)).resolves.toMatchObject({ id: '31', qty: 2 });
    await expect(purchaseOrderService.updatePurchaseOrderItem('31', { qty: 3, unit_price: 16, eta_date: '2026-03-01' } as any)).resolves.toMatchObject({ id: '31', qty: 3, unit_price: 16 });
    await expect(purchaseOrderService.deletePurchaseOrderItem('31')).resolves.toBeUndefined();
    const calls = (globalThis as any).fetch.mock.calls;
    expect(calls).toHaveLength(3);
    expect(calls[0][1].method).toBe('POST');
    expect(calls[1][1].method).toBe('PATCH');
    expect(calls[2][1].method).toBe('DELETE');
  });

  it('rejects adding an item without a purchase-order reference', async () => {
    const { purchaseOrderService } = await import('../purchaseOrderService');
    await expect(purchaseOrderService.addPurchaseOrderItem({ item_id: 'P1', qty: 1 } as any)).rejects.toThrow('po_id is required');
    expect((global.fetch as any).mock.calls).toHaveLength(0);
  });

  it('loads suppliers and paginated active products', async () => {
    (global.fetch as any)
      .mockImplementationOnce(() => okResponse([{ id: 1, name: 'Supplier A', address: 'Address' }]))
      .mockImplementationOnce(() => okResponse({ items: [{ id: 1, part_no: 'P-1', description: 'Part', item_code: 'I-1', cost: 20 }], meta: { total_pages: 2 } }))
      .mockImplementationOnce(() => okResponse({ items: [{ id: 2, part_no: 'P-2', description: 'Part 2', item_code: 'I-2', cost: 25 }], meta: { total_pages: 2 } }));
    const { purchaseOrderService } = await import('../purchaseOrderService');
    await expect(purchaseOrderService.getSuppliers()).resolves.toMatchObject([{ id: '1', company: 'Supplier A' }]);
    await expect(purchaseOrderService.getProducts()).resolves.toMatchObject([
      { id: '1', part_no: 'P-1', cost: 20 }, { id: '2', part_no: 'P-2', cost: 25 },
    ]);
    expect((global.fetch as any).mock.calls[1][0]).toContain('/products');
    expect((global.fetch as any).mock.calls[1][0]).toContain('status=active');
  });

  it('generates a timestamped purchase-order number', async () => {
    const { purchaseOrderService } = await import('../purchaseOrderService');
    await expect(purchaseOrderService.generatePONumber()).resolves.toMatch(/^PO-\d{12}$/);
  });

  it('supports the legacy purchase-order helper wrappers', async () => {
    (global.fetch as any).mockImplementation(() => okResponse({
      order: { refno: 'POREF8', po_number: 'PO-008', status: 'Pending' }, items: [], summary: {},
    }));
    const service = await import('../purchaseOrderService');
    await expect(service.getPurchaseOrder('POREF8')).resolves.toMatchObject({ id: 'POREF8' });
    await expect(service.updatePurchaseOrder('POREF8', { status: 'Pending' } as any)).resolves.toMatchObject({ id: 'POREF8' });
  });

  it('returns null from getPurchaseOrder when the API lookup fails', async () => {
    (global.fetch as any).mockImplementation(() => errorResponse(404, 'missing'));
    const { getPurchaseOrder } = await import('../purchaseOrderService');
    await expect(getPurchaseOrder('MISSING')).resolves.toBeNull();
  });

  it('supports all exported purchase-order compatibility wrappers', async () => {
    (global.fetch as any)
      .mockImplementationOnce(() => okResponse({ items: [] }))
      .mockImplementationOnce(() => okResponse({ order: { refno: 'POREF9', po_number: 'PO-009', status: 'Pending' } }))
      .mockImplementationOnce(() => okResponse({ order: { refno: 'POREF9', po_number: 'PO-009', status: 'Pending' } }))
      .mockImplementationOnce(() => okResponse({ order: { refno: 'POREF9', po_number: 'PO-009', status: 'Posted' }, items: [], summary: {} }))
      .mockImplementationOnce(() => okResponse({ order: { refno: 'POREF9', po_number: 'PO-009', status: 'Posted' }, items: [], summary: {} }));
    const service = await import('../purchaseOrderService');
    await expect(service.getAllPurchaseOrders()).resolves.toEqual([]);
    await expect(service.createPurchaseOrder({ po_number: 'PO-009', supplier_id: 'SUP9', order_date: '2026-08-23' } as any)).resolves.toMatchObject({ id: 'POREF9' });
    await expect(service.updatePurchaseOrder('POREF9', { status: 'Pending' } as any)).resolves.toMatchObject({ id: 'POREF9' });
    await expect(service.markAsDelivered('POREF9')).resolves.toMatchObject({ id: 'POREF9', status: 'Posted' });
    expect((global.fetch as any).mock.calls.length).toBe(5);
  });
});
