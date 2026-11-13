import { afterEach, describe, expect, it, vi } from 'vitest';
import { confirmSalesInquiry, convertToOrder, getSalesInquiry, replaceSalesInquiry } from '../salesInquiryLocalApiService';

afterEach(() => vi.unstubAllGlobals());

describe('salesInquiryLocalApiService', () => {
  it('submits replacement data to the atomic replace endpoint', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ ok: true, data: {
      inquiry_refno: 'INQ-NEW', inquiry_no: 'INQ26-2', contact_id: 'C1', sales_date: '2026-11-13',
      sales_time: '09:00:00', status: 'Pending', confirmed_at: '2026-11-13 09:00:00',
      replacement_of_refno: 'INQ-OLD', replaced_by_refno: '', items: [],
    } })));
    vi.stubGlobal('fetch', fetchMock);

    await expect(replaceSalesInquiry('INQ-OLD', {
      contact_id: 'C1', sales_date: '2026-11-13', sales_time: '09:00:00', sales_person: '',
      delivery_address: '', reference_no: '', customer_reference: '', send_by: '', price_group: '',
      credit_limit: 0, terms: '', promise_to_pay: '', po_number: '', inquiry_type: 'General',
      urgency: 'N/A', items: [{ item_id: 'P1', qty: 1, part_no: 'P1', item_code: '', location: '', description: 'Part', unit_price: 10, amount: 10, approval_status: 'approved' }],
    })).resolves.toMatchObject({ id: 'INQ-NEW', replacement_of_refno: 'INQ-OLD' });
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/v1/sales-inquiries/INQ-OLD/replace');
    expect(fetchMock.mock.calls[0][1]?.method).toBe('POST');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ contact_id: 'C1', items: [{ item_id: 'P1' }] });
  });

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

  it('confirms an inquiry through the timestamp endpoint and supports exit-safe requests', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ ok: true, data: { confirmed: true, confirmed_at: '2026-09-25 10:00:00' } })));
    vi.stubGlobal('fetch', fetchMock);
    await confirmSalesInquiry('INQ-1', { permissionAction: 'add', keepalive: true });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/sales-inquiries/INQ-1/confirm');
    expect(fetchMock.mock.calls[0][1]?.keepalive).toBe(true);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ permission_action: 'add' });
  });

  it('keeps the persisted VIP discount when mapping a converted sales order', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true, data: {
      order: { sales_refno: 'SO-1', sales_no: 'SO-1', inquiry_refno: 'INQ-1', status: 'Submitted' },
      summary: { grand_total: 1000, vip_applied: 1, vip_tier: 'silver', vip_percentage: 10, vip_discount_amount: 100, total_to_pay: 900 },
      items: [],
    } }))));

    await expect(convertToOrder('INQ-1')).resolves.toMatchObject({
      vip_applied: true,
      vip_tier: 'silver',
      vip_percentage: 10,
      vip_discount_amount: 100,
      total_to_pay: 900,
    });
  });


});
