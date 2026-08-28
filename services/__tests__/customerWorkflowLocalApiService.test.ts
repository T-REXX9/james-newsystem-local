import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDiscountRequest, fetchCustomerInquiries, fetchCustomerReturns, requestCustomerUpdate, reviewCustomerRequest } from '../customerWorkflowLocalApiService';
import { discardRecovery, restoreItem } from '../recycleBinService';
import { logActivity } from '../activityLogService';
const auth = vi.hoisted(() => ({ token: 'test-token' }));
vi.mock('../localAuthService', () => ({ getLocalAuthSession: () => ({ token: auth.token, context: { main_userid: 7 } }) }));
const fetchMock = vi.fn();
const reply = (data: unknown, status = 200) => new Response(JSON.stringify({ ok: status === 200, data, error: status === 200 ? undefined : 'Save rejected' }), { status });
beforeEach(() => { auth.token = 'test-token'; fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('customer workflow local API contracts', () => {
  it('loads every page with the exact encoded customer ID and tenant', async () => {
    fetchMock.mockResolvedValueOnce(reply({ items: [{ lrefno: 'r1', lcredit_no: 'SRC1', ldate: '2020-01-01', lstatus: 'Posted', total_amount: '12.50' }], meta: { total_pages: 2 } }))
      .mockResolvedValueOnce(reply({ items: [{ lrefno: 'r2' }], meta: { total_pages: 2 } }));
    const rows = await fetchCustomerReturns('customer/a');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ number: 'SRC1', date: '2020-01-01', amount: 12.5, status: 'Posted' });
    expect(fetchMock.mock.calls[1][0]).toContain('/customer-workflows/customer%2Fa/returns?page=2&main_id=7');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token');
  });
  it('preserves cancelled and converted inquiry states from local sales records', async () => {
    fetchMock.mockResolvedValue(reply({ items: [{ inquiry_refno: 'i1', is_cancelled: 1, so_refno: 'old-order' }, { inquiry_refno: 'i2', so_refno: 'o1', grand_total: 30 }], meta: { total_pages: 1 } }));
    expect(await fetchCustomerInquiries('c1')).toEqual([expect.objectContaining({ status: 'Cancelled' }), expect.objectContaining({ status: 'Converted', amount: 30 })]);
  });
  it('submits mapped changes as a pending request, not a direct customer PATCH', async () => {
    fetchMock.mockResolvedValue(reply({ id: 'req1', status: 'pending' }));
    await requestCustomerUpdate('c1', { company: 'Updated', deliveryAddress: 'New address', creditLimit: 200 });
    expect(fetchMock.mock.calls[0][0]).toContain('/customer-workflows/c1/requests');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ main_id: 7, kind: 'customer_update', payload: { company: 'Updated', delivery_address: 'New address', credit_limit: 200 } });
  });
  it('saves discount requests and propagates rejection instead of claiming success', async () => {
    fetchMock.mockResolvedValueOnce(reply({ id: 'd1' })).mockResolvedValueOnce(reply(null, 422));
    await createDiscountRequest({ contact_id: 'c1', discount_percentage: 7, reason: 'Repeat customer' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ kind: 'discount', payload: { discount_percentage: 7, reason: 'Repeat customer' } });
    await expect(reviewCustomerRequest('c1', 'd1', 'approved', '')).rejects.toThrow('Save rejected');
  });
  it('rejects missing sessions before loading customer records', async () => {
    auth.token = '';
    await expect(fetchCustomerInquiries('c1')).rejects.toThrow('sign in');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('uses recovery entry IDs for restore/discard and propagates conflicts', async () => {
    fetchMock.mockResolvedValueOnce(reply({ success: true })).mockResolvedValueOnce(reply(null, 409));
    await restoreItem('42');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ main_id: 7, action: 'restore' });
    await expect(discardRecovery('42')).rejects.toThrow('Save rejected');
  });
  it('only reports a saved audit log after the database endpoint confirms it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce(reply({ saved: true })).mockResolvedValueOnce(reply(null, 500));
    expect(await logActivity('LOGOUT', 'Authentication', 'session')).toBe(true);
    expect(await logActivity('LOGOUT', 'Authentication', 'session')).toBe(false);
  });
});
