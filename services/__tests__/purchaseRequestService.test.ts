import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../localAuthService', () => ({
  getLocalAuthSession: () => ({
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
    const result = await purchaseRequestService.convertToPO(['PRREF-9'], 'approver-1');

    expect(result).toBe('POREF-9');
    expect((global.fetch as any).mock.calls[0][0]).toContain('/purchase-requests/PRREF-9/actions/convert-po');
    const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(body.user_id).toBe(9);
    expect(body.approver_id).toBe('approver-1');
  });

  it('generatePRNumber reads the next-number endpoint', async () => {
    (global.fetch as any).mockImplementation(() => okResponse({ pr_number: 'PR-2602' }));
    const { purchaseRequestService } = await import('../purchaseRequestService');

    await expect(purchaseRequestService.generatePRNumber()).resolves.toBe('PR-2602');
    expect((global.fetch as any).mock.calls[0][0]).toContain('/purchase-requests/next-number');
  });
});
