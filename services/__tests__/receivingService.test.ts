import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../localAuthService', () => ({
  getLocalAuthSession: () => ({ context: { user: { id: 7 } } }),
}));

const okResponse = (data: unknown) => Promise.resolve({
  ok: true,
  json: async () => ({ ok: true, data }),
} as Response);

describe('receivingService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('loads only active products for new receiving item choices', async () => {
    (global.fetch as any).mockImplementation(() =>
      okResponse({ items: [], meta: { page: 1, total_pages: 1 } })
    );

    const { receivingService } = await import('../receivingService');
    await receivingService.getProducts();

    expect(String((global.fetch as any).mock.calls[0][0])).toContain('status=active');
  });

  it('creates receiving from a PO reference and preserves each PO line reference', async () => {
    (global.fetch as any).mockImplementation(() => okResponse({
      record: { refno: 'rr-ref', rr_number: 'RR-2601', po_number: 'PO-2601' },
      items: [],
      summary: {},
    }));

    const { receivingService } = await import('../receivingService');
    await receivingService.createReceivingReportWithItems({
      receive_date: '2026-08-16',
      supplier_id: '9',
      supplier_name: 'Supplier',
      po_no: 'PO-2601',
      po_refno: 'po-ref',
      remarks: '',
      warehouse_id: 'CENTRALIZED',
    } as any, [{
      item_id: 'item-session',
      item_code: 'ITEM-1',
      part_no: 'PART-1',
      description: 'Part',
      qty_received: 3,
      unit_cost: 25,
      total_amount: 75,
      qty_ordered: 5,
      qty_returned: 0,
      po_item_id: 88,
    } as any]);

    const request = (global.fetch as any).mock.calls[0];
    const body = JSON.parse(request[1].body);
    expect(body.po_refno).toBe('po-ref');
    expect(body.items[0]).toMatchObject({ po_item_id: 88, qty: 3 });
  });

  it('enriches receiving detail with linked PO and item display fields', async () => {
    (global.fetch as any)
      .mockImplementationOnce(() => okResponse({
        record: {
          refno: 'rr-ref',
          rr_number: 'RR-2601',
          receive_date: '2026-08-16',
          po_refno: 'po-ref',
          po_number: 'PO-2601',
          status: 'Pending',
          supplier_id: '9',
          supplier_name: 'Supplier',
        },
        items: [{
          id: 17,
          product_session: 'item-session',
          item_code: 'ITEM-1',
          part_no: 'PART-1',
          original_part_no: 'OPN-1',
          description: 'Part',
          brand: 'Brand A',
          qty: 3,
          unit_cost: 25,
          line_total: 75,
          po_item_id: 88,
        }],
        summary: { item_count: 1, total_qty: 3, total_cost: 75 },
      }))
      .mockImplementationOnce(() => okResponse({
        order: {
          refno: 'po-ref',
          po_number: 'PO-2601',
          order_date: '2026-08-01',
          pr_number: 'PR-2601',
          status: 'Posted',
        },
        items: [{
          id: 88,
          product_session: 'item-session',
          qty: 5,
          eta_date: '2026-08-20',
          brand: 'Brand A',
          description: 'Part',
          part_no: 'PART-1',
          item_code: 'ITEM-1',
        }],
        summary: { total_cogs: 125 },
      }));

    const { receivingService } = await import('../receivingService');
    const detail = await receivingService.getReceivingReportById('rr-ref');

    expect(detail.po?.pr_reference).toBe('PR-2601');
    expect(detail.items[0]).toMatchObject({
      original_part_no: 'OPN-1',
      brand: 'Brand A',
      qty_ordered: 5,
      qty_received: 3,
    });
    expect(detail.eta_date).toBeNull();
    expect(detail.po?.items[0].eta_date).toBe('2026-08-20');
  });

  it('loads only server-approved posted POs with remaining lines', async () => {
    (global.fetch as any).mockImplementation(() => okResponse([{
      refno: 'po-ref', po_number: 'PO-2601', pr_number: 'PR-2601', supplier_id: '9',
      supplier_name: 'Supplier', order_date: '2026-08-01', remaining_line_count: 2,
    }]));

    const { receivingService } = await import('../receivingService');
    await expect(receivingService.getEligiblePurchaseOrders()).resolves.toEqual([{
      id: 'po-ref', poNumber: 'PO-2601', prNumber: 'PR-2601', supplierId: '9',
      supplierName: 'Supplier', orderDate: '2026-08-01', remainingLineCount: 2,
    }]);
    expect(String((global.fetch as any).mock.calls[0][0])).toContain('/receiving-stocks/purchase-orders/eligible');
  });

  it('lists receiving reports with normalized filters and totals', async () => {
    (global.fetch as any).mockImplementation(() => okResponse({ items: [{ refno: 'RRREF-2', rr_number: 'RR-2602', receive_date: '2026-08-17', po_number: 'PO-2602', status: 'Delivered', item_count: 2, total_qty: 9, total_cost: 100 }] }));
    const { receivingService } = await import('../receivingService');
    const rows = await receivingService.getReceivingReports({ month: 8, year: 2026, status: 'Posted', search: 'RR-2602' });
    expect(rows[0]).toMatchObject({ id: 'RRREF-2', rr_no: 'RR-2602', status: 'Posted', item_count: 2, total_qty: 9, grand_total: 100 });
    expect(String((global.fetch as any).mock.calls[0][0])).toContain('status=delivered');
  });

  it('creates a receiving report header with auth context', async () => {
    (global.fetch as any).mockImplementation(() => okResponse({ record: { refno: 'RRREF-3', rr_number: 'RR-2603', receive_date: '2026-08-18', po_number: 'PO-2603', status: 'Pending' } }));
    const { receivingService } = await import('../receivingService');
    await expect(receivingService.createReceivingReport({ rr_no: 'RR-2603', receive_date: '2026-08-18', supplier_id: '9', po_no: 'PO-2603', status: 'Draft' } as any)).resolves.toMatchObject({ id: 'RRREF-3', rr_no: 'RR-2603', status: 'Draft' });
    const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(body).toMatchObject({ main_id: 1, user_id: 7, status: 'Pending' });
  });

  it('updates, deletes, and finalizes receiving reports', async () => {
    (global.fetch as any)
      .mockImplementationOnce(() => okResponse({ record: { refno: 'RRREF-4', rr_number: 'RR-2604', status: 'Pending' }, items: [], summary: {} }))
      .mockImplementationOnce(() => okResponse({}))
      .mockImplementationOnce(() => okResponse({}));
    const { receivingService } = await import('../receivingService');
    await expect(receivingService.updateReceivingReport('RRREF-4', { status: 'Posted', receive_date: '2026-08-18', po_no: 'PO-2604' } as any)).resolves.toMatchObject({ id: 'RRREF-4', status: 'Draft' });
    await expect(receivingService.deleteReceivingReport('RRREF-4')).resolves.toBeUndefined();
    await expect(receivingService.finalizeReceivingReport('RRREF-4')).resolves.toBeUndefined();
    expect((global.fetch as any).mock.calls.map((call: any[]) => call[1]?.method)).toEqual(['PATCH', 'DELETE', 'POST']);
  });

  it('adds, updates, and deletes receiving report items', async () => {
    (global.fetch as any)
      .mockImplementationOnce(() => okResponse({ id: 41, receiving_refno: 'RRREF-5', product_session: 'P41', qty: 2, unit_cost: 20 }))
      .mockImplementationOnce(() => okResponse({ id: 41, receiving_refno: 'RRREF-5', product_session: 'P41', qty: 3, unit_cost: 21 }))
      .mockImplementationOnce(() => okResponse({}));
    const { receivingService } = await import('../receivingService');
    await expect(receivingService.addReceivingReportItem({ rr_id: 'RRREF-5', item_id: 'P41', qty_received: 2, unit_cost: 20 } as any)).resolves.toMatchObject({ id: '41', qty_received: 2 });
    await expect(receivingService.updateReceivingReportItem('41', { rr_id: 'RRREF-5', qty_received: 3, unit_cost: 21 } as any)).resolves.toMatchObject({ id: '41', qty_received: 3 });
    await expect(receivingService.deleteReceivingReportItem('41')).resolves.toBeUndefined();
    expect((global.fetch as any).mock.calls.map((call: any[]) => call[1]?.method)).toEqual(['POST', 'PATCH', 'DELETE']);
  });

  it('checks duplicate receiving numbers and generates a report number', async () => {
    (global.fetch as any).mockImplementation(() => okResponse({ items: [{ rr_number: 'RR-2606', refno: 'RRREF-6' }] }));
    const { receivingService } = await import('../receivingService');
    await expect(receivingService.checkDuplicateRR('RR-2606')).resolves.toBe(true);
    await expect(receivingService.checkDuplicateRR('')).resolves.toBe(false);
    await expect(receivingService.generateRRNumber()).resolves.toMatch(/^RR-\d{12}$/);
  });

  it('loads suppliers, linked PO details, and paginated products', async () => {
    (global.fetch as any)
      .mockImplementationOnce(() => okResponse([{ id: 3, name: 'Supplier 3' }]))
      .mockImplementationOnce(() => okResponse({ order: { refno: 'POREF-7', po_number: 'PO-2607', status: 'Posted' }, items: [], summary: {} }))
      .mockImplementationOnce(() => okResponse({ items: [{ id: 'P7', part_no: 'PART-7', description: 'Part 7', item_code: 'I7', brand: 'Brand' }], meta: { total_pages: 1 } }));
    const { receivingService } = await import('../receivingService');
    await expect(receivingService.getSuppliers()).resolves.toMatchObject([{ id: '3', company: 'Supplier 3' }]);
    await expect(receivingService.getEligiblePurchaseOrderDetails('POREF-7')).resolves.toMatchObject({ id: 'POREF-7', po_number: 'PO-2607' });
    await expect(receivingService.getProducts()).resolves.toMatchObject([{ id: 'P7', part_no: 'PART-7', brand: 'Brand' }]);
  });
});
