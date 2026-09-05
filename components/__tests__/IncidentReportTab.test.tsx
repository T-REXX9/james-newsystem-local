import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import IncidentReportTab from '../IncidentReportTab';

const fetchReportsMock = vi.fn();
const reviewReportMock = vi.fn();

vi.mock('../../services/dailyCallCustomerDetailService', () => ({
  fetchDailyCallIncidentReports: (...args: unknown[]) => fetchReportsMock(...args),
  reviewDailyCallIncidentReport: (...args: unknown[]) => reviewReportMock(...args),
}));

vi.mock('../CreateIncidentReportModal', () => ({ default: () => null }));

const pendingReport = {
  id: 'incident-1',
  ir_number: 'IR-2601',
  record_source: 'incident_report',
  contact_id: 'customer-1',
  report_date: '2026-09-01',
  report_time: '09:30:00',
  incident_date: '2026-08-31',
  incident_time: '15:45:00',
  issue_type: 'product_quality',
  description: 'The returned injector failed during calibration.',
  reported_by: 'Sales Agent',
  done_by: 'Sales Agent',
  attachments: [],
  related_transactions: [],
  approval_status: 'pending',
  product_id: 'product-1',
  part_no: 'PN-100',
  item_description: 'Injector assembly',
  supplier_id: 'supplier-1',
  supplier_name: 'Factory Supplier',
  affected_quantity: 2,
  customer_incident_count: 5,
  item_incident_count: 8,
};

describe('IncidentReportTab approval workflow', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('lets the Master User approve a factory return and shows trace counts', async () => {
    fetchReportsMock
      .mockResolvedValueOnce([pendingReport])
      .mockResolvedValueOnce([{ ...pendingReport, approval_status: 'approved' }]);
    reviewReportMock.mockResolvedValue({ id: 'incident-1', approval_status: 'approved' });
    const user = userEvent.setup();

    render(<IncidentReportTab contactId="customer-1" currentUser={{ id: 'master-1', role: 'Master User', full_name: 'Master User' } as any} />);

    expect(await screen.findByText('PN-100')).toBeInTheDocument();
    expect(screen.getByText(/IR-2601/)).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    await user.click(screen.getByText('Return to factory'));
    await user.click(screen.getByRole('button', { name: 'Approve Sales Return' }));

    await waitFor(() => expect(reviewReportMock).toHaveBeenCalledWith('incident-1', expect.objectContaining({
      decision: 'approved',
      disposition: 'return_to_factory',
    })));
  });

  it('rejects with no disposition or return action', async () => {
    fetchReportsMock
      .mockResolvedValueOnce([pendingReport])
      .mockResolvedValueOnce([{ ...pendingReport, approval_status: 'rejected', decision_note: 'Not covered.' }]);
    reviewReportMock.mockResolvedValue({ id: 'incident-1', approval_status: 'rejected' });
    const user = userEvent.setup();

    render(<IncidentReportTab contactId="customer-1" currentUser={{ id: 'master-1', role: 'Master User', full_name: 'Master User' } as any} />);
    await user.click(await screen.findByRole('button', { name: 'Reject' }));

    await waitFor(() => expect(reviewReportMock).toHaveBeenCalledWith('incident-1', expect.objectContaining({
      decision: 'rejected',
      disposition: undefined,
    })));
  });

  it('shows approved return authorization details', async () => {
    fetchReportsMock.mockResolvedValueOnce([{
      ...pendingReport,
      approval_status: 'approved',
      return_action: {
        id: 'IRA-123',
        disposition: 'return_to_stock',
        status: 'authorized',
        authorized_by_name: 'Master User',
        authorized_at: '2026-09-01 10:00:00',
      },
    }]);

    render(<IncidentReportTab contactId="customer-1" currentUser={{ id: 'agent-1', role: 'Sales Agent' } as any} />);

    expect(await screen.findByText('Sales return accepted')).toBeInTheDocument();
    expect(screen.getByText('Disposition: Return to stock')).toBeInTheDocument();
    expect(screen.getByText(/Authorization IRA-123/)).toBeInTheDocument();
  });

  it('shows rejected incident-only details without review actions', async () => {
    fetchReportsMock.mockResolvedValueOnce([{ ...pendingReport, approval_status: 'rejected', decision_note: 'Not covered.' }]);

    render(<IncidentReportTab contactId="customer-1" currentUser={{ id: 'agent-1', role: 'Sales Agent' } as any} />);

    expect(await screen.findByText('Rejected - incident record only')).toBeInTheDocument();
    expect(screen.getByText('No sales return, stock movement, or factory-return action was created.')).toBeInTheDocument();
    expect(screen.getByText('Not covered.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve Sales Return' })).not.toBeInTheDocument();
  });

  it('uses numeric Master User type to allow review actions', async () => {
    fetchReportsMock.mockResolvedValueOnce([pendingReport]);

    render(<IncidentReportTab contactId="customer-1" currentUser={{ id: 'master-1', user_type: 1, full_name: 'Owner' } as any} />);

    expect(await screen.findByRole('button', { name: 'Approve Sales Return' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });

  it('shows awaiting approval for non-Master users', async () => {
    fetchReportsMock.mockResolvedValueOnce([pendingReport]);

    render(<IncidentReportTab contactId="customer-1" currentUser={{ id: 'agent-1', role: 'Sales Agent' } as any} />);

    expect(await screen.findByText('Awaiting Master User approval.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve Sales Return' })).not.toBeInTheDocument();
  });

  it('allows Master User review actions on legacy customer log incidents', async () => {
    fetchReportsMock.mockResolvedValueOnce([{ ...pendingReport, record_source: 'customer_log' }]);

    render(<IncidentReportTab contactId="customer-1" currentUser={{ id: 'master-1', role: 'Master User' } as any} />);

    expect(await screen.findByRole('button', { name: 'Approve Sales Return' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });

  it('requires an affected item before enabling approval', async () => {
    fetchReportsMock.mockResolvedValueOnce([{ ...pendingReport, product_id: '', part_no: '', item_code: '' }]);

    render(<IncidentReportTab contactId="customer-1" currentUser={{ id: 'master-1', role: 'Master User' } as any} />);

    expect(await screen.findByText('An affected item is required before a sales return can be approved.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve Sales Return' })).toBeDisabled();
  });

  it('disables factory return when no supplier is linked but still allows return to stock', async () => {
    fetchReportsMock.mockResolvedValueOnce([{ ...pendingReport, supplier_id: '', supplier_name: '' }]);

    render(<IncidentReportTab contactId="customer-1" currentUser={{ id: 'master-1', role: 'Master User' } as any} />);

    expect(await screen.findByText('Link a supplier to enable Return to factory.')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Return to factory/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Approve Sales Return' })).toBeEnabled();
  });

  it('shows review API errors and does not hide the action panel', async () => {
    fetchReportsMock.mockResolvedValueOnce([pendingReport]);
    reviewReportMock.mockRejectedValueOnce(new Error('Only the Master User can approve or reject incident returns'));
    const user = userEvent.setup();

    render(<IncidentReportTab contactId="customer-1" currentUser={{ id: 'master-1', role: 'Master User', full_name: 'Master User' } as any} />);
    await user.click(await screen.findByRole('button', { name: 'Approve Sales Return' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Only the Master User can approve or reject incident returns');
    expect(screen.getByRole('button', { name: 'Approve Sales Return' })).toBeInTheDocument();
  });
});
