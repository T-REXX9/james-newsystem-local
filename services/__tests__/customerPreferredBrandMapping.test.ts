import { describe, expect, it } from 'vitest';
import {
  mapApiCustomerToContact,
  mapContactPayloadToApi,
  mapContactUpdatesToApi,
} from '../customerDatabaseLocalApiService';
import { CustomerStatus } from '../../types';

describe('customer preferred brand API mapping', () => {
  it('maps preferred_brand from API customer rows into Contact.preferredBrand', () => {
    const contact = mapApiCustomerToContact({
      session_id: 'sess-1',
      company: 'Acme Parts',
      preferred_brand: 'ishinomoto',
      debt_type: 'Good',
      status: 1,
      profile_type: 'Old',
    });

    expect(contact.preferredBrand).toBe('Ishinomoto');
  });

  it('omits preferredBrand when API value is empty or unsupported', () => {
    const empty = mapApiCustomerToContact({
      session_id: 'sess-2',
      company: 'Beta',
      preferred_brand: '',
      status: 1,
    });
    const unsupported = mapApiCustomerToContact({
      session_id: 'sess-3',
      company: 'Gamma',
      preferred_brand: 'Motul',
      status: 1,
    });

    expect(empty.preferredBrand).toBeUndefined();
    expect(unsupported.preferredBrand).toBeUndefined();
  });

  it('maps Contact.preferredBrand into create/update API payloads', () => {
    const createPayload = mapContactPayloadToApi({
      company: 'Acme Parts',
      preferredBrand: 'Others',
      status: CustomerStatus.ACTIVE,
      debtType: 'Good',
    } as any);

    expect(createPayload.preferred_brand).toBe('Others');

    const patchPayload = mapContactUpdatesToApi({ preferredBrand: 'ishinomoto' });
    expect(patchPayload.preferred_brand).toBe('Ishinomoto');
  });

  it('does not include preferred_brand in patch payload unless preferredBrand is provided', () => {
    const patchPayload = mapContactUpdatesToApi({ company: 'Only Company' });
    expect(patchPayload).not.toHaveProperty('preferred_brand');
  });

  it('clears preferred_brand when preferredBrand is blank', () => {
    const patchPayload = mapContactUpdatesToApi({ preferredBrand: '' });
    expect(patchPayload.preferred_brand).toBe('');
  });
});
