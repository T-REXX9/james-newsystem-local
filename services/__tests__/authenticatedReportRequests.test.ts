import { beforeEach, describe, expect, it, vi } from 'vitest';
import { freightChargesReportService } from '../freightChargesReportService';
import { fetchInventoryReportOptions } from '../inventoryReportService';
import { fetchSalesReturnReportOptions } from '../salesReturnReportService';

const session = {
  token: 'test-token',
  context: { main_userid: 1, user: { id: 1, main_userid: 1 } },
  userProfile: { id: '1' },
};

describe('report API authentication', () => {
  beforeEach(() => {
    window.localStorage.setItem('local_api_auth_session', JSON.stringify(session));
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ ok: true, data: {} }), { status: 200 }))
    ));
  });

  it('sends the bearer token on every report request', async () => {
    await freightChargesReportService.getReport({ dateType: 'Today' });
    await fetchInventoryReportOptions();
    await fetchSalesReturnReportOptions();

    for (const [, init] of vi.mocked(fetch).mock.calls) {
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer test-token');
    }
  });
});
