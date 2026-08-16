import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
  fetchCategories: vi.fn().mockResolvedValue({ items: [] }),
}));

vi.mock('../../services/supplierService', () => ({
  fetchSuppliers: vi.fn().mockResolvedValue([]),
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
  packing: '12 pcs',
  specifications: 'FLAT',
  size: '',
  reorder_quantity: 8,
  status: 'Active',
  category: 'Fuel Injection',
  descriptive_inquiry: '',
  no_of_holes: '',
  replenish_quantity: 24,
  original_pn_no: 'P-P207',
  application: 'ISUZU 10PD1, 8PC, 8PD1, 8PC1',
  location: 'V1-008',
  no_of_cylinder: '',
  cost: 390,
  price_aa: 450,
  price_bb: 0,
  price_cc: 0,
  price_dd: 0,
  price_vip1: 430,
  price_vip2: 420,
  stock_wh1: 5,
  stock_wh2: 2,
  stock_wh3: 3,
  stock_wh4: 0,
  stock_wh5: 0,
  stock_wh6: 0,
  supplier_costs: [{
    supplier_id: 'supplier-1',
    supplier_code: 'QKHT',
    supplier_name: 'QKHT DIESEL PARTS',
    cost: 390,
    rank: 1,
    status: 'Preferred Supplier 1',
  }],
  last_receive_quantity: 25,
  last_receive_date: '2026-07-20 10:30:00',
  incident_report_count: 2,
  return_report_count: 1,
  last_price_update: '2026-07-21 08:00:00',
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

  it('matches the legacy product database form and record-table workflow', async () => {
    render(<ProductDatabase currentUser={{ role: 'Owner' } as any} />);

    expect(await screen.findByText('QK2-001')).toBeInTheDocument();
    expect(fetchProductsPageMock).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' }));
    expect(screen.getByDisplayValue('All Unhidden')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Product Details' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Supplier & Costing' }));
    expect(screen.getByText('Supplier COG')).toBeInTheDocument();
    expect(screen.getByText('QKHT DIESEL PARTS')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Pricing & Stock' }));
    expect(screen.getByText('Price List')).toBeInTheDocument();
    expect(screen.getAllByText('Regular').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Silver').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Gold').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Platinum').length).toBeGreaterThan(0);
    expect(screen.queryByText('AAA')).not.toBeInTheDocument();
    expect(screen.queryByText('VIP 1')).not.toBeInTheDocument();
    expect(screen.getByText('Specifications')).toBeInTheDocument();
    expect(screen.getByText('Supplier (Cost of Goods)')).toBeInTheDocument();
    expect(screen.getByText('Stock & Reorder')).toBeInTheDocument();
    expect(screen.getByText('Price List (Per Piece)')).toBeInTheDocument();
    expect(screen.getByText('Last Price Update')).toBeInTheDocument();
    expect(screen.getByText('Preferred Supplier 1')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('(20/07/2026)')).toBeInTheDocument();
    const productTable = screen.getByText('Specifications').closest('table');
    expect(productTable).toHaveClass('w-full', 'table-fixed');
    expect(productTable).toHaveClass('text-[11px]', 'min-w-[1900px]');
    expect(productTable?.parentElement).toHaveClass('overflow-auto');
    expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    expect(screen.getByText('All items loaded')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('View full details'));
    expect(screen.getByDisplayValue('QK2-001')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ISUZU 10PD1, 8PC, 8PD1, 8PC1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('8')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
  });

  it('loads and appends the next product batch when the list reaches the bottom', async () => {
    const secondProduct = {
      ...sampleProduct,
      id: 'product-2',
      part_no: 'QK2-002',
      item_code: '66392',
    };
    fetchProductsPageMock.mockReset();
    fetchProductsPageMock
      .mockResolvedValueOnce({
        items: [sampleProduct],
        meta: { page: 1, per_page: 100, total: 2, total_pages: 2 },
      })
      .mockResolvedValueOnce({
        items: [secondProduct],
        meta: { page: 2, per_page: 100, total: 2, total_pages: 2 },
      });

    render(<ProductDatabase currentUser={{ role: 'Owner' } as any} />);
    expect(await screen.findByText('QK2-001')).toBeInTheDocument();
    expect(screen.getByText('Scroll to the bottom to load more')).toBeInTheDocument();

    const viewport = screen.getByText('Specifications').closest('table')?.parentElement;
    expect(viewport).not.toBeNull();
    Object.defineProperties(viewport!, {
      scrollHeight: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 500 },
      scrollTop: { configurable: true, value: 500, writable: true },
    });
    fireEvent.scroll(viewport!);

    expect(await screen.findByText('QK2-002')).toBeInTheDocument();
    expect(fetchProductsPageMock).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, perPage: 100 }));
    expect(screen.getByText('Showing 2 of 2 records')).toBeInTheDocument();
    expect(screen.getByText('All items loaded')).toBeInTheDocument();
  });
});
