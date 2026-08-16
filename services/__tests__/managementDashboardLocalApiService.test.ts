import { describe, expect, it } from 'vitest';
import { buildManagementDashboardData } from '../managementDashboardLocalApiService';

describe('management dashboard local API transformation', () => {
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
});
