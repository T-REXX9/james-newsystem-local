import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import InquiryReportView from '../InquiryReportView';

const getReportMock = vi.fn();

vi.mock('../../services/inquiryReportLocalApiService', () => ({
  inquiryReportLocalApiService: {
    getReport: (...args: unknown[]) => getReportMock(...args),
  },
}));

describe('InquiryReportView', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    getReportMock.mockResolvedValue({
      items: [
        { id: '1', inquiry_refno: 'inq-ref-1', inquiry_no: 'INQ-1', customer_id: 'cust-1', customer_company: 'Converted Customer', sales_date: '2026-10-02', created_at: '2026-10-02 10:00:00', grand_total: 100, converted_to_order: true, items: [] },
        { id: '2', inquiry_refno: 'inq-ref-2', inquiry_no: 'INQ-2', customer_id: 'cust-2', customer_company: 'Open Customer', sales_date: '2026-10-02', created_at: '2026-10-02 11:00:00', grand_total: 50, converted_to_order: false, items: [] },
      ],
    });
  });

  it('shows whether each inquiry has been converted into a sales order', async () => {
    render(
      <InquiryReportView
        filters={{ reportType: 'today', dateFrom: '2026-10-02', dateTo: '2026-10-02', customerId: 'all' }}
        onBack={vi.fn()}
      />,
    );

    const summary = await screen.findByRole('region', { name: /inquiry conversion summary/i });
    expect(within(summary).getByText('Total inquiries').nextElementSibling?.textContent).toBe('2');
    expect(within(summary).getByText('Converted to orders').nextElementSibling?.textContent).toBe('1');
    expect(within(summary).getByText('Not converted').nextElementSibling?.textContent).toBe('1');

    const table = await screen.findByRole('table');
    expect(within(table).getByRole('columnheader', { name: /converted to order/i })).toBeInTheDocument();
    await waitFor(() => expect(within(table).getByText('Yes')).toBeInTheDocument());
    expect(within(table).getByText('No')).toBeInTheDocument();
  });

  it('opens the selected customer and exact sales inquiry from their report links', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    render(
      <InquiryReportView
        filters={{ reportType: 'today', dateFrom: '2026-10-02', dateTo: '2026-10-02', customerId: 'all' }}
        onBack={vi.fn()}
      />,
    );

    const customerLink = await screen.findByRole('link', { name: 'Converted Customer' });
    const inquiryLink = screen.getByRole('link', { name: 'INQ-1' });
    expect(customerLink).toHaveAttribute('href', '#/sales-database-customer-database?contactId=cust-1');
    expect(inquiryLink).toHaveAttribute('href', '#/sales-transaction-sales-inquiry?inquiryId=inq-ref-1');

    fireEvent.click(customerLink);
    fireEvent.click(inquiryLink);

    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'workflow:navigate',
      detail: expect.objectContaining({
        tab: 'sales-database-customer-database',
        payload: { contactId: 'cust-1' },
      }),
    }));
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'workflow:navigate',
      detail: expect.objectContaining({
        tab: 'sales-transaction-sales-inquiry',
        payload: { inquiryId: 'inq-ref-1' },
      }),
    }));
  });

  it('keeps the conversion column aligned with expanded detail rows', async () => {
    render(
      <InquiryReportView
        filters={{ reportType: 'today', dateFrom: '2026-10-02', dateTo: '2026-10-02', customerId: 'all' }}
        onBack={vi.fn()}
      />,
    );

    await screen.findByRole('columnheader', { name: /converted to order/i });
    fireEvent.click(screen.getByRole('button', { name: 'Detailed' }));

    await waitFor(() => expect(document.querySelector('td[colspan="7"]')).toBeInTheDocument());
    expect(screen.getAllByRole('table').length).toBeGreaterThan(1);
  });
});
