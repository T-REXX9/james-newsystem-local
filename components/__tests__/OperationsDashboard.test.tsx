import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OperationsDashboard from '../OperationsDashboard';

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
  calls: { incoming: 1, outgoing: 2, missed: 0, returned: 0, unanswered: 1, averageResponseSeconds: 60 },
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

  it('renders the client reference sections and links every operational path', async () => {
    fetchSnapshotMock.mockResolvedValue(snapshot);
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    render(<OperationsDashboard onNavigate={onNavigate} />);

    expect(await screen.findByText('1. Order Overview (This Month)')).toBeInTheDocument();
    expect(screen.getByText('2. Call Overview (Selected Date)')).toBeInTheDocument();
    expect(screen.getByText('7. Receivables Overview (As of Selected Date)')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /New Inquiry/ }));
    expect(onNavigate).toHaveBeenLastCalledWith('sales-transaction-sales-inquiry', undefined);
    await user.click(screen.getByRole('button', { name: /Incoming Calls/ }));
    expect(onNavigate).toHaveBeenLastCalledWith('sales-transaction-daily-call-monitoring', undefined);
    await user.click(screen.getByRole('button', { name: /Ready to Ship/ }));
    expect(onNavigate).toHaveBeenLastCalledWith('sales-transaction-order-slip', undefined);
    await user.click(screen.getByRole('button', { name: /Return Requests/ }));
    expect(onNavigate).toHaveBeenLastCalledWith('accounting-transactions-sales-return-credit', undefined);
    await user.click(screen.getByRole('button', { name: 'INQ-1' }));
    expect(onNavigate).toHaveBeenLastCalledWith('sales-transaction-sales-inquiry', { inquiryId: 'INQ-1' });
    await user.click(screen.getByRole('button', { name: /View Complete Activity Log/ }));
    expect(onNavigate).toHaveBeenLastCalledWith('maintenance-profile-activity-logs', undefined);
  });
});
