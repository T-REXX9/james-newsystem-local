import { afterEach, describe, expect, it, vi } from 'vitest';
import { purchaseHistoryReportService } from '../purchaseHistoryReportService';
import { statementOfAccountService } from '../statementOfAccountService';

vi.mock('../localAuthService', () => ({
  getLocalAuthSession: () => ({
    token: 'test-token',
    context: { user: { main_id: 1 }, user_type: '2' },
  }),
}));

const okResponse = (data: unknown) => ({
  ok: true,
  json: () => Promise.resolve({ ok: true, data }),
} as Response);

describe('Accounting customer picker authentication', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('authenticates Statement of Account customer searches', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(okResponse({ items: [] }));

    await statementOfAccountService.getCustomers('cm');

    const [url, init] = fetchMock.mock.calls[0] || [];
    expect(url).toEqual(expect.stringContaining('/statements/customers?'));
    expect(url).toEqual(expect.stringContaining('search=cm'));
    expect(new Headers((init as RequestInit)?.headers).get('Authorization')).toBe('Bearer test-token');
  });

  it('authenticates Purchase History customer searches', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(okResponse({ items: [] }));

    await purchaseHistoryReportService.getCustomers('cm');

    const [url, init] = fetchMock.mock.calls[0] || [];
    expect(url).toEqual(expect.stringContaining('/customer-database?'));
    expect(url).toEqual(expect.stringContaining('search=cm'));
    expect(new Headers((init as RequestInit)?.headers).get('Authorization')).toBe('Bearer test-token');
  });
});
