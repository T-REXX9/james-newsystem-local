import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import SalesReportTab from '../SalesReportTab';

const fetchDailyCallSalesReportsMock = vi.fn();

vi.mock('../../services/dailyCallCustomerDetailService', () => ({
  fetchDailyCallSalesReports: (...args: unknown[]) => fetchDailyCallSalesReportsMock(...args),
}));

const sampleReports = [
  {
    id: 'rep-1',
    date: '2025-10-13',
    time: '16:57:35',
    sales_agent: 'Agent 51',
    approval_status: 'pending',
    total_amount: 38000,
    notes: 'First inquiry',
    products: [
      { name: 'Brake Pad', quantity: 2, price: 5000 },
      { name: 'Oil Filter', quantity: 1, price: 1500 },
    ],
  },
  {
    id: 'rep-2',
    date: '2025-11-07',
    time: '11:55:58',
    sales_agent: 'Agent 51',
    approval_status: 'approved',
    total_amount: 12000,
    notes: 'Follow-up inquiry',
    products: [
      { name: 'Spark Plug', quantity: 4, price: 750 },
      { name: 'brake pad', quantity: 1, price: 5200 },
    ],
  },
  {
    id: 'rep-3',
    date: '2025-12-01',
    time: '08:15:00',
    sales_agent: 'Agent 99',
    approval_status: 'rejected',
    total_amount: 8800,
    notes: 'December inquiry',
    products: [
      { name: 'Alternator', quantity: 1, price: 8800 },
    ],
  },
];

describe('SalesReportTab', () => {
  beforeEach(() => {
    fetchDailyCallSalesReportsMock.mockReset();
    fetchDailyCallSalesReportsMock.mockResolvedValue(sampleReports);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders fetched reports and builds deduplicated product dropdown options', async () => {
    render(<SalesReportTab contactId="contact-1" />);

    expect(await screen.findByText(/showing/i)).toHaveTextContent('Showing 3 of 3 report(s)');
    expect(screen.getByText('First inquiry')).toBeInTheDocument();
    expect(screen.getByText('Follow-up inquiry')).toBeInTheDocument();
    expect(screen.getByText('December inquiry')).toBeInTheDocument();

    const productSelect = screen.getByLabelText('Product') as HTMLSelectElement;
    const optionLabels = Array.from(productSelect.options).map((option) => option.text);

    expect(optionLabels).toEqual([
      'All products',
      'Alternator',
      'Brake Pad',
      'Oil Filter',
      'Spark Plug',
    ]);
  });

  it('filters reports by Date From inclusively', async () => {
    const user = userEvent.setup();
    render(<SalesReportTab contactId="contact-1" />);

    await screen.findByText('December inquiry');
    await user.type(screen.getByLabelText('Date From'), '2025-11-07');

    await waitFor(() => {
      expect(screen.getByText(/showing/i)).toHaveTextContent('Showing 2 of 3 report(s)');
    });

    expect(screen.queryByText('First inquiry')).not.toBeInTheDocument();
    expect(screen.getByText('Follow-up inquiry')).toBeInTheDocument();
    expect(screen.getByText('December inquiry')).toBeInTheDocument();
  });

  it('filters reports by Date To inclusively', async () => {
    const user = userEvent.setup();
    render(<SalesReportTab contactId="contact-1" />);

    await screen.findByText('December inquiry');
    await user.type(screen.getByLabelText('Date To'), '2025-11-07');

    await waitFor(() => {
      expect(screen.getByText(/showing/i)).toHaveTextContent('Showing 2 of 3 report(s)');
    });

    expect(screen.getByText('First inquiry')).toBeInTheDocument();
    expect(screen.getByText('Follow-up inquiry')).toBeInTheDocument();
    expect(screen.queryByText('December inquiry')).not.toBeInTheDocument();
  });

  it('filters reports by selected product with case-insensitive matching', async () => {
    const user = userEvent.setup();
    render(<SalesReportTab contactId="contact-1" />);

    await screen.findByText('December inquiry');
    await user.selectOptions(screen.getByLabelText('Product'), 'Brake Pad');

    await waitFor(() => {
      expect(screen.getByText(/showing/i)).toHaveTextContent('Showing 2 of 3 report(s)');
    });

    expect(screen.getByText('First inquiry')).toBeInTheDocument();
    expect(screen.getByText('Follow-up inquiry')).toBeInTheDocument();
    expect(screen.queryByText('December inquiry')).not.toBeInTheDocument();
  });

  it('combines date and product filters and can clear them', async () => {
    const user = userEvent.setup();
    render(<SalesReportTab contactId="contact-1" />);

    await screen.findByText('December inquiry');
    await user.type(screen.getByLabelText('Date From'), '2025-11-01');
    await user.selectOptions(screen.getByLabelText('Product'), 'Brake Pad');

    await waitFor(() => {
      expect(screen.getByText(/showing/i)).toHaveTextContent('Showing 1 of 3 report(s)');
    });

    expect(screen.queryByText('First inquiry')).not.toBeInTheDocument();
    expect(screen.getByText('Follow-up inquiry')).toBeInTheDocument();
    expect(screen.queryByText('December inquiry')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /clear filters/i }));

    await waitFor(() => {
      expect(screen.getByText(/showing/i)).toHaveTextContent('Showing 3 of 3 report(s)');
    });

    expect(screen.getByText('First inquiry')).toBeInTheDocument();
    expect(screen.getByText('Follow-up inquiry')).toBeInTheDocument();
    expect(screen.getByText('December inquiry')).toBeInTheDocument();
  });

  it('shows the filtered empty state when no report matches', async () => {
    const user = userEvent.setup();
    render(<SalesReportTab contactId="contact-1" />);

    await screen.findByText('December inquiry');
    await user.type(screen.getByLabelText('Date From'), '2026-01-01');

    await waitFor(() => {
      expect(screen.getByText(/showing/i)).toHaveTextContent('Showing 0 of 3 report(s)');
    });

    expect(screen.getByText('No sales inquiry reports match the selected filters.')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting the date range or choosing a different product.')).toBeInTheDocument();
  });

  it('dispatches workflow navigation for the exact inquiry when a report item is clicked', async () => {
    const user = userEvent.setup();
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

    render(<SalesReportTab contactId="contact-1" />);

    await screen.findByText('December inquiry');
    await user.click(screen.getByRole('button', { name: 'Open sales inquiry report rep-2' }));

    expect(dispatchEventSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'workflow:navigate',
      detail: expect.objectContaining({
        tab: 'salesinquiry',
        payload: expect.objectContaining({
          inquiryId: 'rep-2',
          contactId: 'contact-1',
          openMode: 'existing',
        }),
      }),
    }));

    dispatchEventSpy.mockRestore();
  });
});
