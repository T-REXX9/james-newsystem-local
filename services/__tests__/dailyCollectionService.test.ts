import { afterEach, describe, expect, it, vi } from 'vitest';
import { dailyCollectionService } from '../dailyCollectionService';

vi.mock('../localAuthService', () => ({
  getLocalAuthSession: () => ({ token: 'test-token', context: { user: { id: 1 } } }),
}));

const okResponse = (data: unknown) => ({
  ok: true,
  json: () => Promise.resolve({ ok: true, data }),
}) as Response;

describe('dailyCollectionService payment types', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('restores a legacy TT payment after saving it as Check with no check number', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(okResponse({
      items: [
        { lid: 1, ltype: 'Check', lchk_no: '', lamt: 150 },
        { lid: 2, ltype: 'Check', lchk_no: '123456', lamt: 200 },
      ],
    }));

    const items = await dailyCollectionService.getCollectionItems('DCR-1');

    expect(items[0]?.ltype).toBe('TT');
    expect(items[1]?.ltype).toBe('Check');
  });

  it('sends a selected customer when updating a payment line', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(okResponse({ item: null }));

    await dailyCollectionService.updateItem({
      lid: 1,
      lrefno: 'DCR-1',
      lcustomer: 'customer-1',
      lcustomer_fname: 'Original Customer',
      lcustomer_lname: '',
      ltype: 'Cash',
      lbank: '',
      lchk_no: '',
      lchk_date: '',
      lamt: 100,
      lstatus: 'Pending',
      lremarks: '',
      lcollect_date: '',
      created_at: '',
      lpost: 0,
      lcollection_status: 'Pending',
      ltransaction_no: '',
    }, {
      customerId: 'customer-2',
      type: 'Cash',
      bank: '',
      checkNo: '',
      checkDate: '',
      amount: 100,
      status: 'Pending',
      remarks: '',
      transactions: [{
        transaction_type: 'Invoice',
        transaction_refno: 'INV-REF-2',
        transaction_no: 'INV-2',
        transaction_amount: 200,
      }],
    });

    const [, request] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(request.body))).toMatchObject({
      customer_id: 'customer-2',
      transactions: [{ transaction_no: 'INV-2', transaction_refno: 'INV-REF-2' }],
    });
  });
});
