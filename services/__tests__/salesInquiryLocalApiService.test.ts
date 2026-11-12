import { afterEach, describe, expect, it, vi } from 'vitest';
import { confirmSalesInquiry, getSalesInquiry, getSalesInquiryPrintStatus, listSalesInquiryPrintRequests, recordSalesInquiryPrint, requestSalesInquiryReprint, reviewSalesInquiryPrintRequest } from '../salesInquiryLocalApiService';

afterEach(() => vi.unstubAllGlobals());

describe('salesInquiryLocalApiService', () => {
  it('uses the server confirmation timestamp as the inquiry creation timestamp', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      data: {
        inquiry_refno: 'INQ-1',
        sales_date: '2020-01-01',
        sales_time: '00:00:00',
        confirmed_at: '2026-09-25 09:31:00',
        status: 'Pending',
      },
    }))));

    await expect(getSalesInquiry('INQ-1')).resolves.toEqual(expect.objectContaining({
      created_at: '2026-09-25 09:31:00',
    }));
  });

  it('uses the print API endpoints to read status, record a print, and request a reprint', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ ok: true, data: { can_print: true, print_count: 0 } })));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getSalesInquiryPrintStatus('INQ-1')).resolves.toEqual({ can_print: true, print_count: 0 });
    await recordSalesInquiryPrint('INQ-1');
    await requestSalesInquiryReprint('INQ-1');

    expect(fetchMock.mock.calls.map(([url, init]) => [String(url), init?.method || 'GET'])).toEqual([
      ['/api/v1/sales-inquiries/INQ-1/print-status', 'GET'],
      ['/api/v1/sales-inquiries/INQ-1/print', 'POST'],
      ['/api/v1/sales-inquiries/INQ-1/print-request', 'POST'],
    ]);
  });

  it('keeps the customer agent and inquiry creator as separate values', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      data: {
        inquiry_refno: 'INQ-1',
        inquiry_no: 'INQ26-1',
        contact_id: 'customer-1',
        sales_person: 'Assigned Agent',
        sales_person_id: '42',
        created_by: '7',
        created_by_name: 'Inquiry Creator',
        sales_date: '2026-09-25',
        sales_time: '09:30:00',
        status: 'Pending',
      },
    }))));

    await expect(getSalesInquiry('INQ-1')).resolves.toEqual(expect.objectContaining({
      sales_person: 'Assigned Agent',
      created_by: '7',
      created_by_name: 'Inquiry Creator',
    }));
  });

  it('exposes master review endpoints for pending reprint requests', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, data: { items: [{ id: 9, inquiry_refno: '261112062925689417412663', inquiry_no: 'INQ26-1', requested_by: 4, requested_by_name: 'Staff A', requested_at: '2026-09-25 10:00:00' }] } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, data: { reviewed: true, status: 'approved' } })));
    vi.stubGlobal('fetch', fetchMock);
    await expect(listSalesInquiryPrintRequests()).resolves.toEqual([{ id: 9, inquiry_refno: '261112062925689417412663', inquiry_no: 'INQ26-1', requested_by: 4, requested_by_name: 'Staff A', requested_at: '2026-09-25 10:00:00' }]);
    await reviewSalesInquiryPrintRequest(9, 'approved');
    expect(fetchMock.mock.calls.map(([url, init]) => [String(url), init?.method || 'GET'])).toEqual([
      ['/api/v1/sales-inquiry-print-requests', 'GET'],
      ['/api/v1/sales-inquiry-print-requests/9/review', 'POST'],
    ]);
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ decision: 'approved' });
  });

  it('confirms an inquiry through the timestamp endpoint and supports exit-safe requests', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ ok: true, data: { confirmed: true, confirmed_at: '2026-09-25 10:00:00' } })));
    vi.stubGlobal('fetch', fetchMock);
    await confirmSalesInquiry('INQ-1', { keepalive: true });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/sales-inquiries/INQ-1/confirm');
    expect(fetchMock.mock.calls[0][1]?.keepalive).toBe(true);
  });
});
