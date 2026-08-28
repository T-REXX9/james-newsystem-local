import { afterEach, describe, expect, it, vi } from 'vitest';
import { deleteSalesOrder } from '../salesOrderService';

vi.mock('../localAuthService', () => ({ getLocalAuthSession: () => null }));
afterEach(() => vi.unstubAllGlobals());
describe('salesOrderService local deletion', () => {
  it('deletes via the API instead of writing legacy recycle-bin tables', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, data: { success: true } })));
    vi.stubGlobal('fetch', fetchMock);
    expect(await deleteSalesOrder('SO/123')).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/sales-orders/SO%2F123?'), expect.objectContaining({ method: 'DELETE' }));
  });
  it('does not report deletion when the API rejects it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: false, error: 'Order is posted' }), { status: 409 })));
    await expect(deleteSalesOrder('SO1')).rejects.toThrow('Order is posted');
  });
});
