import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const fetchProductsPageMock = vi.fn();
const fetchCustomersForDailyCallMock = vi.fn();

vi.mock('../../services/productLocalApiService', () => ({
  fetchProductsPage: (...args: unknown[]) => fetchProductsPageMock(...args),
}));

vi.mock('../../services/dailyCallMonitoringService', () => ({
  fetchCustomersForDailyCall: (...args: unknown[]) => fetchCustomersForDailyCallMock(...args),
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

  it('offers image exports for a customer currently assigned to the sales agent', async () => {
    const product = {
      id: 'product-1',
      part_no: 'PART-1',
      item_code: 'ITEM-1',
      description: 'Sample diesel injector',
      recordImage: 'image-data',
      stock_wh1: 3,
    } as any;
    fetchProductsPageMock.mockResolvedValue({ items: [product] });
    fetchCustomersForDailyCallMock.mockResolvedValue([{
      id: 'customer-1',
      shopName: 'Acme Diesel',
      assignedAgentId: 'agent-1',
    }]);
    render(<ProductQuickSearchLauncher user={{ id: 'agent-1', email: 'agent@example.test', role: 'Sales Agent' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Quick Product Search' }));

    fireEvent.change(screen.getByPlaceholderText('Search products...'), { target: { value: 'PART' } });
    const customerSelect = await screen.findByRole('combobox', { name: 'Customer for image export' });
    await waitFor(() => expect(fetchCustomersForDailyCallMock).toHaveBeenCalledWith({ viewerUserId: 'agent-1' }));
    fireEvent.change(customerSelect, { target: { value: 'customer-1' } });

    const imageCheckbox = await screen.findByRole('checkbox', { name: 'Select Sample diesel injector image for export' });
    fireEvent.click(imageCheckbox);

    expect(screen.getByText('1 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'JPG' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'PDF' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'ZIP' })).toBeEnabled();
  });

  it('does not enable exports when the quick-search customer is not assigned to the sales agent', async () => {
    fetchProductsPageMock.mockResolvedValue({ items: [{
      id: 'product-1', part_no: 'PART-1', item_code: 'ITEM-1', description: 'Sample diesel injector', recordImage: 'image-data', stock_wh1: 3,
    }] });
    fetchCustomersForDailyCallMock.mockResolvedValue([{
      id: 'customer-2', shopName: 'Other Customer', assignedAgentId: 'agent-2',
    }]);
    render(<ProductQuickSearchLauncher user={{ id: 'agent-1', email: 'agent@example.test', role: 'Sales Agent' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Quick Product Search' }));

    expect(await screen.findByText('No customers currently assigned to your account were found.')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /image for export/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Choose a customer currently assigned to you to enable image exports/i)).toBeInTheDocument();
  });
});
