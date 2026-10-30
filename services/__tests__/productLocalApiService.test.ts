import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProduct, fetchProductCreateOptions, fetchProductsPage, searchProducts, searchSalesInquiryProducts, updateProduct } from '../productLocalApiService';

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

  it('searches products through the Sales Inquiry permission route', async () => {
    (global.fetch as any).mockImplementation(() =>
      okResponse({
        items: [{ id: 'product-1', part_no: 'P-001', status: 'Active' }],
        meta: { page: 1, per_page: 50, total: 1, total_pages: 1 },
      })
    );

    const result = await searchSalesInquiryProducts('brake');

    const [url] = (global.fetch as any).mock.calls[0];
    expect(String(url)).toContain('/sales-inquiry-products?');
    expect(String(url)).toContain('search=brake');
    expect(String(url)).toContain('status=active');
    expect(result[0]).toMatchObject({ id: 'product-1', part_no: 'P-001' });
  });

  it('forwards all Sales Inquiry field filters to the permission-scoped product search route', async () => {
    (global.fetch as any).mockImplementation(() => okResponse({ items: [], meta: { page: 1, per_page: 50, total: 0, total_pages: 1 } }));

    await searchSalesInquiryProducts('', { part_no: 'P-1', item_code: 'C-1', description: 'FILTER', application: 'TRUCK', original_pn: 'O-1' });

    const [url] = (global.fetch as any).mock.calls[0];
    expect(String(url)).toContain('part_no=P-1');
    expect(String(url)).toContain('item_code=C-1');
    expect(String(url)).toContain('description=FILTER');
    expect(String(url)).toContain('application=TRUCK');
    expect(String(url)).toContain('original_pn=O-1');
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

  it('restores product images from the legacy product-list fields', async () => {
    (global.fetch as any).mockImplementation(() => okResponse({
      items: [{
        id: 'product-1',
        record_image: 'data:image/jpeg;base64,aW1hZ2U=',
        record_image_position: '20,70',
      }],
      meta: { page: 1, per_page: 25, total: 1, total_pages: 1 },
    }));

    const result = await fetchProductsPage({ perPage: 25 });

    expect(result.items[0]).toMatchObject({
      recordImage: 'data:image/jpeg;base64,aW1hZ2U=',
      recordImagePosition: '20,70',
    });
  });

  it('loads legacy item-code prefixes and configured price groups for product creation', async () => {
    (global.fetch as any).mockImplementation(() => okResponse({
      code_prefixes: [{ id: '12', name: 'QK-' }],
      price_groups: [{ name: 'AAA', type: 'Regular' }],
    }));

    await expect(fetchProductCreateOptions()).resolves.toEqual({
      codePrefixes: [{ id: 12, name: 'QK-' }],
      priceGroups: [{ name: 'AAA', type: 'Regular' }],
    });

    const [url] = (global.fetch as any).mock.calls[0];
    expect(String(url)).toContain('/products/create-options?main_id=');
  });

  it('sends the selected legacy prefix and add-prefix choice to the create API', async () => {
    (global.fetch as any).mockImplementation(() => okResponse({ id: 'created-product' }));
    const product = {
      part_no: 'QK-NEW-001', item_code: '', description: 'New catalog item', brand: '', barcode: '',
      no_of_pieces_per_box: 1, packing: '', specifications: '', size: '', reorder_quantity: 0,
      status: 'Active' as const, category: '', descriptive_inquiry: '', no_of_holes: '',
      replenish_quantity: 0, original_pn_no: '', application: '', no_of_cylinder: '', cost: 0,
      price_aa: 0, price_bb: 0, price_cc: 0, price_dd: 0, price_vip1: 0, price_vip2: 0, price_vip3: 0,
      stock_wh1: 0, stock_wh2: 0, stock_wh3: 0, stock_wh4: 0, stock_wh5: 0, stock_wh6: 0,
      product_code_prefix: 'QK-', create_product_code_prefix: false,
    };

    await createProduct(product);

    const [, init] = (global.fetch as any).mock.calls[0];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toMatchObject({
      product_code_prefix: 'QK-',
      create_product_code_prefix: false,
      part_no: 'QK-NEW-001',
      replenish_quantity: 0,
    });
  });

  it('sends product images using the legacy API field names on create and edit', async () => {
    (global.fetch as any).mockImplementation(() => okResponse({ id: 'created-product' }));
    const image = 'data:image/jpeg;base64,aW1hZ2U=';

    await createProduct({
      part_no: 'QK-IMAGE-001', item_code: '', description: 'Product image test', brand: '', barcode: '',
      no_of_pieces_per_box: 1, packing: '', specifications: '', size: '', reorder_quantity: 0,
      status: 'Active', category: '', descriptive_inquiry: '', no_of_holes: '', replenish_quantity: 0,
      original_pn_no: '', application: '', no_of_cylinder: '', cost: 0,
      price_aa: 0, price_bb: 0, price_cc: 0, price_dd: 0, price_vip1: 0, price_vip2: 0, price_vip3: 0,
      stock_wh1: 0, stock_wh2: 0, stock_wh3: 0, stock_wh4: 0, stock_wh5: 0, stock_wh6: 0,
      product_code_prefix: 'QK-', recordImage: image, recordImagePosition: '20,70',
    } as any);

    let [, init] = (global.fetch as any).mock.calls[0];
    let body = JSON.parse(init.body);
    expect(body).toMatchObject({ record_image: image, record_image_position: '20,70' });
    expect(body).not.toHaveProperty('recordImage');
    expect(body).not.toHaveProperty('recordImagePosition');

    (global.fetch as any).mockClear();
    await updateProduct('created-product', { recordImage: image, recordImagePosition: '20,70' });

    [, init] = (global.fetch as any).mock.calls[0];
    body = JSON.parse(init.body);
    expect(body).toMatchObject({ record_image: image, record_image_position: '20,70' });
    expect(body).not.toHaveProperty('recordImage');
    expect(body).not.toHaveProperty('recordImagePosition');
  });
});
