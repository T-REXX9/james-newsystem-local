import { beforeEach, describe, expect, it, vi } from 'vitest';

const createPurchaseRequest = vi.fn();
vi.mock('../purchaseRequestService', () => ({ purchaseRequestService: { createPurchaseRequest, getProducts: vi.fn().mockResolvedValue([]) } }));
vi.mock('../localAuthService', () => ({ getLocalAuthSession: () => ({ context: { user: { id: 7 } } }) }));

describe('suggested stock purchase request workflow', () => {
  beforeEach(() => {
    createPurchaseRequest.mockReset();
    createPurchaseRequest.mockResolvedValue({ id: 'pr-ref', pr_number: 'PR-2601', items: [] });
  });

  it('creates one PR containing every selected suggestion and source references', async () => {
    const { createPurchaseRequestFromSuggestions } = await import('../suggestedStockService');
    await createPurchaseRequestFromSuggestions([
      { id: 's1', partNo: 'P-1', itemCode: '', description: 'Part 1', brand: '', databaseItemId: 'product-1', databaseItemCode: '', databasePartNo: '', isListed: true, inquiryCount: 2, totalQty: 4, customerCount: 2, customers: [], remark: '', lastInquiryDate: '', isKiv: false, productCreated: true },
      { id: 's2', partNo: 'P-2', itemCode: '', description: 'Part 2', brand: '', databaseItemId: 'product-2', databaseItemCode: '', databasePartNo: '', isListed: true, inquiryCount: 1, totalQty: 3, customerCount: 1, customers: [], remark: '', lastInquiryDate: '', isKiv: false, productCreated: true },
    ]);

    expect(createPurchaseRequest).toHaveBeenCalledTimes(1);
    expect(createPurchaseRequest.mock.calls[0][0].items).toHaveLength(2);
    expect(createPurchaseRequest.mock.calls[0][0]).toMatchObject({
      reference_no: 'Suggested Stock:s1,s2',
      items: [{ part_number: 'P-1', quantity: 4 }, { part_number: 'P-2', quantity: 3 }],
    });
    expect(createPurchaseRequest.mock.calls[0][0].items).toMatchObject([
      { item_id: 'product-1' },
      { item_id: 'product-2' },
    ]);
  });

  it('does not create a PR until every selected suggestion has a matching product record', async () => {
    const { createPurchaseRequestFromSuggestions } = await import('../suggestedStockService');
    await expect(createPurchaseRequestFromSuggestions([
      { id: 'not-created', partNo: 'P-3', itemCode: '', description: 'Part 3', brand: '', databaseItemId: '', databaseItemCode: '', databasePartNo: '', isListed: false, inquiryCount: 1, totalQty: 1, customerCount: 1, customers: [], remark: '', lastInquiryDate: '', isKiv: false, productCreated: false },
    ])).rejects.toThrow('matching Product Created record');
    expect(createPurchaseRequest).not.toHaveBeenCalled();
  });

  it('does not create an empty PR', async () => {
    const { createPurchaseRequestFromSuggestions } = await import('../suggestedStockService');
    await expect(createPurchaseRequestFromSuggestions([])).rejects.toThrow('Select at least one suggested item');
    expect(createPurchaseRequest).not.toHaveBeenCalled();
  });
});
