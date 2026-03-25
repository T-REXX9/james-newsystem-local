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
