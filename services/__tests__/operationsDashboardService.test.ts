import { describe, expect, it } from 'vitest';
import { buildOperationsDashboardSnapshot, resolveOperationsActivityLink } from '../operationsDashboardService';

describe('operations dashboard data mapping', () => {
  it('builds dashboard totals only from real source records', () => {
    const result = buildOperationsDashboardSnapshot({
      inquiries: [
        { sales_date: '2026-08-02', status: 'Pending' },
        { sales_date: '2026-08-03', status: 'Cancelled', is_deleted: true },
        { sales_date: '2026-07-02', status: 'Pending' },
      ],
      currentOrders: { items: [{ grand_total: 1000 }, { grand_total: 500 }] },
      previousOrders: { items: [{ grand_total: 800 }] },
      slips: { items: [
        { status: 'draft', tracking_no: '', remarks: '' },
        { status: 'finalized', tracking_no: 'LBC-1', remarks: 'Delivered' },
        { status: 'finalized', tracking_no: 'LBC-2', remarks: 'RTO - wrong address' },
      ] },
      returns: { items: [{ lstatus: 'Posted', lremark: 'Replacement sent' }] },
      currentCollections: { collection_totals: { cash: 500, check: 100, tt: 0, less: 50 } },
      previousCollections: { collection_totals: { cash: 400, check: 0, tt: 0, less: 0 } },
      todayCollections: { collection_totals: { cash: 200, check: 0, tt: 0, less: 0 } },
      receivables: { grand_total_balance: 300, customers: [{ rows: [{ date: '2026-08-01', balance: 300 }] }] },
      activities: { items: [] },
      owner: { callLogs: [{ occurred_at: '2026-08-02T09:00:00', direction: 'outbound', outcome: 'No Answer', duration_seconds: 60 }] },
    }, new Date('2026-08-02T12:00:00'));

    expect(result.orders).toMatchObject({ inquiries: 2, orders: 2, open: 1, cancelled: 1, previousInquiries: 1, previousOrders: 1 });
    expect(result.calls).toMatchObject({ outgoing: 1, unanswered: 1, averageResponseSeconds: 60 });
    expect(result.delivery).toMatchObject({ ready: 1, shipped: 2, delivered: 1, total: 3 });
    expect(result.lbcRto).toMatchObject({ total: 2, delivered: 1, rto: 1, wrongAddress: 1 });
    expect(result.returns).toMatchObject({ requests: 1, approved: 1, replacement: 1 });
    expect(result.collections).toMatchObject({ total: 550, sales: 1500, today: 200 });
    expect(result.receivables).toMatchObject({ total: 300, current: 300 });
  });

  it('links known activity references and leaves unknown entries non-clickable', () => {
    expect(resolveOperationsActivityLink({ lpage: 'Sales Inquiry', laction: 'Create', lrefno: 'INQ-1' } as any)).toEqual({
      route: 'sales-transaction-sales-inquiry', payload: { inquiryId: 'INQ-1' },
    });
    expect(resolveOperationsActivityLink({ lpage: 'Unknown', laction: 'Read', lrefno: 'ABC' } as any)).toEqual({});
  });
});
