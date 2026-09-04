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

vi.mock('../../services/suggestedStockService', () => ({
  fetchSuggestedStockSummaryPage: fetchSummaryMock,
  fetchCustomersWithNotListedInquiries: fetchCustomersMock,
  createPurchaseRequestFromSuggestions: createPrMock,
  markSuggestedStockItemsAddedToPr: markAddedToPrMock,
  clearNotListedRemarks: vi.fn(),
  addSuggestedStockItemsToKiv: addToKivMock,
  removeSuggestedStockItemsFromKiv: removeFromKivMock,
}));

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
});

describe('SuggestedStockReport filters', () => {
  beforeEach(() => {
    fetchSummaryMock.mockResolvedValue({
      items: [
        item('z', 'ZULU PART', 2, 9),
        item('a', 'ALPHA PART', 5, 4),
        item('m', 'MU PART', 1, 1),
      ],
      hasMore: false,
    });
    fetchCustomersMock.mockResolvedValue([]);
    createPrMock.mockResolvedValue({ pr_number: 'PR-TEST' });
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

  it('sorts by description or customer-request count for unlisted items only', async () => {
    render(<SuggestedStockReport />);
    await screen.findByText('ALPHA PART');

    expect(screen.queryByRole('combobox', { name: 'Filter by listing status' })).not.toBeInTheDocument();
    expect(screen.queryByText('Create PR for Selected')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Create/i }).length).toBeGreaterThan(0);

    const sort = screen.getByRole('combobox', { name: 'Sort suggested stock items' });

    fireEvent.change(sort, { target: { value: 'description-asc' } });
    const alphaRow = screen.getByText('ALPHA PART').closest('tr');
    const muRow = screen.getByText('MU PART').closest('tr');
    const zuluRow = screen.getByText('ZULU PART').closest('tr');
    expect(alphaRow?.compareDocumentPosition(muRow as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(muRow?.compareDocumentPosition(zuluRow as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.change(sort, { target: { value: 'inquiries-desc' } });
    expect(screen.getByText('ALPHA PART').closest('tr')?.compareDocumentPosition(screen.getByText('ZULU PART').closest('tr') as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.change(sort, { target: { value: 'qty-desc' } });
    expect(screen.getByText('ZULU PART').closest('tr')?.compareDocumentPosition(screen.getByText('ALPHA PART').closest('tr') as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

  it('searches by part number and requests matching rows from the report API', async () => {
    render(<SuggestedStockReport />);
    await screen.findByText('ALPHA PART');
    await waitFor(() => expect(fetchSummaryMock).toHaveBeenCalled());
    fetchSummaryMock.mockClear();

    const search = screen.getByRole('textbox', { name: 'Search by part number' });
    fireEvent.change(search, { target: { value: 'PN-a' } });
    fireEvent.keyDown(search, { key: 'Enter' });

    await waitFor(() => expect(fetchSummaryMock).toHaveBeenCalledWith(expect.objectContaining({
      partNo: 'PN-a',
    }), 1, 50));
    expect(screen.queryByText('ZULU PART')).not.toBeInTheDocument();
    expect(screen.getByText('ALPHA PART')).toBeInTheDocument();
  });

  it('adds only a Product Created selection to a PR with its editable quantity', async () => {
    fetchSummaryMock.mockResolvedValueOnce({
      items: [{ ...item('created', 'CREATED PART', 2, 4), productCreated: true, databaseItemId: 'product-session' }],
      hasMore: false,
    });
    render(<SuggestedStockReport />);
    await screen.findByText('CREATED PART');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select PN-created' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'PR quantity for PN-created' }), { target: { value: '7' } });
    fireEvent.click(screen.getAllByRole('button', { name: /Add Selected Items to PR \(1\)/i })[0]);

    await waitFor(() => expect(createPrMock).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 'created', databaseItemId: 'product-session' })],
      { created: 7 }
    ));
    expect(markAddedToPrMock).toHaveBeenCalledWith([expect.objectContaining({ id: 'created' })]);
    await waitFor(() => expect(screen.queryByText('CREATED PART')).not.toBeInTheDocument());
  });

  it('moves selected items into the KIV folder and can open that folder', async () => {
    render(<SuggestedStockReport />);
    await screen.findByText('ALPHA PART');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select PN-a' }));
    fireEvent.click(screen.getByRole('button', { name: /Move selected to KIV folder/i }));

    await waitFor(() => expect(addToKivMock).toHaveBeenCalledWith([
      expect.objectContaining({ partNo: 'PN-a', description: 'ALPHA PART' }),
    ]));

    const sort = screen.getByRole('combobox', { name: 'Sort suggested stock items' });
    fireEvent.change(sort, { target: { value: 'kiv-folder' } });

    await waitFor(() => expect(fetchSummaryMock).toHaveBeenCalledWith(expect.objectContaining({
      kivFolder: true,
    }), 1, 50));
    expect(screen.getByText('3 items in KIV folder')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Restore selected from KIV/i })).toBeInTheDocument();
  });
});
