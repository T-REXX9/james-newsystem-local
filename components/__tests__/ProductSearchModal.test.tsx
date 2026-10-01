import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  brand: 'DENSO',
  description: 'NOZZLE',
  price_vip1: 445,
  price_vip2: 440,
  price_vip3: 0,
  total_stock: 92,
  application: 'ISUZU 4JA1 / 4JB1',
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
    expect(screen.getByText('Application:')).toBeInTheDocument();
    expect(screen.getByText('ISUZU 4JA1 / 4JB1')).toBeInTheDocument();
    expect(screen.getByText('Brand:')).toBeInTheDocument();
    expect(screen.getByText('DENSO')).toBeInTheDocument();
  });

  it('lets the assigned sales agent select product images to export without selecting an inquiry item', async () => {
    searchProductsMock.mockResolvedValue([{ ...product, recordImage: 'base64-image' }]);
    const onSelect = vi.fn();
    render(
      <ProductSearchModal
        isOpen
        onClose={vi.fn()}
        onSelect={onSelect}
        customerName="Acme Diesel"
        assignedAgentId="agent-1"
        currentUser={{ id: 'agent-1', email: 'agent@example.test', role: 'Sales Agent' }}
      />
    );

    const imageCheckbox = await screen.findByRole('checkbox', { name: 'Select NOZZLE image for export' });
    fireEvent.click(imageCheckbox);

    expect(screen.getByText('1 product image selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'JPG' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'PDF' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'ZIP' })).toBeEnabled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('does not show image export controls to a sales agent who is not assigned to the inquiry customer', async () => {
    searchProductsMock.mockResolvedValue([{ ...product, recordImage: 'base64-image' }]);
    render(
      <ProductSearchModal
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
        customerName="Acme Diesel"
        assignedAgentId="agent-2"
        currentUser={{ id: 'agent-1', email: 'agent@example.test', role: 'Sales Agent' }}
      />
    );

    expect(await screen.findByText(/Select a customer assigned to you in Sales Inquiry/i)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /image for export/i })).not.toBeInTheDocument();
  });
});
