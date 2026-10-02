import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OwnerDailyCallMonitoringUnifiedView from '../OwnerDailyCallMonitoringUnifiedView';

const getSalesReportDataMock = vi.fn();
const fetchDailyCallMasterListMock = vi.fn().mockResolvedValue({ items: [] });
const fetchDailyCallSalesColorBreakdownMock = vi.fn().mockResolvedValue({
  month: '2026-10', company_total: 0, agents: [],
  unassigned: { id: '', name: 'Unassigned', customer_count: 0, sales: 0, unclassified_sales: 0, colors: {
    green: { customer_count: 0, sales: 0 }, yellow: { customer_count: 0, sales: 0 },
    purple: { customer_count: 0, sales: 0 }, white: { customer_count: 0, sales: 0 }, red: { customer_count: 0, sales: 0 },
  } },
});

vi.mock('../DailyCallMasterListView', () => ({
  default: () => <div data-testid="master-list-view">Master List View</div>,
}));

vi.mock('../../services/dailyCallMonitoringService', () => ({
  fetchDailyCallMasterList: (...args: unknown[]) => fetchDailyCallMasterListMock(...args),
  fetchDailyCallSalesColorBreakdown: (...args: unknown[]) => fetchDailyCallSalesColorBreakdownMock(...args),
}));

vi.mock('../../services/salesReportService', () => ({
  getSalesReportData: (...args: unknown[]) => getSalesReportDataMock(...args),
}));

describe('OwnerDailyCallMonitoringUnifiedView', () => {
  afterEach(() => {
    cleanup();
    getSalesReportDataMock.mockReset();
    fetchDailyCallMasterListMock.mockClear();
    fetchDailyCallSalesColorBreakdownMock.mockClear();
  });

  it('renders the Daily Call Monitoring master list by default', () => {
    getSalesReportDataMock.mockResolvedValue({ summary: { grandTotal: { total: 0 } } });
    render(<OwnerDailyCallMonitoringUnifiedView currentUser={null} />);

    expect(screen.getByTestId('master-list-view')).toBeInTheDocument();
    expect(screen.queryByText('Team sales by Daily Call status')).not.toBeInTheDocument();
    expect(fetchDailyCallSalesColorBreakdownMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /purchase follow-up/i })).not.toBeInTheDocument();
  });

  it('does not render the removed owner workspace toolbar', () => {
    getSalesReportDataMock.mockResolvedValue({ summary: { grandTotal: { total: 0 } } });
    render(<OwnerDailyCallMonitoringUnifiedView currentUser={null} />);

    expect(screen.queryByRole('navigation', { name: /owner dashboard views/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist', { name: /daily call monitoring views/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Owner workspace')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /operations dashboard/i })).not.toBeInTheDocument();
  });

  it('uses the Sales Report monthly total instead of master-list sales totals', async () => {
    getSalesReportDataMock.mockResolvedValue({ summary: { grandTotal: { total: 45678 } } });

    render(<OwnerDailyCallMonitoringUnifiedView currentUser={null} />);

    expect(await screen.findByText('₱45,678')).toBeInTheDocument();
    expect(getSalesReportDataMock).toHaveBeenCalledWith(expect.objectContaining({ customerId: 'all' }));
    expect(fetchDailyCallMasterListMock).toHaveBeenCalledWith({ fromDate: '2025-10-01', forceRefresh: true });
  });

  it('opens the month sales breakdown with ranked agents, customers, and products', async () => {
    const user = userEvent.setup();
    getSalesReportDataMock.mockResolvedValue({
      transactions: [
        { customerId: 'cust-1', customer: 'Top Customer', drAmount: 800, invoiceAmount: 200 },
        { customerId: 'cust-2', customer: 'Second Customer', drAmount: 500, invoiceAmount: 0 },
      ],
      summary: {
        grandTotal: { soAmount: 0, drAmount: 1300, invoiceAmount: 200, total: 1500 },
        salespersonTotals: [
          { salesperson: 'Leading Agent', categories: [], total: 1200 },
          { salesperson: 'Second Agent', categories: [], total: 300 },
        ],
        productTotals: [
          { product: 'Leading Product', itemCode: 'P-1', partNo: 'PART-1', brand: 'Brand A', total: 900 },
          { product: 'Second Product', itemCode: 'P-2', partNo: 'PART-2', brand: 'Brand B', total: 600 },
        ],
      },
    });

    render(<OwnerDailyCallMonitoringUnifiedView currentUser={null} />);
    const salesCard = await screen.findByRole('button', { name: /open current month sales breakdown/i });
    await user.click(salesCard);

    const dialog = screen.getByRole('dialog', { name: 'Current Month Sales Breakdown' });
    expect(dialog).toHaveTextContent('₱1,500');
    expect(dialog).toHaveTextContent('Leading Agent');
    expect(dialog).toHaveTextContent('Top Customer');
    expect(dialog).toHaveTextContent('Leading Product');
    expect(await screen.findByText('Team sales by Daily Call status')).toBeInTheDocument();
    expect(fetchDailyCallSalesColorBreakdownMock).toHaveBeenCalledTimes(1);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Team sales by Daily Call status')).not.toBeInTheDocument();
    expect(salesCard).toHaveFocus();
  });

  it('keeps keyboard focus within the sales breakdown dialog and exposes its retry control', async () => {
    const user = userEvent.setup();
    getSalesReportDataMock.mockResolvedValue({
      summary: { grandTotal: { total: 0 }, salespersonTotals: [], productTotals: [] },
      transactions: [],
    });
    fetchDailyCallSalesColorBreakdownMock.mockRejectedValueOnce(new Error('Request failed'));

    render(<OwnerDailyCallMonitoringUnifiedView currentUser={null} />);
    await user.click(await screen.findByRole('button', { name: /open current month sales breakdown/i }));
    const closeButton = await screen.findByRole('button', { name: /close sales breakdown/i });
    const retryButton = await screen.findByRole('button', { name: /retry/i });

    closeButton.focus();
    await user.tab();
    expect(retryButton).toHaveFocus();
    await user.tab();
    expect(closeButton).toHaveFocus();
    await user.keyboard('{Escape}');
  });
});
