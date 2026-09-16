import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const fetchProductsPageMock = vi.fn();

vi.mock('../../services/productLocalApiService', () => ({
  fetchProductsPage: (...args: unknown[]) => fetchProductsPageMock(...args),
}));

vi.mock('../ToastProvider', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

import ProductQuickSearchLauncher from '../ProductQuickSearchLauncher';

describe('ProductQuickSearchLauncher', () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  const openQuickSearch = () => {
    fetchProductsPageMock.mockResolvedValue({ items: [] });
    render(<ProductQuickSearchLauncher />);
    fireEvent.click(screen.getByRole('button', { name: 'Quick Product Search' }));
    return screen.getByRole('dialog', { name: 'Quick product search' });
  };

  it('minimizes when clicking outside the modal', async () => {
    openQuickSearch();

    fireEvent.pointerDown(document.body);

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Quick product search' })).not.toBeInTheDocument());
    expect(screen.getByText('Product Search')).toBeInTheDocument();
  });

  it('keeps interactions inside the modal open and minimizes on outside scroll', async () => {
    const dialog = openQuickSearch();

    fireEvent.pointerDown(dialog);
    expect(screen.getByRole('dialog', { name: 'Quick product search' })).toBeInTheDocument();

    fireEvent.scroll(document.body);

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Quick product search' })).not.toBeInTheDocument());
    expect(screen.getByText('Product Search')).toBeInTheDocument();
  });
});
