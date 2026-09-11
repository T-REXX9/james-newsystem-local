import { afterEach, describe, expect, it, vi } from 'vitest';
import { purchaseHistoryReportService } from '../purchaseHistoryReportService';

vi.mock('../localAuthService', () => ({
  getLocalAuthSession: () => ({
    token: 'test-token',
    context: { user: { main_id: 1 } },
  }),
}));

describe('purchaseHistoryReportService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not impose date bounds when all history is requested', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, data: { items: [], pagination: { page: 1, per_page: 50, has_more: false } } }),
    } as Response);

    await purchaseHistoryReportService.getReport({ customerId: 'customer-1', dateType: 'all' });

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]), 'http://localhost');
    expect(url.searchParams.has('date_from')).toBe(false);
    expect(url.searchParams.has('date_to')).toBe(false);
  });
});
