import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SuggestedStockReport from '../SuggestedStockReport';

const {
  fetchSummaryMock,
  fetchCustomersMock,
  addToastMock,
  markAddedToPrMock,
  createPrMock,
  addToKivMock,
  removeFromKivMock,
} = vi.hoisted(() => ({
  fetchSummaryMock: vi.fn(),
  fetchCustomersMock: vi.fn(),
  addToastMock: vi.fn(),
  markAddedToPrMock: vi.fn(),
  createPrMock: vi.fn(),
  addToKivMock: vi.fn(),
  removeFromKivMock: vi.fn(),
}));

vi.mock('../../services/suggestedStockService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/suggestedStockService')>();
  return {
    ...actual,
    fetchSuggestedStockSummaryPage: fetchSummaryMock,
    fetchCustomersWithNotListedInquiries: fetchCustomersMock,
    createPurchaseRequestFromSuggestions: createPrMock,
    markSuggestedStockItemsAddedToPr: markAddedToPrMock,
    clearNotListedRemarks: vi.fn(),
    addSuggestedStockItemsToKiv: addToKivMock,
    removeSuggestedStockItemsFromKiv: removeFromKivMock,
  };
});

vi.mock('../ToastProvider', () => ({
  useToast: () => ({ addToast: addToastMock }),
}));

const item = (id: string, description: string, inquiryCount: number, totalQty = inquiryCount) => ({
  id,
  partNo: `PN-${id}`,
  itemCode: '',
  description,
  brand: '',
  databaseItemId: '',
  databaseItemCode: '',
  databasePartNo: '',
  isListed: false,
  inquiryCount,
  totalQty,
  customerCount: 1,
  customers: [{ id: `customer-${id}`, name: `Customer ${id}` }],
  remark: '',
  lastInquiryDate: '2026-08-20',
  isKiv: false,
  productCreated: false,
  coveringPrId: '',
  coveringPrNumber: '',
});

const qtyDescPage = [
  item('z', 'ZULU PART', 2, 9),
  item('a', 'ALPHA PART', 5, 4),
  item('m', 'MU PART', 1, 1),
];

const descriptionDescPage = [
  item('z', 'ZULU PART', 2, 9),
  item('m', 'MU PART', 1, 1),
  item('a', 'ALPHA PART', 5, 4),
];

const rowOrder = (...labels: string[]) =>
  labels.map((label) => screen.getByText(label).closest('tr'));

describe('SuggestedStockReport filters', () => {
  beforeEach(() => {
    fetchSummaryMock.mockResolvedValue({
      items: qtyDescPage,
      hasMore: false,
    });
    fetchCustomersMock.mockResolvedValue([]);
    createPrMock.mockResolvedValue({ id: 'PRREF-SS', pr_number: 'PR-TEST' });
    markAddedToPrMock.mockResolvedValue(1);
    addToKivMock.mockResolvedValue(1);
    removeFromKivMock.mockResolvedValue(1);
    vi.stubGlobal('IntersectionObserver', class {
      observe() {}
      disconnect() {}
      unobserve() {}
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('opens sorted by highest qty requested and keeps the server row order', async () => {
    render(<SuggestedStockReport />);
    await screen.findByText('ZULU PART');

    await waitFor(() => expect(fetchSummaryMock).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'qty-desc', kivFolder: false }),
      1,
      50
    ));

    const sort = screen.getByRole('combobox', { name: 'Sort suggested stock items' });
    expect(sort).toHaveValue('qty-desc');
    expect(sort).not.toHaveTextContent('KIV folder');
    expect(Array.from((sort as HTMLSelectElement).options).map((option) => option.value)).toEqual([
      'qty-desc',
      'description-asc',
      'inquiries-desc',
      'inquiries-asc',
      'description-desc',
    ]);

    const [zulu, alpha, mu] = rowOrder('ZULU PART', 'ALPHA PART', 'MU PART');
    expect(zulu?.compareDocumentPosition(alpha as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(alpha?.compareDocumentPosition(mu as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('requests description A→Z from the API and renders that server page without re-sorting', async () => {
    render(<SuggestedStockReport />);
    await screen.findByText('ZULU PART');
    fetchSummaryMock.mockClear();
    fetchSummaryMock.mockResolvedValue({
      items: [item('z', 'ZULU PART', 2, 9), item('m', 'MU PART', 1, 1), item('a', 'ALPHA PART', 5, 4)],
      hasMore: false,
    });

    fireEvent.change(screen.getByRole('combobox', { name: 'Sort suggested stock items' }), {
      target: { value: 'description-asc' },
    });

    await waitFor(() => expect(fetchSummaryMock).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'description-asc', kivFolder: false }),
      1,
      50
    ));
    await screen.findByText('ZULU PART');

    const [zulu, mu, alpha] = rowOrder('ZULU PART', 'MU PART', 'ALPHA PART');
    expect(zulu?.compareDocumentPosition(mu as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(mu?.compareDocumentPosition(alpha as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('requests description Z→A from the API and keeps paging on that sort', async () => {
    let notifyIntersect: ((intersecting: boolean) => void) | undefined;
    vi.stubGlobal('IntersectionObserver', class {
      constructor(private readonly callback: IntersectionObserverCallback) {
        notifyIntersect = (intersecting: boolean) => {
          this.callback(
            [{ isIntersecting: intersecting } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver
          );
        };
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    });

    fetchSummaryMock
      .mockResolvedValueOnce({ items: qtyDescPage, hasMore: false })
      .mockResolvedValueOnce({ items: [descriptionDescPage[0], descriptionDescPage[1]], hasMore: true })
      .mockResolvedValueOnce({ items: [descriptionDescPage[2]], hasMore: false });

    render(<SuggestedStockReport />);
    await screen.findByText('ZULU PART');

    fireEvent.change(screen.getByRole('combobox', { name: 'Sort suggested stock items' }), {
      target: { value: 'description-desc' },
    });

    await waitFor(() => expect(fetchSummaryMock).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'description-desc' }),
      1,
      50
    ));
    await screen.findByText('MU PART');
    expect(screen.queryByText('ALPHA PART')).not.toBeInTheDocument();

    notifyIntersect?.(true);

    await waitFor(() => expect(fetchSummaryMock).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'description-desc' }),
      2,
      50
    ));
    await screen.findByText('ALPHA PART');
    const [zulu, mu, alpha] = rowOrder('ZULU PART', 'MU PART', 'ALPHA PART');
    expect(zulu?.compareDocumentPosition(mu as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(mu?.compareDocumentPosition(alpha as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps custom dates editable, blocks an invalid range, and applies a valid range once', async () => {
    render(<SuggestedStockReport />);
    await screen.findByText('ALPHA PART');
    await waitFor(() => expect(fetchSummaryMock).toHaveBeenCalled());
    fetchSummaryMock.mockClear();

    const startDate = screen.getByLabelText('Start date');
    const endDate = screen.getByLabelText('End date');
    const applyFilters = screen.getByRole('button', { name: 'Apply Filters' });

    fireEvent.change(endDate, { target: { value: '2026-09-01' } });
    fireEvent.change(startDate, { target: { value: '2026-09-05' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Start date must be on or before end date.');
    expect(applyFilters).toBeDisabled();
    expect(fetchSummaryMock).not.toHaveBeenCalled();

    fireEvent.change(endDate, { target: { value: '2026-09-10' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(applyFilters).toBeEnabled();
    fireEvent.click(applyFilters);

    await waitFor(() => expect(fetchSummaryMock).toHaveBeenCalledWith(expect.objectContaining({
      dateFrom: '2026-09-05',
      dateTo: '2026-09-10',
    }), 1, 50));
  });

  it('sets This Year from January 1 of the current year through today', async () => {
    render(<SuggestedStockReport />);
    await screen.findByText('ALPHA PART');
    await waitFor(() => expect(fetchSummaryMock).toHaveBeenCalled());
    fetchSummaryMock.mockClear();

    const today = new Date();
    const expectedToday = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-');

    fireEvent.click(screen.getByRole('button', { name: 'This Year' }));

    await waitFor(() => expect(fetchSummaryMock).toHaveBeenCalledWith(expect.objectContaining({
      dateFrom: `${today.getFullYear()}-01-01`,
      dateTo: expectedToday,
    }), 1, 50));
    expect(screen.getByLabelText('Start date')).toHaveValue(`${today.getFullYear()}-01-01`);
    expect(screen.getByLabelText('End date')).toHaveValue(expectedToday);
  });

  it('does not hide loaded rows while typing a part number', async () => {
    render(<SuggestedStockReport />);
    await screen.findByText('ZULU PART');
    fetchSummaryMock.mockClear();

    fireEvent.change(screen.getByRole('textbox', { name: 'Search by part number' }), {
      target: { value: 'PN-a' },
    });

    expect(screen.getByText('ZULU PART')).toBeInTheDocument();
    expect(screen.getByText('ALPHA PART')).toBeInTheDocument();
    expect(fetchSummaryMock).not.toHaveBeenCalled();
  });

  it('searches the full dataset through the API when Enter or Apply Filters is used', async () => {
    render(<SuggestedStockReport />);
    await screen.findByText('ZULU PART');
    fetchSummaryMock.mockClear();
    fetchSummaryMock.mockResolvedValue({ items: [item('a', 'ALPHA PART', 5, 4)], hasMore: false });

    const search = screen.getByRole('textbox', { name: 'Search by part number' });
    fireEvent.change(search, { target: { value: 'PN-a' } });
    fireEvent.keyDown(search, { key: 'Enter' });

    await waitFor(() => expect(fetchSummaryMock).toHaveBeenCalledWith(expect.objectContaining({
      partNo: 'PN-a',
      sortBy: 'qty-desc',
    }), 1, 50));
    await screen.findByText('ALPHA PART');
    expect(screen.queryByText('ZULU PART')).not.toBeInTheDocument();

    fetchSummaryMock.mockClear();
    fetchSummaryMock.mockResolvedValue({ items: [item('z', 'ZULU PART', 2, 9)], hasMore: false });
    fireEvent.change(search, { target: { value: 'PN-z' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply Filters' }));

    await waitFor(() => expect(fetchSummaryMock).toHaveBeenCalledWith(expect.objectContaining({
      partNo: 'PN-z',
    }), 1, 50));
    await screen.findByText('ZULU PART');
    expect(screen.queryByText('ALPHA PART')).not.toBeInTheDocument();
  });

  it('adds only a Product Created selection to a PR with its editable quantity', async () => {
    fetchSummaryMock.mockResolvedValueOnce({
      items: [{ ...item('created', 'CREATED PART', 2, 4), productCreated: true, databaseItemId: 'product-session' }],
      hasMore: false,
    });
    const navigationSpy = vi.fn();
    window.addEventListener('workflow:navigate', navigationSpy);
    render(<SuggestedStockReport />);
    await screen.findByText('CREATED PART');

    expect(screen.getAllByRole('button', { name: /Add Selected Items to PR/i })).toHaveLength(1);
    expect(screen.getByRole('spinbutton', { name: 'PR quantity for PN-created' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select PN-created' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'PR quantity for PN-created' }), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Selected Items to PR \(1\)/i }));

    await waitFor(() => expect(createPrMock).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 'created', databaseItemId: 'product-session' })],
      { created: 7 }
    ));
    expect(markAddedToPrMock).toHaveBeenCalledWith([expect.objectContaining({ id: 'created' })]);
    await waitFor(() => expect(screen.queryByText('CREATED PART')).not.toBeInTheDocument());
    await waitFor(() => expect(navigationSpy).toHaveBeenCalled());
    const navigationEvent = navigationSpy.mock.calls[0][0] as CustomEvent<{
      tab: string;
      payload?: { prId?: string };
    }>;
    expect(navigationEvent.detail).toEqual(expect.objectContaining({
      tab: 'warehouse-purchasing-purchase-request',
      payload: { prId: 'PRREF-SS' },
    }));
    window.removeEventListener('workflow:navigate', navigationSpy);
  });

  it('stays on the report when adding to a PR fails', async () => {
    fetchSummaryMock.mockResolvedValueOnce({
      items: [{ ...item('created', 'CREATED PART', 2, 4), productCreated: true, databaseItemId: 'product-session' }],
      hasMore: false,
    });
    createPrMock.mockRejectedValueOnce(new Error('PR service unavailable'));
    const navigationSpy = vi.fn();
    window.addEventListener('workflow:navigate', navigationSpy);
    render(<SuggestedStockReport />);
    await screen.findByText('CREATED PART');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select PN-created' }));
    fireEvent.click(screen.getByRole('button', { name: /Add Selected Items to PR \(1\)/i }));

    await waitFor(() => expect(addToastMock).toHaveBeenCalledWith(expect.objectContaining({
      type: 'error',
      title: 'Unable to add items to PR',
    })));
    expect(markAddedToPrMock).not.toHaveBeenCalled();
    expect(screen.getByText('CREATED PART')).toBeInTheDocument();
    expect(navigationSpy).not.toHaveBeenCalled();
    window.removeEventListener('workflow:navigate', navigationSpy);
  });

  it('opens the KIV folder as a view without changing the current sort', async () => {
    render(<SuggestedStockReport />);
    await screen.findByText('ALPHA PART');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select PN-a' }));
    fireEvent.click(screen.getByRole('button', { name: /Move selected to KIV folder/i }));

    await waitFor(() => expect(addToKivMock).toHaveBeenCalledWith([
      expect.objectContaining({ partNo: 'PN-a', description: 'ALPHA PART' }),
    ]));

    fetchSummaryMock.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'KIV folder' }));

    await waitFor(() => expect(fetchSummaryMock).toHaveBeenCalledWith(expect.objectContaining({
      kivFolder: true,
      sortBy: 'qty-desc',
    }), 1, 50));
    expect(screen.getByRole('combobox', { name: 'Sort suggested stock items' })).toHaveValue('qty-desc');
    expect(screen.getByText('3 items in KIV folder')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Restore selected from KIV/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select PN-a' }));
    fireEvent.click(screen.getByRole('button', { name: /Restore selected from KIV/i }));

    await waitFor(() => expect(removeFromKivMock).toHaveBeenCalledWith([
      expect.objectContaining({ partNo: 'PN-a', description: 'ALPHA PART' }),
    ]));
  });

  it('opens Cart folder as a review-only view of items already on a Purchase Request', async () => {
    fetchSummaryMock.mockResolvedValue({
      items: [{
        ...item('created', 'CREATED PART', 2, 4),
        productCreated: true,
        coveringPrId: 'PRREF-CART',
        coveringPrNumber: 'PR-CART-1',
      }],
      hasMore: false,
    });
    const navigationSpy = vi.fn();
    window.addEventListener('workflow:navigate', navigationSpy);
    render(<SuggestedStockReport />);
    await screen.findByText('CREATED PART');

    fireEvent.click(screen.getByRole('button', { name: 'Cart folder' }));

    await waitFor(() => expect(fetchSummaryMock).toHaveBeenCalledWith(expect.objectContaining({
      cartFolder: true,
      kivFolder: false,
      sortBy: 'qty-desc',
    }), 1, 50));

    expect(screen.getByText(/item in Cart folder/i)).toBeInTheDocument();
    expect(screen.getByText('PR-CART-1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add Selected Items to PR/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Move selected to KIV folder/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Select PN-created' })).not.toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: 'PR quantity for PN-created' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open PR-CART-1' }));
    expect(navigationSpy).toHaveBeenCalled();
    const navigationEvent = navigationSpy.mock.calls[0][0] as CustomEvent<{
      tab: string;
      payload?: { prId?: string };
    }>;
    expect(navigationEvent.detail).toEqual(expect.objectContaining({
      tab: 'warehouse-purchasing-purchase-request',
      payload: { prId: 'PRREF-CART' },
    }));

    fireEvent.click(screen.getByRole('button', { name: 'KIV folder' }));
    await waitFor(() => expect(fetchSummaryMock).toHaveBeenCalledWith(expect.objectContaining({
      kivFolder: true,
      cartFolder: false,
    }), 1, 50));
    window.removeEventListener('workflow:navigate', navigationSpy);
  });
});
