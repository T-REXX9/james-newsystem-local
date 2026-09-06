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
