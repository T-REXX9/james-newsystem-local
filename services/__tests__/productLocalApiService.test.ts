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
});
