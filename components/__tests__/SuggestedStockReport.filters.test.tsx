import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SuggestedStockReport from '../SuggestedStockReport';

const {
  fetchSummaryMock,
  fetchDetailsMock,
  fetchCustomersMock,
  getPurchaseRequestsMock,
} = vi.hoisted(() => ({
  fetchSummaryMock: vi.fn(),
  fetchDetailsMock: vi.fn(),
  fetchCustomersMock: vi.fn(),
  getPurchaseRequestsMock: vi.fn(),
}));

vi.mock('../../services/suggestedStockService', () => ({
  fetchSuggestedStockSummary: fetchSummaryMock,
  fetchSuggestedStockDetails: fetchDetailsMock,
  fetchCustomersWithNotListedInquiries: fetchCustomersMock,
  createPurchaseRequestFromSuggestions: vi.fn(),
}));

vi.mock('../../services/purchaseRequestService', () => ({
  purchaseRequestService: {
    getPurchaseRequests: getPurchaseRequestsMock,
  },
}));

vi.mock('../ToastProvider', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

const item = (id: string, description: string, inquiryCount: number, isListed: boolean) => ({
  id,
  partNo: `PN-${id}`,
  itemCode: '',
  description,
  brand: '',
  databaseItemCode: isListed ? `ITEM-${id}` : '',
  databasePartNo: isListed ? `DB-${id}` : '',
  isListed,
  inquiryCount,
  totalQty: inquiryCount,
  customerCount: 1,
  customers: [{ id: `customer-${id}`, name: `Customer ${id}` }],
  remark: '',
  lastInquiryDate: '2026-08-20',
});

describe('SuggestedStockReport filters', () => {
  beforeEach(() => {
    fetchSummaryMock.mockResolvedValue([
      item('z', 'ZULU PART', 2, true),
      item('a', 'ALPHA PART', 5, false),
      item('m', 'MU PART', 1, false),
    ]);
    fetchDetailsMock.mockResolvedValue([]);
    fetchCustomersMock.mockResolvedValue([]);
    getPurchaseRequestsMock.mockResolvedValue([]);
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

  it('sorts by description or customer-request count and filters listing status', async () => {
    render(<SuggestedStockReport />);
    await screen.findByText('ALPHA PART');

    const sort = screen.getByRole('combobox', { name: 'Sort suggested stock items' });
    const status = screen.getByRole('combobox', { name: 'Filter by listing status' });

    fireEvent.change(sort, { target: { value: 'description-asc' } });
    const alphaRow = screen.getByText('ALPHA PART').closest('tr');
    const muRow = screen.getByText('MU PART').closest('tr');
    const zuluRow = screen.getByText('ZULU PART').closest('tr');
    expect(alphaRow?.compareDocumentPosition(muRow as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(muRow?.compareDocumentPosition(zuluRow as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.change(sort, { target: { value: 'inquiries-desc' } });
    expect(screen.getByText('ALPHA PART').closest('tr')?.compareDocumentPosition(screen.getByText('ZULU PART').closest('tr') as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.change(status, { target: { value: 'listed' } });
    expect(screen.getByText('ZULU PART')).toBeInTheDocument();
    expect(screen.queryByText('ALPHA PART')).not.toBeInTheDocument();
    expect(screen.queryByText('MU PART')).not.toBeInTheDocument();

    fireEvent.change(status, { target: { value: 'not-listed' } });
    expect(screen.queryByText('ZULU PART')).not.toBeInTheDocument();
    expect(screen.getByText('ALPHA PART')).toBeInTheDocument();
    expect(screen.getByText('MU PART')).toBeInTheDocument();
  });

  it('keeps custom dates editable, blocks an invalid range, and applies a valid range once', async () => {
    render(<SuggestedStockReport />);
    await screen.findByText('ALPHA PART');
    await waitFor(() => expect(fetchSummaryMock).toHaveBeenCalled());
    fetchSummaryMock.mockClear();

    const startDate = screen.getByLabelText('Start date');
    const endDate = screen.getByLabelText('End date');
    const applyDates = screen.getByRole('button', { name: 'Apply Dates' });

    fireEvent.change(startDate, { target: { value: '2026-09-02' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Start date must be on or before end date.');
    expect(applyDates).toBeDisabled();
    expect(fetchSummaryMock).not.toHaveBeenCalled();

    fireEvent.change(endDate, { target: { value: '2026-09-05' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(applyDates).toBeEnabled();
    fireEvent.click(applyDates);

    await waitFor(() => expect(fetchSummaryMock).toHaveBeenCalledWith(expect.objectContaining({
      dateFrom: '2026-09-02',
      dateTo: '2026-09-05',
    })));
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
    })));
    expect(screen.getByLabelText('Start date')).toHaveValue(`${today.getFullYear()}-01-01`);
    expect(screen.getByLabelText('End date')).toHaveValue(expectedToday);
  });
});
