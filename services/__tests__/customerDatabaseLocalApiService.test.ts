import { describe, expect, it } from 'vitest';
import { mapApiCustomerToContact, mapContactPayloadToApi, mapContactUpdatesToApi } from '../customerDatabaseLocalApiService';

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
