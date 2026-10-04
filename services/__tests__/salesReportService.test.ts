import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSalesReportData } from '../salesReportService';

describe('salesReportService legacy period request', () => {
  beforeEach(() => {
    window.localStorage.setItem('local_api_auth_session', JSON.stringify({
      token: 'test-token',
      context: { user: { main_id: 1 } },
    }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      data: {
        transactions: [],
        summary: {
          categoryTotals: [],
          salespersonTotals: [],
          grandTotal: { soAmount: 0, drAmount: 0, invoiceAmount: 0, total: 0 },
          productTotals: [],
        },
      },
    }), { status: 200 })));
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('passes the selected legacy period type to the API', async () => {
    await getSalesReportData({
      dateFrom: '2026-09-01',
      dateTo: '2026-09-30',
      customerId: 'all',
      dateType: 'month',
    });

    const [requestUrl] = vi.mocked(fetch).mock.calls[0];
    const url = new URL(String(requestUrl), 'http://localhost');
    expect(url.searchParams.get('date_type')).toBe('month');
    expect(url.searchParams.get('date_from')).toBe('2026-09-01');
    expect(url.searchParams.get('date_to')).toBe('2026-09-30');
  });

  it('maps product sales totals returned by the Sales Report API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      data: {
        transactions: [],
        summary: {
          categoryTotals: [],
          salespersonTotals: [],
          grandTotal: { soAmount: 0, drAmount: 250, invoiceAmount: 0, total: 250 },
          productTotals: [{ item_code: 'P-100', part_no: 'PART-100', brand: 'Top Brand', product: 'Top Product', total: 250 }],
        },
      },
    }), { status: 200 })));

    const report = await getSalesReportData({ dateFrom: '2026-10-01', dateTo: '2026-10-02', customerId: 'all' });

    expect(report.summary.productTotals).toEqual([{
      itemCode: 'P-100',
      partNo: 'PART-100',
      brand: 'Top Brand',
      product: 'Top Product',
      total: 250,
    }]);
  });

  it('preserves stable staff IDs on salesperson summary rows', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      data: {
        transactions: [],
        summary: {
          categoryTotals: [],
          salespersonTotals: [{ id: 'agent-42', salesperson: 'Taylor', categories: [], total: 0 }],
          grandTotal: { soAmount: 0, drAmount: 0, invoiceAmount: 0, total: 0 },
          productTotals: [],
        },
      },
    }), { status: 200 })));

    const report = await getSalesReportData({ dateFrom: '2026-10-01', dateTo: '2026-10-02', customerId: 'all' });

    expect(report.summary.salespersonTotals).toEqual([{
      id: 'agent-42',
      salesperson: 'Taylor',
      categories: [],
      total: 0,
    }]);
  });
});
