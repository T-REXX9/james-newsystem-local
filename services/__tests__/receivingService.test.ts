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
});
