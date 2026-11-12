import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSalesInquiry } from '../salesInquiryLocalApiService';

afterEach(() => vi.unstubAllGlobals());

describe('salesInquiryLocalApiService', () => {
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
});
