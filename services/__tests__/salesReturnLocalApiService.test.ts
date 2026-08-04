import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { salesReturnService } from '../salesReturnLocalApiService';

const okResponse = (data: unknown) =>
  Promise.resolve({
    ok: true,
    json: async () => ({ ok: true, data }),
  } as Response);

describe('salesReturnLocalApiService source documents', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('searches the dedicated historical source-document endpoint', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(() => okResponse({
      items: [{
        id: '200807081917831971',
        doc_no: 'D24116',
        type: 'OR',
        contact_id: '82481553820200807132657',
        customer_name: 'Customer',
        sales_person: 'Agent',
        sales_date: '2020-02-24',
        status: 'Posted',
        grand_total: '1800.00',
        item_count: '1',
      }],
    }));

    const result = await salesReturnService.sourceDocuments(' D24116 ', 50);

    expect(result).toEqual([expect.objectContaining({
      id: '200807081917831971',
      doc_no: 'D24116',
      type: 'OR',
      grand_total: 1800,
      item_count: 1,
    })]);
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/sales-returns/source-documents?');
    expect(String(url)).toContain('search=D24116');
    expect(String(url)).toContain('limit=50');
  });

  it('returns an empty list when the API has no matches', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(() => okResponse({ items: [] }));

    await expect(salesReturnService.sourceDocuments('missing')).resolves.toEqual([]);
  });
});
