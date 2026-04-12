import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ItemIssueReportTab from '../ItemIssueReportTab';

const fetchDailyCallSalesReportsMock = vi.fn();

vi.mock('../../services/dailyCallCustomerDetailService', () => ({
  fetchDailyCallSalesReports: (...args: unknown[]) => fetchDailyCallSalesReportsMock(...args),
}));

const sampleReports = [
  {
    id: 'inq-1',
    date: '2026-04-08',
    time: '02:06:09',
    sales_agent: 'APOSTOL ELLA',
    approval_status: 'pending',
    total_amount: 4000,
    notes: 'Customer needs new injector supply',
    products: [
      { name: 'Injector body', quantity: 1, price: 4000, remark: 'NotListed', partNo: 'P-100', itemCode: '', description: 'Injector body' },
      { name: 'Fuel pump', quantity: 2, price: 2500, remark: 'OutStock', partNo: 'P-200', itemCode: 'IC-200', description: 'Fuel pump' },
    ],
  },
  {
    id: 'inq-2',
    date: '2026-04-09',
    time: '10:30:00',
    sales_agent: 'APOSTOL ELLA',
    approval_status: 'approved',
    total_amount: 2200,
    notes: 'Missing item from product database',
    products: [
      { name: 'Turbo seal kit', quantity: 1, price: 2200, remark: 'NotListed', partNo: '', itemCode: 'TSK-1', description: 'Turbo seal kit' },
    ],
  },
];

describe('ItemIssueReportTab', () => {
  beforeEach(() => {
    fetchDailyCallSalesReportsMock.mockReset();
    fetchDailyCallSalesReportsMock.mockResolvedValue(sampleReports);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders item-not-listed rows by default and switches to no-stock rows', async () => {
    const user = userEvent.setup();
    render(<ItemIssueReportTab contactId="contact-1" />);

    expect(await screen.findByText(/showing/i)).toHaveTextContent('Showing 2 of 2 item not listed row(s)');
    expect(screen.getByRole('button', { name: 'Open item not listed inquiry inq-1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open item not listed inquiry inq-2' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open item no stock inquiry inq-1' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /item no stock/i }));

    await waitFor(() => {
      expect(screen.getByText(/showing/i)).toHaveTextContent('Showing 1 of 1 item no stock row(s)');
    });

    expect(screen.getByRole('button', { name: 'Open item no stock inquiry inq-1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open item not listed inquiry inq-2' })).not.toBeInTheDocument();
  });

  it('dispatches workflow navigation for the selected issue row inquiry', async () => {
    const user = userEvent.setup();
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

    render(<ItemIssueReportTab contactId="contact-1" />);

    await screen.findByRole('button', { name: 'Open item not listed inquiry inq-1' });
    await user.click(screen.getByRole('button', { name: 'Open item not listed inquiry inq-1' }));

    expect(dispatchEventSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'workflow:navigate',
      detail: expect.objectContaining({
        tab: 'salesinquiry',
        payload: expect.objectContaining({
          inquiryId: 'inq-1',
          contactId: 'contact-1',
          openMode: 'existing',
        }),
      }),
    }));

    dispatchEventSpy.mockRestore();
  });
});
