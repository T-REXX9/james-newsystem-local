import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OperationsDashboard from '../OperationsDashboard';
import { toLocalDateInputValue } from '../../services/operationsDashboardService';

const fetchSnapshotMock = vi.fn();
vi.mock('../../services/operationsDashboardService', () => ({
  fetchOperationsDashboardSnapshot: (...args: unknown[]) => fetchSnapshotMock(...args),
  toLocalDateInputValue: (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },
}));

const snapshot = {
  orders: { inquiries: 2, orders: 1, open: 1, cancelled: 1, previousInquiries: 1, previousOrders: 1, previousOpen: 1, previousCancelled: 0 },
  calls: { incoming: 2, outgoing: 2, missed: 0, returned: 0, unanswered: 1, averageResponseSeconds: 60 },
  callDetails: [
    { id: 'call-1', occurredAt: '2026-08-25T01:29:28.000Z', direction: 'inbound', durationSeconds: 60, phoneNumber: '+639171234567', agentName: 'Call Test', customerId: '301', customerName: 'Acme Store', customerCode: 'C-301' },
    { id: 'call-2', occurredAt: '2026-08-25T01:28:49.000Z', direction: 'inbound', durationSeconds: 17, phoneNumber: '+639189876543', agentName: 'Call Test' },
  ],
  delivery: { ready: 1, shipped: 1, inTransit: 0, delivered: 1, delayed: 0, failed: 0, total: 2 },
  lbcRto: { total: 1, delivered: 1, rto: 0, refused: 0, wrongAddress: 0, unclaimed: 0 },
  returns: { requests: 1, inspection: 0, approved: 1, disapproved: 0, replacement: 0, refunded: 0 },
  collections: { total: 100, sales: 200, rate: 50, previousChange: 0, today: 25 },
  receivables: { total: 300, current: 100, days31to60: 100, days61to90: 50, over90: 50 },
  activities: [{ id: '1', time: '10:00 AM', activity: 'Created', description: 'Sales Inquiry — Create', reference: 'INQ-1', by: 'James', route: 'sales-transaction-sales-inquiry', payload: { inquiryId: 'INQ-1' } }],
  unavailable: [],
};

describe('OperationsDashboard', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  const expectedPeriod = () => {
    const date = new Date();
    const dashboardDate = toLocalDateInputValue(date);
    const dashboardMonth = String(date.getMonth() + 1).padStart(2, '0');
    const dashboardYear = String(date.getFullYear());
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return {
      dashboardDate,
      dashboardMonth,
      dashboardYear,
      dashboardMonthStart: `${dashboardYear}-${dashboardMonth}-01`,
      dashboardMonthEnd: `${dashboardYear}-${dashboardMonth}-${String(monthEnd.getDate()).padStart(2, '0')}`,
    };
  };

  it('renders the client reference sections and links every operational path', async () => {
    fetchSnapshotMock.mockResolvedValue(snapshot);
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    render(<OperationsDashboard onNavigate={onNavigate} />);

    expect(await screen.findByText('1. Order Overview (This Month)')).toBeInTheDocument();
    expect(screen.getByText('2. Call Overview (Selected Date)')).toBeInTheDocument();
    expect(screen.getByText('7. Receivables Overview (As of Selected Date)')).toBeInTheDocument();

    const period = expectedPeriod();
    await user.click(screen.getByRole('button', { name: /New Inquiry/ }));
    expect(onNavigate).toHaveBeenLastCalledWith('sales-transaction-sales-inquiry', expect.objectContaining(period));
    await user.click(screen.getByRole('button', { name: /Incoming Calls/ }));
    const callDialog = screen.getByRole('dialog', { name: 'Incoming Calls' });
    expect(within(callDialog).getByText('Acme Store')).toBeInTheDocument();
    expect(within(callDialog).getByText('+639171234567')).toBeInTheDocument();
    expect(within(callDialog).getByText('+639189876543')).toBeInTheDocument();
    expect(within(callDialog).getByText('Saved customer')).toBeInTheDocument();
    expect(within(callDialog).getByText('Unsaved number')).toBeInTheDocument();
    await user.click(within(callDialog).getByRole('button', { name: 'Close call breakdown' }));
    await user.click(screen.getByRole('button', { name: /Ready to Ship/ }));
    expect(onNavigate).toHaveBeenLastCalledWith('sales-transaction-order-slip', expect.objectContaining({ ...period, dashboardSlipStatus: 'draft' }));
    await user.click(screen.getByRole('button', { name: /Under Inspection/ }));
    expect(onNavigate).toHaveBeenLastCalledWith('accounting-transactions-sales-return-credit', expect.objectContaining({ ...period, dashboardReturnStatus: 'Pending' }));
    await user.click(screen.getByRole('button', { name: 'INQ-1' }));
    expect(onNavigate).toHaveBeenLastCalledWith('sales-transaction-sales-inquiry', expect.objectContaining({ ...period, inquiryId: 'INQ-1' }));
    await user.click(screen.getByRole('button', { name: /View Complete Activity Log/ }));
    expect(onNavigate).toHaveBeenLastCalledWith('maintenance-profile-activity-logs', expect.objectContaining(period));
  });

  it('passes the selected dashboard date into the sales-return period filter', async () => {
    fetchSnapshotMock.mockResolvedValue(snapshot);
    const onNavigate = vi.fn();
    render(<OperationsDashboard onNavigate={onNavigate} />);

    const dateInput = await screen.findByLabelText('Filter operations dashboard by date');
    fireEvent.change(dateInput, { target: { value: '2025-02-24' } });
    await screen.findByText('1. Order Overview (This Month)');

    await userEvent.setup().click(screen.getByRole('button', { name: /Under Inspection/ }));
    expect(onNavigate).toHaveBeenLastCalledWith('accounting-transactions-sales-return-credit', {
      dashboardDate: '2025-02-24',
      dashboardMonth: '02',
      dashboardYear: '2025',
      dashboardMonthStart: '2025-02-01',
      dashboardMonthEnd: '2025-02-28',
      dashboardReturnStatus: 'Pending',
    });
  });
});
