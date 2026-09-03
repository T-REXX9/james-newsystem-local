import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SuggestedStockReport from '../SuggestedStockReport';

const {
  fetchSummaryMock,
  fetchCustomersMock,
  addToastMock,
} = vi.hoisted(() => ({
  fetchSummaryMock: vi.fn(),
  fetchCustomersMock: vi.fn(),
  addToastMock: vi.fn(),
}));

vi.mock('../../services/suggestedStockService', () => ({
  fetchSuggestedStockSummaryPage: fetchSummaryMock,
  fetchCustomersWithNotListedInquiries: fetchCustomersMock,
  createPurchaseRequestFromSuggestions: vi.fn(),
  clearNotListedRemarks: vi.fn(),
}));

vi.mock('../ToastProvider', () => ({
  useToast: () => ({ addToast: addToastMock }),
}));

const item = (id: string, description: string, inquiryCount: number) => ({
  id,
  partNo: `PN-${id}`,
  itemCode: '',
  description,
  brand: '',
  databaseItemCode: '',
  databasePartNo: '',
  isListed: false,
  inquiryCount,
  totalQty: inquiryCount,
  customerCount: 1,
  customers: [{ id: `customer-${id}`, name: `Customer ${id}` }],
  remark: '',
  lastInquiryDate: '2026-08-20',
});

describe('SuggestedStockReport filters', () => {
  beforeEach(() => {
    fetchSummaryMock.mockResolvedValue({
      items: [
        item('z', 'ZULU PART', 2),
        item('a', 'ALPHA PART', 5),
        item('m', 'MU PART', 1),
      ],
      hasMore: false,
    });
    fetchCustomersMock.mockResolvedValue([]);
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
});
