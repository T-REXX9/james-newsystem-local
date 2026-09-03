import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProductAutocomplete from '../ProductAutocomplete';

const searchProductsMock = vi.fn();

vi.mock('../../services/productLocalApiService', () => ({
  searchProducts: (...args: any[]) => searchProductsMock(...args),
}));

vi.mock('../../hooks/useDebounce', () => ({
  useDebounce: (value: string) => value,
}));

const sampleProduct = {
  id: 'prod-1',
  part_no: 'PART-001',
  item_code: 'ITEM-001',
  description: 'Widget Alpha',
  stock_wh1: 1,
  stock_wh2: 0,
  stock_wh3: 0,
  stock_wh4: 0,
  stock_wh5: 0,
  stock_wh6: 0,
  price_aa: 125,
};

describe('ProductAutocomplete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchProductsMock.mockImplementation(async () => [sampleProduct]);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('closes the dropdown when the explicit close button is clicked', async () => {
    render(<ProductAutocomplete onSelect={vi.fn()} />);

    fireEvent.focus(screen.getByRole('textbox'));
    expect(await screen.findByText(/result matches/i)).toBeInTheDocument();

    await userEvent.setup().click(screen.getByTitle('Close search results'));
    await waitFor(() => {
      expect(screen.queryByText(/result matches/i)).not.toBeInTheDocument();
    });
  });

  it('renders its result overlay above application modals', async () => {
    render(<ProductAutocomplete onSelect={vi.fn()} />);

    fireEvent.focus(screen.getByRole('textbox'));
    await screen.findByText(/result matches/i);

    await waitFor(() => {
      expect(document.getElementById('product-autocomplete-dropdown')).toHaveStyle({
        zIndex: '12000',
      });
    });
  });

  it('uses a custom search function when complaints are limited to purchased items', async () => {
    const searchFn = vi.fn(async () => [sampleProduct]);
    render(
      <ProductAutocomplete
        onSelect={vi.fn()}
        searchFn={searchFn}
        emptyMessage="Not in this customer's purchase history"
      />
    );

    fireEvent.focus(screen.getByRole('textbox'));
    await waitFor(() => {
      expect(searchFn).toHaveBeenCalled();
      expect(searchProductsMock).not.toHaveBeenCalled();
    });
  });

  it('uses the reorder-only product search when requested by purchasing', async () => {
    render(<ProductAutocomplete reorderOnly onSelect={vi.fn()} />);

    await waitFor(() => {
      expect(searchProductsMock).toHaveBeenCalledWith('', 'active', { reorderOnly: true });
    });
  });

  it('hides unmatched default results as soon as a part number is typed', async () => {
    searchProductsMock.mockResolvedValue([
      sampleProduct,
      {
        ...sampleProduct,
        id: 'prod-2',
        part_no: 'P-G3S91',
        item_code: 'QK2-1521',
        description: 'NOZZLE',
      },
    ]);

    render(<ProductAutocomplete onSelect={vi.fn()} emptyMessage="Not in this customer's purchase history" />);

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    expect(await screen.findByText('P-G3S91')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'DLLA147P788' } });

    expect(screen.queryByText('P-G3S91')).not.toBeInTheDocument();
    expect(screen.queryByText('PART-001')).not.toBeInTheDocument();
    expect(await screen.findByText("Not in this customer's purchase history")).toBeInTheDocument();
  });

  it('stays closed after selecting a product even when the reset search resolves', async () => {
    const onSelect = vi.fn();
    render(<ProductAutocomplete onSelect={onSelect} />);

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    expect(await screen.findByText('PART-001')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'widget' } });
    await waitFor(() => {
      expect(searchProductsMock).toHaveBeenCalledWith('widget');
    });

    await userEvent.setup().click(screen.getByText('PART-001'));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'prod-1' }));

    await waitFor(() => {
      expect(searchProductsMock).toHaveBeenCalledWith('');
    });

    await waitFor(() => {
      expect(screen.queryByText(/result matches/i)).not.toBeInTheDocument();
    });
  });
});
