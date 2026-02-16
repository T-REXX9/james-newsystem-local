import { describe, expect, it } from 'vitest';
import {
  bulkUpdateProducts,
  createProduct,
  deleteProduct,
  fetchProducts,
  updateProduct,
} from '../supabaseService';
import type { Product } from '../../types';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || 'http://127.0.0.1:8081/api/v1';
const MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

const getProductById = async (id: string): Promise<any | null> => {
  const response = await fetch(`${API_BASE_URL}/products/${encodeURIComponent(id)}?main_id=${MAIN_ID}`);
  if (!response.ok) return null;
  const payload = await response.json();
  return payload?.data || null;
};

const findProductBySearch = async (query: string): Promise<any | null> => {
  const params = new URLSearchParams({
    main_id: String(MAIN_ID),
    search: query,
    page: '1',
    per_page: '20',
    status: 'all',
  });
  const response = await fetch(`${API_BASE_URL}/products?${params.toString()}`);
  if (!response.ok) return null;
  const payload = await response.json();
  const items = Array.isArray(payload?.data?.items) ? payload.data.items : [];
  return items[0] || null;
};

describe('Product Database local API integration', () => {
  it(
    'loads product list and completes CRUD flow through new-system service methods',
    async () => {
      const seed = Date.now();
      const uniquePartNo = `CODEx-IT-PN-${seed}`;
      const uniqueItemCode = `CODEx-IT-CODE-${seed}`;
      let productId: string | null = null;

      const list = await fetchProducts();
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeGreaterThan(1000);
      expect(typeof list[0]?.id).toBe('string');
      expect(typeof list[0]?.part_no).toBe('string');

      const baseProduct: Omit<Product, 'id'> = {
        part_no: uniquePartNo,
        oem_no: '',
        brand: 'TEST-BRAND',
        barcode: '',
        no_of_pieces_per_box: 1,
        item_code: uniqueItemCode,
        description: 'Codex integration test product',
        size: '',
        reorder_quantity: 2,
        status: 'Active',
        category: 'TEST',
        descriptive_inquiry: '',
        no_of_holes: '',
        replenish_quantity: 2,
        original_pn_no: '',
        application: '',
        no_of_cylinder: '',
        cost: 100,
        price_aa: 120,
        price_bb: 130,
        price_cc: 140,
        price_dd: 150,
        price_vip1: 110,
        price_vip2: 105,
        stock_wh1: 1,
        stock_wh2: 0,
        stock_wh3: 0,
        stock_wh4: 0,
        stock_wh5: 0,
        stock_wh6: 0,
      };

      try {
        await createProduct(baseProduct);

        const created = await findProductBySearch(uniqueItemCode);
        expect(created).toBeTruthy();
        productId = String(created.id);
        expect(created.part_no).toContain(uniquePartNo);

        await updateProduct(productId, {
          description: 'Codex integration test product updated',
          price_aa: 222,
          stock_wh1: 3,
        });

        const updated = await getProductById(productId);
        expect(updated).toBeTruthy();
        expect(String(updated.description)).toContain('updated');
        expect(Number(updated.price_aa)).toBe(222);

        await bulkUpdateProducts([productId], {
          status: 'Inactive',
          price_bb: 333,
        });

        const bulkUpdated = await getProductById(productId);
        expect(bulkUpdated).toBeTruthy();
        expect(String(bulkUpdated.status)).toBe('Inactive');
        expect(Number(bulkUpdated.price_bb)).toBe(333);

        await deleteProduct(productId);
        const deleted = await getProductById(productId);
        expect(deleted).toBeNull();
      } finally {
        if (productId) {
          await fetch(`${API_BASE_URL}/products/${encodeURIComponent(productId)}?main_id=${MAIN_ID}`, {
            method: 'DELETE',
          });
        }
      }
    },
    120000
  );
});
