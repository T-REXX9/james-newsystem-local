import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFromInquiry } from '../salesOrderService';

vi.mock('../localAuthService', () => ({ getLocalAuthSession: () => ({ userProfile: { id: '9' }, context: { main_userid: 7 } }) }));
const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => vi.unstubAllGlobals());
describe('Sales Inquiry to Sales Order local request contract', () => {
  it('delegates conversion to the transactional server action', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, data: { order: { sales_refno: 'SO1' }, items: [] } })));
    await createFromInquiry('INQ/1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/sales-inquiries/INQ%2F1/actions/convert-to-order'), expect.objectContaining({ method: 'POST' }));
  });
  it.each(['Inquiry must be approved before conversion', 'Missing product reference'])('preserves server validation: %s', async message => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: false, error: message }), { status: 422 }));
    await expect(createFromInquiry('INQ1')).rejects.toThrow(message);
  });
});
