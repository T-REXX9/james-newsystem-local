import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PurchaseHistoryReportView from '../PurchaseHistoryReportView';

const getCustomersMock = vi.fn();
const getReportMock = vi.fn();
vi.mock('../../services/purchaseHistoryReportService', () => ({ purchaseHistoryReportService: { getCustomers: (...args: unknown[]) => getCustomersMock(...args), getReport: (...args: unknown[]) => getReportMock(...args) } }));

const report = {
  customer_session: 'customer-1', date_from: '2026-01-01', date_to: '2026-01-31', generated_at: '',
  customer: { company: '3R MAN CALIBRATION', old_name: '', customer_since: '2014-11-19', vip_status: '', price_code: 'VIP2', current_month_sales: 0, outstanding_balance: 0, terms: '30 DAYS', credit_limit: 20000, agent_name: 'APOSTOL' },
  items: [{ source_type: 'INVOICE', source_refno: 'ref-1', source_no: 'D21264', ldate: '2026-01-03', litemcode: 'QKM2-024A', lpartno: 'P-6201ZZ', ldesc: 'BEARING', lbrand: '', lqty: 10, lprice: 25, return_qty: 2, net_qty: 8, line_total: 200 }],
  pagination: { page: 1, per_page: 50, has_more: false },
};

describe('PurchaseHistoryReportView', () => {
  beforeEach(() => { vi.clearAllMocks(); getCustomersMock.mockResolvedValue([{ sessionId: 'customer-1', company: '3R MAN CALIBRATION', customerCode: 'C-001' }]); getReportMock.mockResolvedValue(report); });

  it('uses the legacy customer/date form and only generates after an explicit request', async () => {
    render(<PurchaseHistoryReportView />);
    expect(screen.getByText(/Fields marked with/)).toBeInTheDocument();
    expect(screen.getByText('Generate Report')).toBeInTheDocument();
    expect(getReportMock).not.toHaveBeenCalled();
    const customerInput = screen.getByPlaceholderText('Search customer...');
    fireEvent.focus(customerInput);
    fireEvent.change(customerInput, { target: { value: '3R' } });
    await waitFor(() => expect(screen.getByText('3R MAN CALIBRATION')).toBeInTheDocument());
    fireEvent.click(screen.getByText('3R MAN CALIBRATION'));
    fireEvent.click(screen.getByText('Generate Report'));
    expect(await screen.findByText('D21264')).toBeInTheDocument();
    expect(screen.getByText('GRAND TOTAL =>')).toBeInTheDocument();
    expect(screen.getByText('Item Total: 1')).toBeInTheDocument();
    expect(getReportMock).toHaveBeenCalledWith(expect.objectContaining({ customerId: 'customer-1', page: 1, perPage: 50 }));
  });

  it('shows custom dates only for Custom Date coverage', async () => {
    render(<PurchaseHistoryReportView />);
    const dateType = screen.getAllByRole('combobox')[0];
    fireEvent.change(dateType, { target: { value: 'custom' } });
    expect(screen.getByText(/Date From/)).toBeInTheDocument();
    expect(screen.getByText(/Date To/)).toBeInTheDocument();
  });
});
