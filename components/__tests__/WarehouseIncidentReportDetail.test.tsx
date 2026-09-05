import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WarehouseIncidentReportDetail from '../WarehouseIncidentReportDetail';

const fetchReportMock = vi.fn();
const reviewReportMock = vi.fn();

vi.mock('../../services/incidentItemsReportService', async () => {
  const actual = await vi.importActual<typeof import('../../services/incidentItemsReportService')>(
    '../../services/incidentItemsReportService'
  );
  return {
    ...actual,
    fetchWarehouseIncidentReport: (...args: unknown[]) => fetchReportMock(...args),
  };
});

vi.mock('../../services/dailyCallCustomerDetailService', () => ({
  reviewDailyCallIncidentReport: (...args: unknown[]) => reviewReportMock(...args),
}));

const pendingReport = {
  id: 'aaaa1111-bbbb-cccc-dddd-eeeeffff0001',
  ir_number: 'IR-2601',
  contact_id: 'c-1',
  customer_name: 'Alpha Co',
  report_date: '2026-09-02',
  report_time: '09:30:00',
  incident_date: '2026-09-01',
  incident_time: '15:00:00',
  issue_type: 'product_quality',
  description: 'Nozzle leak during calibration.',
  reported_by: 'Sales Agent',
  done_by: 'Sales Agent',
  attachments: [],
  related_transactions: [],
  approval_status: 'pending',
  product_id: 'product-1',
  part_no: 'PN-1',
  item_code: 'P300',
  item_description: 'Nozzle',
  affected_quantity: 1,
  supplier_id: '10',
  supplier_name: 'QK9N',
  customer_incident_count: 3,
  item_incident_count: 5,
};

describe('WarehouseIncidentReportDetail', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows the full Incident Report and lets Master User approve', async () => {
    fetchReportMock
      .mockResolvedValueOnce(pendingReport)
      .mockResolvedValueOnce({
        ...pendingReport,
        approval_status: 'approved',
        return_action: {
          id: 'IRA-1',
          disposition: 'return_to_stock',
          status: 'authorized',
        },
      });
    reviewReportMock.mockResolvedValue({ id: pendingReport.id, approval_status: 'approved' });
    const user = userEvent.setup();

    render(
      <WarehouseIncidentReportDetail
        reportId={pendingReport.id}
        currentUser={{ id: 'master-1', role: 'Master User', full_name: 'Master User' } as any}
      />
    );

    expect(await screen.findByText('IR-2601')).toBeInTheDocument();
    expect(screen.getByText('Alpha Co')).toBeInTheDocument();
    expect(screen.getByText('Nozzle leak during calibration.')).toBeInTheDocument();
    expect(screen.getByText('PN-1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Approve Sales Return' }));

    await waitFor(() => expect(reviewReportMock).toHaveBeenCalledWith(
      pendingReport.id,
      expect.objectContaining({ decision: 'approved', disposition: 'return_to_stock' })
    ));
    expect(await screen.findByText('Sales return accepted')).toBeInTheDocument();
  });

  it('hides approve actions for warehouse staff', async () => {
    fetchReportMock.mockResolvedValueOnce(pendingReport);

    render(
      <WarehouseIncidentReportDetail
        reportId={pendingReport.id}
        currentUser={{ id: 'wh-1', role: 'Warehouse Personnel', full_name: 'Warehouse' } as any}
      />
    );

    expect(await screen.findByText('Awaiting Master User approval.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve Sales Return' })).not.toBeInTheDocument();
  });
});
