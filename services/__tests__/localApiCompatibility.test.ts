import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchProfiles, fetchPersonalComments, createPersonalComment, bulkUpdateProducts } from '../localDataService';

vi.mock('../localAuthService', () => ({ getLocalAuthSession: () => ({ token: 'test-token', context: { main_userid: 7 } }) }));
const fetchMock = vi.fn();
const reply = (data: unknown, status = 200) => new Response(JSON.stringify({ ok: status === 200, data, ...(status === 200 ? {} : { error: 'Write rejected' }) }), { status });
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => vi.unstubAllGlobals());

describe('local API compatibility facade', () => {
  it('loads staff options from the local staff API', async () => {
    fetchMock.mockResolvedValue(reply({ items: [{ id: 2, first_name: 'Local', last_name: 'Agent' }], meta: { total_pages: 1 } }));
    expect(await fetchProfiles()).toHaveLength(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/staff?');
  });
  it('loads personal comments without mixing in management instructions', async () => {
    fetchMock.mockResolvedValue(reply([
      { id: 'c1', contact_id: 'shop', entry_type: 'Note', topic: 'Comment', status: 'Note', note: 'Saved comment', created_by_name: 'Owner' },
      { id: 'i1', contact_id: 'shop', entry_type: 'Note', topic: 'Comment', status: 'Management Instruction', note: 'Instruction' },
    ]));
    expect(await fetchPersonalComments('shop')).toEqual([expect.objectContaining({ id: 'c1', text: 'Saved comment', author_name: 'Owner' })]);
    expect(fetchMock.mock.calls[0][0]).toContain('/daily-call-monitoring/customers/shop/customer-logs');
  });
  it('persists comments through customer logs and propagates failures', async () => {
    fetchMock.mockResolvedValueOnce(reply({ id: 'c1' })).mockResolvedValueOnce(reply(null, 500));
    await createPersonalComment('shop', '1', 'Owner', 'Comment');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ contact_id: 'shop', entry_type: 'Note', topic: 'Comment', note: 'Comment' });
    await expect(createPersonalComment('shop', '1', 'Owner', 'Retry')).rejects.toThrow('Write rejected');
  });
  it('includes tenant context in product bulk updates', async () => {
    fetchMock.mockResolvedValue(reply({ updated: 1 }));
    await bulkUpdateProducts(['p1'], { price_bb: 10 });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ ids: ['p1'], updates: { price_bb: 10 }, main_id: 7 });
  });
});
