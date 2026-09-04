import { describe, expect, it, vi, afterEach } from 'vitest';

describe('updateContact oversize legacy mobile handling', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('omits oversize/empty demoted mobile from the patient PATCH payload', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const method = String(init?.method || 'GET').toUpperCase();
      if (method === 'GET') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            data: {
              contacts: [
                {
                  id: 'cp-1',
                  lfname: 'ERLINDA',
                  llname: 'ROGERO',
                  lc_mobile: '09177081946 , 09171476584',
                },
              ],
            },
          }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, data: {} }),
      } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    const { updateContact } = await import('../customerDatabaseLocalApiService');

    await updateContact('sess-1', {
      preferredBrand: 'Ishinomoto',
      mobile: '',
      phone: '',
      contactPersons: [
        {
          id: 'cp-1',
          enabled: true,
          name: 'ERLINDA ROGERO',
          position: '',
          birthday: '',
          telephone: '',
          mobile: '09177081946 , 09171476584',
          email: '',
        },
      ],
    });

    const patchCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).includes('/customer-database/sess-1') &&
        String((init as RequestInit)?.method || '').toUpperCase() === 'PATCH' &&
        !String(url).includes('/contacts/')
    );

    expect(patchCall).toBeTruthy();
    const body = JSON.parse(String((patchCall?.[1] as RequestInit).body || '{}'));
    expect(body.preferred_brand).toBe('Ishinomoto');
    expect(body).not.toHaveProperty('mobile');
  });
});
