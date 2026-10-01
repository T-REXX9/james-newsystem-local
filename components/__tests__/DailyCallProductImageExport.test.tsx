import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import DailyCallProductImageExport from '../DailyCallProductImageExport';
import { fetchProductsPage } from '../../services/productLocalApiService';

vi.mock('../../services/productLocalApiService', () => ({
  fetchProductsPage: vi.fn(),
}));

const product = {
  id: 'product-1',
  part_no: 'PART-1',
  item_code: 'ITEM-1',
  description: 'Sample diesel injector',
  descriptive_inquiry: 'Fits select diesel engines',
  recordImage: 'image-data',
} as any;

describe('DailyCallProductImageExport', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('lets the assigned sales agent search, select, and remove a product', async () => {
    vi.mocked(fetchProductsPage).mockResolvedValue({ items: [product], meta: { page: 1, per_page: 50, total: 1, total_pages: 1 } });
    render(<DailyCallProductImageExport customerName="Acme" assignedAgentId="agent-1" currentUser={{ id: 'agent-1', email: 'agent@example.test', role: 'Sales Agent' }} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Search products' }), { target: { value: 'PART' } });
    await waitFor(() => expect(fetchProductsPage).toHaveBeenCalledWith({ search: 'PART', status: 'all', page: 1, perPage: 50 }));
    const checkbox = await screen.findByRole('checkbox');
    fireEvent.click(checkbox);

    expect(screen.getByText('1 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download JPG' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Download ZIP' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Remove Sample diesel injector from selection' }));
    expect(screen.getByText('0 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download ZIP' })).toBeDisabled();
  });

  it('does not expose exports to a sales agent who is not assigned to the customer', () => {
    render(<DailyCallProductImageExport customerName="Acme" assignedAgentId="other-agent" currentUser={{ id: 'agent-1', email: 'agent@example.test', role: 'Sales Agent' }} />);

    expect(screen.getByText(/available to staff and this customer’s assigned sales agent/i)).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Search products' })).not.toBeInTheDocument();
    expect(fetchProductsPage).not.toHaveBeenCalled();
  });

  it('allows a staff user to export from a customer detail', () => {
    render(<DailyCallProductImageExport customerName="Acme" assignedAgentId="other-agent" currentUser={{ id: 'staff-1', email: 'staff@example.test', role: 'Warehouse Personnel' }} />);

    expect(screen.getByRole('textbox', { name: 'Search products' })).toBeInTheDocument();
  });
});
