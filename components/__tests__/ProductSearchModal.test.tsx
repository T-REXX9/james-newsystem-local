import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../../types';

const searchProductsMock = vi.fn();

vi.mock('../../services/productLocalApiService', () => ({
  searchProducts: (...args: unknown[]) => searchProductsMock(...args),
}));

import ProductSearchModal from '../ProductSearchModal';

const product = {
  id: 'product-1',
  part_no: 'P-DSLA150PN926',
  item_code: 'QK2-1529',
  description: 'NOZZLE',
  price_vip1: 445,
  price_vip2: 440,
  price_vip3: 0,
  total_stock: 92,
} as Product;

describe('ProductSearchModal', () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it('shows all three VIP prices for each product result', async () => {
    searchProductsMock.mockResolvedValue([product]);

    render(<ProductSearchModal isOpen onClose={vi.fn()} onSelect={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('P-DSLA150PN926')).toBeInTheDocument());

    expect(screen.getByText('VIP 1')).toBeInTheDocument();
    expect(screen.getByText('VIP 2')).toBeInTheDocument();
    expect(screen.getByText('VIP 3')).toBeInTheDocument();
    expect(screen.getByText('₱445.00')).toBeInTheDocument();
    expect(screen.getByText('₱440.00')).toBeInTheDocument();
    expect(screen.getByText('₱0.00')).toBeInTheDocument();
  });
});
