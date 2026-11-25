import { afterEach, describe, expect, it, vi } from 'vitest';
import { recalculateSalesOrderVipDiscount } from '../salesOrderLocalApiService';

vi.mock('../localAuthService', () => ({ getLocalAuthSession: () => null }));
afterEach(() => vi.unstubAllGlobals());

describe('sales order VIP recalculation request', () => {
  it('posts to the protected action and maps the recalculated order discount', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, data: {
      order: {
        sales_refno: 'SO-1',
        sales_no: 'SO-1',
        inquiry_refno: 'INQ-1',
        status: 'Submitted',
        sales_date: '2026-11-01',
      },
      items: [],
      summary: {
        grand_total: 1000,
        vip_applied: 1,
        vip_tier: 'silver',
        vip_percentage: 10,
        vip_discount_amount: 100,
        total_to_pay: 900,
      },
    } })));
    vi.stubGlobal('fetch', fetchMock);

    await expect(recalculateSalesOrderVipDiscount('SO/1')).resolves.toMatchObject({
      id: 'SO-1',
      vip_applied: true,
      vip_tier: 'silver',
      vip_percentage: 10,
      vip_discount_amount: 100,
      total_to_pay: 900,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/sales-orders/SO%2F1/actions/recalculate-vip'),
      expect.objectContaining({ method: 'POST' })
    );
  });
});
