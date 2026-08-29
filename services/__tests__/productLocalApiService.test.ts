import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchProductsPage, searchProducts } from '../productLocalApiService';

const okResponse = (data: unknown) =>
  Promise.resolve({
    ok: true,
    json: async () => ({ data }),
  } as Response);

describe('productLocalApiService', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('searchProducts requests active products by default', async () => {
    (global.fetch as any).mockImplementation(() =>
      okResponse({
        items: [],
        meta: { page: 1, per_page: 50, total: 0, total_pages: 1 },
      })
    );

    await searchProducts('brake');

    const [url] = (global.fetch as any).mock.calls[0];
    expect(String(url)).toContain('/products?');
    expect(String(url)).toContain('search=brake');
    expect(String(url)).toContain('status=active');
    expect(String(url)).toContain('per_page=50');
  });

  it('allows callers to explicitly request all products', async () => {
    (global.fetch as any).mockImplementation(() =>
      okResponse({
        items: [],
        meta: { page: 1, per_page: 50, total: 0, total_pages: 1 },
      })
    );

    await searchProducts('brake', 'all');

    const [url] = (global.fetch as any).mock.calls[0];
    expect(String(url)).toContain('status=all');
  });

  it('requests only products below a positive reorder quantity when required', async () => {
    (global.fetch as any).mockImplementation(() =>
      okResponse({
        items: [],
        meta: { page: 1, per_page: 50, total: 0, total_pages: 1 },
      })
    );

    await searchProducts('brake', 'active', { reorderOnly: true });

    const [url] = (global.fetch as any).mock.calls[0];
    expect(String(url)).toContain('reorder_only=1');
  });

  it('fetchProductsPage forwards the provided status filter', async () => {
    (global.fetch as any).mockImplementation(() =>
      okResponse({
        items: [],
        meta: { page: 1, per_page: 25, total: 0, total_pages: 1 },
      })
    );

    await fetchProductsPage({ search: 'filter', status: 'inactive', perPage: 25 });

    const [url] = (global.fetch as any).mock.calls[0];
    expect(String(url)).toContain('status=inactive');
    expect(String(url)).toContain('per_page=25');
  });

  it('normalizes product location from the API', async () => {
    (global.fetch as any).mockImplementation(() =>
      okResponse({
        items: [
          {
            id: 'product-1',
            part_no: 'P-001',
            status: 'Active',
            location: 'V1-008',
          },
        ],
        meta: { page: 1, per_page: 25, total: 1, total_pages: 1 },
      })
    );

    const result = await fetchProductsPage({ perPage: 25 });

    expect(result.items[0].location).toBe('V1-008');
  });

  it('normalizes the centralized total quantity from the API', async () => {
    (global.fetch as any).mockImplementation(() =>
      okResponse({
        items: [{ id: 'product-1', status: 'Active', total_stock: '42' }],
        meta: { page: 1, per_page: 25, total: 1, total_pages: 1 },
      })
    );

    const result = await fetchProductsPage({ perPage: 25 });

    expect(result.items[0].total_stock).toBe(42);
  });
});
