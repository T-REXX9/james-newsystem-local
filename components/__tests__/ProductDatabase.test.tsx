import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProductDatabase from '../ProductDatabase';
import type { Product } from '../../types';

const fetchProductsPageMock = vi.fn();
const searchStockMovementProductsMock = vi.fn();
const fetchProductMovementClassificationsMock = vi.fn();

vi.mock('../../services/productLocalApiService', () => ({
  fetchProductsPage: (...args: any[]) => fetchProductsPageMock(...args),
  fetchProductById: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
}));

vi.mock('../../services/stockMovementLocalApiService', () => ({
  searchStockMovementProducts: (...args: any[]) => searchStockMovementProductsMock(...args),
}));

vi.mock('../../services/inventoryMovementService', () => ({
  fetchProductMovementClassifications: (...args: any[]) => fetchProductMovementClassificationsMock(...args),
}));

vi.mock('../../services/categoryLocalApiService', () => ({
  fetchCategories: vi.fn(),
}));

vi.mock('../ToastProvider', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

const sampleProduct: Product = {
  id: 'product-1',
  part_no: 'QK2-001',
  oem_no: 'OEM-001',
  brand: 'ISHINOMOTO',
  barcode: '1234567890',
  no_of_pieces_per_box: 12,
  item_code: '66391',
  description: 'PLUNGER',
  size: '',
  reorder_quantity: 8,
  status: 'Active',
  category: 'Fuel Injection',
  descriptive_inquiry: '',
  no_of_holes: '',
  replenish_quantity: 24,
  original_pn_no: 'P-P207',
  application: 'ISUZU 10PD1, 8PC, 8PD1, 8PC1',
  no_of_cylinder: '',
  cost: 390,
  price_aa: 450,
  price_bb: 0,
  price_cc: 0,
  price_dd: 0,
  price_vip1: 430,
  price_vip2: 420,
  stock_wh1: 5,
  stock_wh2: 0,
  stock_wh3: 0,
  stock_wh4: 0,
  stock_wh5: 0,
  stock_wh6: 0,
};

describe('ProductDatabase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchProductsPageMock.mockResolvedValue({
      items: [sampleProduct],
      meta: {
        page: 1,
        per_page: 100,
        total: 1,
        total_pages: 1,
      },
    });
    searchStockMovementProductsMock.mockResolvedValue([]);
    fetchProductMovementClassificationsMock.mockResolvedValue(new Map());
  });

  afterEach(() => {
    cleanup();
  });

  it('shows application details and reorder quantity in the product row', async () => {
    render(<ProductDatabase currentUser={{ role: 'Owner' } as any} />);

    expect(await screen.findByText('QK2-001')).toBeInTheDocument();
    expect(screen.getByText('Application: ISUZU 10PD1, 8PC, 8PD1, 8PC1')).toBeInTheDocument();
    expect(screen.getByText('Reorder Qty: 8')).toBeInTheDocument();
  });
});
