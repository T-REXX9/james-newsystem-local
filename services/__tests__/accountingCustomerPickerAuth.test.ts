import { afterEach, describe, expect, it, vi } from 'vitest';
import { adjustmentEntryService } from '../adjustmentEntryService';
import { dailyCollectionService } from '../dailyCollectionService';
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

  it('requests every Statement of Account customer when the search is blank', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(okResponse({ items: [] }));

    await statementOfAccountService.getCustomers();

    const [url] = fetchMock.mock.calls[0] || [];
    expect(url).toEqual(expect.stringContaining('limit=0'));
  });

  it('authenticates Purchase History customer searches', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(okResponse({ items: [] }));

    await purchaseHistoryReportService.getCustomers('cm');

    const [url, init] = fetchMock.mock.calls[0] || [];
    expect(url).toEqual(expect.stringContaining('/customer-database?'));
    expect(url).toEqual(expect.stringContaining('search=cm'));
    expect(new Headers((init as RequestInit)?.headers).get('Authorization')).toBe('Bearer test-token');
  });

  it('requests every Purchase History customer when the search is blank', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(okResponse({ items: [] }));

    await purchaseHistoryReportService.getCustomers();

    const [url] = fetchMock.mock.calls[0] || [];
    expect(url).toEqual(expect.stringContaining('per_page=0'));
    expect(url).toEqual(expect.stringContaining('mode=picker'));
  });

  it('requests every Adjustment Entry and Daily Collection customer when their searches are blank', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(okResponse({ items: [] }));

    await adjustmentEntryService.getCustomers();
    await dailyCollectionService.getCustomers();

    const adjustmentUrl = String(fetchMock.mock.calls[0]?.[0] || '');
    const dailyCollectionUrl = String(fetchMock.mock.calls[1]?.[0] || '');
    expect(adjustmentUrl).toContain('per_page=0');
    expect(dailyCollectionUrl).toContain('per_page=0');
  });
});
