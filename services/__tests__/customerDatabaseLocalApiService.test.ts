import { CustomerStatus } from '../../types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchDailyCallMasterList } from '../dailyCallMonitoringService';
import { mapApiCustomerToContact, mapContactPayloadToApi, mapContactUpdatesToApi, updateContact } from '../customerDatabaseLocalApiService';

const reloadStanding = (patch: Record<string, unknown>) =>
  mapApiCustomerToContact({
    session_id: 'sess-standing',
    company: 'Standing Co',
    status: patch.status as number,
    debt_type: String(patch.debt_type ?? ''),
    profile_type: String(patch.profile_type ?? 'Old'),
    verification: String(patch.verification ?? ''),
  }).status;

describe('customer database price and discount codes', () => {
  it('maps persisted price and discount codes from the customer database', () => {
    const contact = mapApiCustomerToContact({
      session_id: 'cust-1',
      company: 'Acme Trading',
      price_code: 'vip 2',
      price_group: 'vip2',
      discount_code: 'vip gold',
    });

    expect(contact.priceGroup).toBe('vip 2');
    expect(contact.priceCode).toBe('vip 2');
    expect(contact.discountCode).toBe('vip gold');
  });

  it('writes price code and discount code back to the API payload', () => {
    const payload = mapContactPayloadToApi({
      company: 'Acme Trading',
      priceCode: 'vip 3',
      discountCode: 'vip platinum',
    });

    expect(payload.price_group).toBe('vip 3');
    expect(payload.discount_code).toBe('vip platinum');
  });

  it('sends partial discount code updates without requiring price changes', () => {
    expect(mapContactUpdatesToApi({ discountCode: 'vip silver' })).toEqual({
      discount_code: 'vip silver',
    });
  });
});

describe('customer database saves and daily call cache', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('does not let the master daily call list serve a pre-save cache after updateContact succeeds', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            items: [{ id: 'blocked-1', shop_name: 'Blocked Shop', customer_status: 4, debt_type: 'Bad' }],
            meta: { from_date: '2025-10-01', count: 1 },
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: 'blocked-1' } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            items: [{ id: 'blocked-1', shop_name: 'Active Again Shop', customer_status: 1, debt_type: 'Good' }],
            meta: { from_date: '2025-10-01', count: 1 },
          },
        }),
      } as Response);

    const beforeSave = await fetchDailyCallMasterList({ fromDate: '2025-10-01' });
    expect(beforeSave.items[0]).toMatchObject({ shopName: 'Blocked Shop', debtType: 'Bad' });

    await updateContact('blocked-1', { status: CustomerStatus.ACTIVE });

    const afterSave = await fetchDailyCallMasterList({ fromDate: '2025-10-01' });

    expect(afterSave.items[0]).toMatchObject({ shopName: 'Active Again Shop', debtType: 'Good' });
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(String(fetchSpy.mock.calls[2][0])).toContain('/daily-call-monitoring/master-list?');
  });
});

describe('customer since mapping', () => {
  it('maps Customer Since from the relationship-start date, not epoch dealership-since', () => {
    const contact = mapApiCustomerToContact({
      session_id: '42594401020200807132631',
      company: '3JDS CALIBRATION CENTER',
      since: '2019-05-24',
      dealer_since: '1970-01-01',
      date_registered: '2020/09/22 06:36:11',
    });

    expect(contact.customerSince).toBe('2019-05-24');
    expect(contact.dealershipSince).toBe('');
  });

  it('leaves Customer Since empty when the relationship-start date is missing', () => {
    const contact = mapApiCustomerToContact({
      session_id: 'cust-empty',
      dealer_since: '1970-01-01',
      date_registered: '2020/09/22 06:36:11',
    });

    expect(contact.customerSince).toBe('');
    expect(contact.dealershipSince).toBe('');
  });

  it('writes Customer Since to since and Dealership Since to dealer_since', () => {
    const payload = mapContactPayloadToApi({
      company: '3JDS CALIBRATION CENTER',
      customerSince: '2019-05-24',
      dealershipSince: '',
    });

    expect(payload.since).toBe('2019-05-24');
    expect(payload.dealer_since).toBe('');
  });

  it('sends Customer Since updates without writing dealership since', () => {
    expect(mapContactUpdatesToApi({ customerSince: '2019-05-24' })).toEqual({
      since: '2019-05-24',
    });
  });

  it('does not send Unix epoch as dealership since', () => {
    const payload = mapContactPayloadToApi({
      dealershipSince: '1970-01-01',
    });

    expect(payload.dealer_since).toBe('');
  });

  it('keeps a real Dealership Since date', () => {
    const contact = mapApiCustomerToContact({
      session_id: 'cust-dealer',
      since: '2019-05-24',
      dealer_since: '2021-01-01',
    });

    expect(contact.customerSince).toBe('2019-05-24');
    expect(contact.dealershipSince).toBe('2021-01-01');
  });
});

describe('customer standing round-trip', () => {
  it('saving Status Active on a Blacklisted customer reloads as Active', () => {
    const loaded = mapApiCustomerToContact({
      session_id: 'sess-standing',
      company: 'Standing Co',
      status: 1,
      debt_type: 'Bad',
      profile_type: 'Old',
    });
    expect(loaded.status).toBe(CustomerStatus.BLACKLISTED);

    const patch = mapContactUpdatesToApi({
      status: CustomerStatus.ACTIVE,
      debtType: loaded.debtType,
    });

    expect(reloadStanding(patch)).toBe(CustomerStatus.ACTIVE);
  });

  it('saving Status Blacklisted on an Active customer reloads as Blacklisted', () => {
    const patch = mapContactUpdatesToApi({
      status: CustomerStatus.BLACKLISTED,
      debtType: 'Good',
    });

    expect(reloadStanding(patch)).toBe(CustomerStatus.BLACKLISTED);
  });

  it('saving Status Blacklisted does not rewrite profile type or verification unless explicitly requested', () => {
    const patch = mapContactUpdatesToApi({
      status: CustomerStatus.BLACKLISTED,
      debtType: 'Good',
    });

    expect(patch).toMatchObject({
      status: 1,
      debt_type: 'Bad',
    });
    expect(patch).not.toHaveProperty('profile_type');
    expect(patch).not.toHaveProperty('verification');
  });

  it('saving Status Inactive on a Blacklisted customer reloads as Inactive', () => {
    const patch = mapContactUpdatesToApi({
      status: CustomerStatus.INACTIVE,
      debtType: 'Bad',
    });

    expect(reloadStanding(patch)).toBe(CustomerStatus.INACTIVE);
  });

  it('saving Status Prospective on a Blacklisted customer reloads as Prospective', () => {
    const patch = mapContactUpdatesToApi({
      status: CustomerStatus.PROSPECTIVE,
      debtType: 'Bad',
    });

    expect(reloadStanding(patch)).toBe(CustomerStatus.PROSPECTIVE);
  });

  it('saving Status Verified Prospect on a Blacklisted customer reloads as Verified Prospect', () => {
    const patch = mapContactUpdatesToApi({
      status: CustomerStatus.VERIFIED_PROSPECT,
      debtType: 'Bad',
    });

    expect(reloadStanding(patch)).toBe(CustomerStatus.VERIFIED_PROSPECT);
  });

  it('saving Status Active without a Debt Type field still reloads as Active', () => {
    const patch = mapContactUpdatesToApi({
      status: CustomerStatus.ACTIVE,
    });

    expect(reloadStanding(patch)).toBe(CustomerStatus.ACTIVE);
  });

  it('create payload for Status Active does not keep a Bad debt type as Blacklisted', () => {
    const payload = mapContactPayloadToApi({
      company: 'Standing Co',
      status: CustomerStatus.ACTIVE,
      debtType: 'Bad',
    });

    expect(reloadStanding(payload)).toBe(CustomerStatus.ACTIVE);
  });
});
