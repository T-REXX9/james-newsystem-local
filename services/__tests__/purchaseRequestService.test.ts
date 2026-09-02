import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../localAuthService', () => ({
  getLocalAuthSession: () => ({
    token: 'test-bearer-token',
    context: {
      user: { id: 9 },
    },
  }),
}));

const okResponse = (data: any) =>
  Promise.resolve({
    ok: true,
    json: async () => ({ ok: true, data }),
  } as Response);

describe('purchaseRequestService (local API)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('createPurchaseRequest posts auth user context and maps returned detail', async () => {
    (global.fetch as any).mockImplementation(() =>
      okResponse({
        request: {
          refno: 'PRREF-1',
          pr_number: 'PR-2601',
          request_date: '2026-03-26',
          notes: 'test',
          status: 'Pending',
        },
        items: [
          {
            id: 5,
            item_id: 'prod-1',
            part_number: 'PART-001',
            description: 'Widget Alpha',
            quantity: 2,
          },
        ],
      })
    );

    const { purchaseRequestService } = await import('../purchaseRequestService');
    const created = await purchaseRequestService.createPurchaseRequest({
      pr_number: 'PR-2601',
      request_date: '2026-03-26',
      items: [{ item_id: 'prod-1', quantity: 2 }],
    } as any);

    expect(created.id).toBe('PRREF-1');
    expect(created.items).toHaveLength(1);
    const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(body.user_id).toBe(9);
  });

  it('deletePRItem calls the delete endpoint', async () => {
    (global.fetch as any).mockImplementation(() => okResponse({}));
    const { purchaseRequestService } = await import('../purchaseRequestService');

    await purchaseRequestService.deletePRItem('44');

    expect((global.fetch as any).mock.calls[0][0]).toContain('/purchase-request-items/44');
    expect((global.fetch as any).mock.calls[0][1].method).toBe('DELETE');
  });

  it('convertToPO posts to the convert-po action endpoint and returns the po refno', async () => {
    (global.fetch as any).mockImplementation(() =>
      okResponse({
        conversion: {
          po_refno: 'POREF-9',
          po_number: 'PO-2601',
        },
      })
    );

    const { purchaseRequestService } = await import('../purchaseRequestService');
    const result = await purchaseRequestService.convertToPO(['PRREF-9'], 'approver-1', { supplierId: 'SUP-1' });

    expect(result).toBe('POREF-9');
    expect((global.fetch as any).mock.calls[0][0]).toContain('/purchase-requests/PRREF-9/actions/convert-po');
    const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(body.user_id).toBe(9);
    expect(body.approver_id).toBe('approver-1');
    expect(body.supplier_id).toBe('SUP-1');
  });

  it('convertToPO attaches a Bearer token from the local auth session', async () => {
    (global.fetch as any).mockImplementation(() =>
      okResponse({ conversion: { po_refno: 'POREF-9', po_number: 'PO-2601' } })
    );
    const { purchaseRequestService } = await import('../purchaseRequestService');
    await purchaseRequestService.convertToPO(['PRREF-9'], 'approver-1');
    const headers = (global.fetch as any).mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-bearer-token');
  });

  it('createPurchaseRequest also attaches a Bearer token', async () => {
    (global.fetch as any).mockImplementation(() =>
      okResponse({
        request: { refno: 'PRREF-1', pr_number: 'PR-2601', request_date: '2026-03-26', notes: 'test', status: 'Pending', created_by: '', created_by_name: '', request_datetime: '2026-03-26 10:00:00', items: [] },
      })
    );
    const { purchaseRequestService } = await import('../purchaseRequestService');
    await purchaseRequestService.createPurchaseRequest({
      pr_number: 'PR-2601',
      request_date: '2026-03-26',
      items: [],
    } as any);
    const headers = (global.fetch as any).mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-bearer-token');
  });

    it('generatePRNumber reads the next-number endpoint', async () => {
    (global.fetch as any).mockImplementation(() => okResponse({ pr_number: 'PR-2602' }));
    const { purchaseRequestService } = await import('../purchaseRequestService');
    await expect(purchaseRequestService.generatePRNumber()).resolves.toBe('PR-2602');
    expect((global.fetch as any).mock.calls[0][0]).toContain('/purchase-requests/next-number');
  });

  it('lists purchase requests with filters and maps summary totals', async () => {
    (global.fetch as any).mockImplementation(() => okResponse({
      items: [{ refno: 'PRREF-2', pr_number: 'PR-2602', request_date: '2026-03-27', status: 'Approved', item_count: 2, total_qty: 5, total_cost: 125 }],
    }));
    const { purchaseRequestService } = await import('../purchaseRequestService');
    const rows = await purchaseRequestService.getPurchaseRequests({ month: 3, year: 2026, status: 'Approved', search: 'PR-2602' });
    expect(rows[0]).toMatchObject({ id: 'PRREF-2', pr_number: 'PR-2602', status: 'Approved', item_count: 2, total_qty: 5, total_cost: 125 });
    expect(String((global.fetch as any).mock.calls[0][0])).toContain('month=3');
    expect(String((global.fetch as any).mock.calls[0][0])).toContain('status=Approved');
  });

  it('requests PRs eligible for PO creation, including submitted requests for purchasing managers', async () => {
    (global.fetch as any).mockImplementation(() => okResponse({ items: [] }));
    const { purchaseRequestService } = await import('../purchaseRequestService');
    await purchaseRequestService.getPurchaseRequests({ availableForPO: true, includeSubmitted: true });
    const url = String((global.fetch as any).mock.calls[0][0]);
    expect(url).toContain('available_for_po=1');
    expect(url).toContain('include_submitted=1');
  });

  it('loads a purchase-request detail and normalizes item metadata', async () => {
    (global.fetch as any).mockImplementation(() => okResponse({
      request: { refno: 'PRREF-3', pr_number: 'PR-2603', request_date: '2026-03-28', status: 'Pending' },
      items: [{ id: 8, item_id: 'P8', item_code: 'I8', part_number: 'PART-8', description: 'Part 8', quantity: '3', unit_cost: '12.5', eta_date: '2026-04-01', sr_cases: 1, ir_cases: 0, po_refno: 'POREF-8', po_number: 'PO-2608' }],
    }));
    const { purchaseRequestService } = await import('../purchaseRequestService');
    const detail = await purchaseRequestService.getPurchaseRequestById('PRREF-3');
    expect(detail.items[0]).toMatchObject({ id: '8', quantity: 3, unit_cost: 12.5, eta_date: '2026-04-01', recommendation: 'Review Supplier', po_refno: 'POREF-8', po_number: 'PO-2608' });
  });

  it('updates and deletes a purchase request', async () => {
    (global.fetch as any)
      .mockImplementationOnce(() => okResponse({ request: { refno: 'PRREF-4' }, items: [] }))
      .mockImplementationOnce(() => okResponse({}));
    const { purchaseRequestService } = await import('../purchaseRequestService');
    await expect(purchaseRequestService.updatePurchaseRequest('PRREF-4', { status: 'Approved', notes: 'approved' } as any)).resolves.toBeUndefined();
    await expect(purchaseRequestService.deletePurchaseRequest('PRREF-4', 'Duplicate request')).resolves.toBeUndefined();
    expect((global.fetch as any).mock.calls[0][1].method).toBe('PATCH');
    expect((global.fetch as any).mock.calls[1][1].method).toBe('DELETE');
  });

  it('adds, updates, and deletes purchase-request items', async () => {
    (global.fetch as any)
      .mockImplementationOnce(() => okResponse({}))
      .mockImplementationOnce(() => okResponse({}))
      .mockImplementationOnce(() => okResponse({}));
    const { purchaseRequestService } = await import('../purchaseRequestService');
    await expect(purchaseRequestService.addPRItem('PRREF-5', { item_id: 'P5', quantity: 2 } as any)).resolves.toBeUndefined();
    await expect(purchaseRequestService.updatePRItem('55', { quantity: 3, unit_cost: 10, eta_date: '2026-04-02' })).resolves.toBeUndefined();
    await expect(purchaseRequestService.deletePRItem('55')).resolves.toBeUndefined();
    expect((global.fetch as any).mock.calls.map((call: any[]) => call[1].method)).toEqual(['POST', 'PATCH', 'DELETE']);
  });

  it('loads suppliers and paginated products for purchase requests', async () => {
    (global.fetch as any)
      .mockImplementationOnce(() => okResponse([{ id: 2, name: 'Supplier 2' }]))
      .mockImplementationOnce(() => okResponse({ items: [{ id: 'P6', item_code: 'I6', part_no: 'PART-6', description: 'Part 6', cost: 9, total_stock: 14 }], meta: { total_pages: 2 } }))
      .mockImplementationOnce(() => okResponse({ items: [{ id: 'P7', item_code: 'I7', part_no: 'PART-7', description: 'Part 7', cost: 11, total_stock: 4 }], meta: { total_pages: 2 } }));
    const { purchaseRequestService } = await import('../purchaseRequestService');
    await expect(purchaseRequestService.getSuppliers()).resolves.toMatchObject([{ id: '2', company: 'Supplier 2' }]);
    await expect(purchaseRequestService.getProducts()).resolves.toMatchObject([{ id: 'P6', part_number: 'PART-6', quantity: 14 }, { id: 'P7', part_number: 'PART-7', quantity: 4 }]);
  });

  it('returns zero supplier item cost when no matching request exists', async () => {
    (global.fetch as any).mockImplementation(() => okResponse({ items: [] }));
    const { purchaseRequestService } = await import('../purchaseRequestService');
    await expect(purchaseRequestService.getSupplierItemCost('SUP-NONE', 'P-NONE')).resolves.toBe(0);
  });

  it('rejects conversion when no purchase request is selected', async () => {
    const { purchaseRequestService } = await import('../purchaseRequestService');
    await expect(purchaseRequestService.convertToPO([], '')).rejects.toThrow('No purchase request selected');
  });
});
