import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addArea,
  addCategory,
  addCustomer,
  createSpecialPrice,
  deleteSpecialPrice,
  fetchAreaPicker,
  fetchCategoryPicker,
  fetchCustomerPicker,
  fetchProducts,
  fetchSpecialPriceDetail,
  fetchSpecialPrices,
  removeArea,
  removeCategory,
  removeCustomer,
  updateSpecialPrice,
} from '../specialPriceService';

const AUTH_STORAGE_KEY = 'local_api_auth_session';

const mockJsonResponse = (data: unknown) =>
  Promise.resolve({
    ok: true,
    json: async () => ({ ok: true, data }),
  } as Response);

describe('specialPriceService request contract', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        token: 'special-price-token',
        context: {
          token: 'special-price-token',
          user: { id: 1, main_userid: 99, email: 'special@example.com' },
          main_userid: 99,
          user_type: '1',
          session_branch: 'mainbranch',
          logintype: '1',
          industry: 'Shop',
        },
        userProfile: {
          id: '1',
          email: 'special@example.com',
          main_id: 99,
          main_userid: 99,
          full_name: 'Special Price User',
          role: 'Owner',
          access_rights: ['*'],
          monthly_quota: 0,
        },
      })
    );
  });

  it('adds authorization headers and preserves pagination metadata for list endpoints', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      expect(init?.headers).toBeDefined();
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer special-price-token');

      if (url.includes('/special-prices?')) {
        return mockJsonResponse({
          items: [{ refno: 'sp-1', item_session: 'itm-1', item_code: 'CODE', part_no: 'PART', description: 'Desc', type: 'Fix', amount: 10 }],
          meta: { page: 2, per_page: 25, total: 40, total_pages: 2 },
        });
      }

      return mockJsonResponse({
        items: [],
        meta: { page: 1, per_page: 20, total: 0, total_pages: 0 },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const records = await fetchSpecialPrices('shock', 2, 25);
    expect(records.meta).toEqual({ page: 2, per_page: 25, total: 40, total_pages: 2 });
    expect(records.items[0]?.type).toBe('Fix Amount');

    await fetchProducts('brake', 1, 20);
    await fetchCustomerPicker('acme', 1, 20);
    await fetchAreaPicker('laguna', 1, 20);
    await fetchCategoryPicker('oil', 1, 20);

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain('main_id=');
  });

  it('sends bearer auth and payloads for detail, create, update, delete, and association endpoints', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      expect(headers.get('Authorization')).toBe('Bearer special-price-token');

      if ((init?.method || 'GET') !== 'GET') {
        expect(url).not.toContain('main_id=');
      }

      return mockJsonResponse({
        refno: 'sp-1',
        item_session: 'itm-1',
        item_code: 'CODE',
        part_no: 'PART',
        description: 'Desc',
        type: 'Fix',
        amount: 10,
        customers: [],
        areas: [],
        categories: [],
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchSpecialPriceDetail('sp-1');
    await createSpecialPrice('itm-1', 'Fix Amount', 25);
    await updateSpecialPrice('sp-1', 'Percentage', 15);
    await deleteSpecialPrice('sp-1');
    await addCustomer('sp-1', 'cust-1');
    await removeCustomer('sp-1', 'cust-1');
    await addArea('sp-1', 'AREA-1');
    await removeArea('sp-1', 'AREA-1');
    await addCategory('sp-1', 'CAT-1');
    await removeCategory('sp-1', 'CAT-1');

    const createBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body ?? '{}'));
    expect(createBody).toEqual({ item_session: 'itm-1', type: 'Fix Amount', amount: 25 });

    const updateBody = JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body ?? '{}'));
    expect(updateBody).toEqual({ type: 'Percentage', amount: 15 });

    const customerBody = JSON.parse(String(fetchMock.mock.calls[4]?.[1]?.body ?? '{}'));
    expect(customerBody).toEqual({ patient_refno: 'cust-1' });
  });

  it('fails fast when no local auth session is present', async () => {
    localStorage.clear();
    await expect(fetchSpecialPrices()).rejects.toThrow('Authentication required for special price requests');
  });
});
