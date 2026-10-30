import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCustomerIdentifiers } from '../customerIdentifierService';
import { getLocalAuthSession } from '../localAuthService';

vi.mock('../localAuthService', () => ({ getLocalAuthSession: vi.fn() }));
vi.mock('../localApiAuth', () => ({ parseApiErrorMessage: vi.fn(async () => 'Request failed') }));

afterEach(() => vi.restoreAllMocks());

describe('fetchCustomerIdentifiers', () => {
  it('loads every shared customer label without caching and normalizes identifiers', async () => {
    vi.mocked(getLocalAuthSession).mockReturnValue({ token: 'session-token' } as ReturnType<typeof getLocalAuthSession>);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: { items: [
        { customer_id: ' customer-1 ', identifiers: ['New Customer'] },
        { customer_id: 'customer-2', identifiers: ['Blacklisted', 'Do Not Call'] },
        { customer_id: 'customer-3', identifiers: ['Unknown'] },
      ] } }),
    } as Response);

    const identifiers = await fetchCustomerIdentifiers();

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/customer-identifiers', expect.objectContaining({ cache: 'no-store' }));
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer session-token');
    expect(identifiers.get('customer-1')).toEqual(['New Customer']);
    expect(identifiers.get('customer-2')).toEqual(['Blacklisted', 'Do Not Call']);
    expect(identifiers.has('customer-3')).toBe(false);
  });
});
