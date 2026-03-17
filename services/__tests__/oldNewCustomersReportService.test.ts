import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../localAuthService', () => ({
  getLocalAuthSession: () => ({
    context: {
      user: { main_userid: 7 },
    },
  }),
}));

describe('oldNewCustomersReportService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('builds the expected local API request and maps the payload', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          items: [
            {
              id: 'cust-1',
              customer_name: 'Alpha Diesel',
              customer_code: 'ALP-1',
              customer_group: 'Dealer',
              sales_person: 'Jane Doe',
              customer_since: '2024-01-20',
              customer_type: 'old',
            },
          ],
          summary: {
            old_count: 10,
            new_count: 5,
            total_count: 15,
            cutoff_years: 1,
            cutoff_date: '2025-03-17',
          },
          meta: {
            page: 2,
            per_page: 50,
            total: 15,
            total_pages: 1,
            status: 'old',
            search: 'alpha',
          },
        },
      }),
    } as Response);

    const { fetchOldNewCustomersReport } = await import('../oldNewCustomersReportService');
    const result = await fetchOldNewCustomersReport({
      status: 'old',
      search: 'alpha',
      page: 2,
      perPage: 50,
    });

    expect((global.fetch as any).mock.calls[0][0]).toContain('/old-new-customers-report?');
    expect((global.fetch as any).mock.calls[0][0]).toContain('main_id=7');
    expect((global.fetch as any).mock.calls[0][0]).toContain('status=old');
    expect((global.fetch as any).mock.calls[0][0]).toContain('search=alpha');
    expect((global.fetch as any).mock.calls[0][0]).toContain('page=2');
    expect((global.fetch as any).mock.calls[0][0]).toContain('per_page=50');

    expect(result.items[0]).toMatchObject({
      id: 'cust-1',
      customerName: 'Alpha Diesel',
      customerCode: 'ALP-1',
      customerGroup: 'Dealer',
      salesPerson: 'Jane Doe',
      customerSince: '2024-01-20',
      customerType: 'old',
    });
    expect(result.summary).toMatchObject({ oldCount: 10, newCount: 5, totalCount: 15 });
    expect(result.meta).toMatchObject({ page: 2, perPage: 50, status: 'old', search: 'alpha' });
  });
});
