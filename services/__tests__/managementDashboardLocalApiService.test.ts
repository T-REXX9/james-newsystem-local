import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildManagementDashboardData, fetchManagementDashboardData } from '../managementDashboardLocalApiService';

describe('management dashboard local API transformation', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('builds current and previous month performance without Supabase', () => {
    const result = buildManagementDashboardData({
      contacts: [{ id: 'c1', salesman: '7', city: 'CEBU', status: 'active', balance: 50 }],
      profiles: [{ id: '7', full_name: 'James' }],
      purchases: [
        { contact_id: 'c1', purchase_date: '2026-08-02', total_amount: 100 },
        { contact_id: 'c1', purchase_date: '2026-07-02', total_amount: 40 },
      ],
      inquiries: [{ contact_id: 'c1' }, { contact_id: 'c1' }, { contact_id: 'c1' }, { contact_id: 'c1' }],
    }, 2026, 8, 30, 2);

    expect(result.team[0]).toMatchObject({
      salesPersonName: 'James',
      currentMonthSales: 100,
      previousMonthSales: 40,
      customerCount: 1,
      salesChange: 60,
    });
    expect(result.city[0].city).toBe('CEBU');
    expect(result.status[0].status).toBe('Active');
    expect(result.inquiryOnly[0]).toMatchObject({ totalInquiries: 4, totalPurchases: 2, inquiryToPurchaseRatio: '2.00' });
  });

  it('keeps backend monthly sales aligned to the correct calendar month', async () => {
    window.localStorage.setItem('local_api_auth_session', JSON.stringify({
      token: 'test-token',
      context: { user: { id: 1 } },
    }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      data: {
        year: 2025,
        month: 10,
        kpis: { total_sales_ytd: 125000, total_collections_ytd: 25000 },
        monthly_sales: Array.from({ length: 12 }, (_, index) => ({
          month: index + 1,
          sales: index === 8 ? 125000 : 0,
          collections: index === 9 ? 25000 : 0,
        })),
      },
    }), { status: 200 })));

    const result = await fetchManagementDashboardData(1, 2025, 10);

    expect(result.monthlySales).toHaveLength(12);
    expect(result.monthlySales[8]).toEqual({ month: 9, sales: 125000, collections: 0 });
    expect(result.monthlySales[9]).toEqual({ month: 10, sales: 0, collections: 25000 });
    expect(result.kpis.totalSalesYtd).toBe(125000);
  });
});
