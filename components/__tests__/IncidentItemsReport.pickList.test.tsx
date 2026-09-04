import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import IncidentItemsReport from '../IncidentItemsReport';

const fetchReportMock = vi.fn();
const fetchIncidentsMock = vi.fn();

vi.mock('../../services/incidentItemsReportService', async () => {
  const actual = await vi.importActual<typeof import('../../services/incidentItemsReportService')>(
    '../../services/incidentItemsReportService'
  );
  return {
    ...actual,
    fetchIncidentItemsReport: (...args: unknown[]) => fetchReportMock(...args),
    fetchIncidentItemIncidents: (...args: unknown[]) => fetchIncidentsMock(...args),
  };
});

const sampleRow = {
  supplier_id: '10',
  supplier_name: 'QK9N',
  product_id: '123',
  item_code: 'P300',
  part_no: 'PN-1',
  description: 'Nozzle',
  incident_count: 2,
  affected_customer_count: 2,
  latest_incident_date: '2026-09-02',
  average_confidence: 0.75,
  match_sources: 'manual',
  recent_incidents: [
    {
      incident_report_id: 'aaaa1111-bbbb-cccc-dddd-eeeeffff0001',
      date: '2026-09-02',
      contact_id: 'c-1',
      customer_name: 'Alpha Co',
      summary: 'Leak',
    },
  ],
};

describe('IncidentItemsReport pick list', () => {
  beforeEach(() => {
    fetchReportMock.mockResolvedValue({
      items: [sampleRow],
      summary: {
        total_incident_items: 2,
        affected_suppliers: 1,
        affected_items: 1,
        top_supplier_name: 'QK9N',
        top_item_description: 'Nozzle',
        top_incident_count: 2,
      },
      meta: { page: 1, per_page: 100, total: 1, total_pages: 1, search: '', supplier: '', match_source: 'all', min_count: 1 },
    });
    fetchIncidentsMock.mockResolvedValue([
      {
        incident_report_id: 'aaaa1111-bbbb-cccc-dddd-eeeeffff0001',
        date: '2026-09-02',
        contact_id: 'c-1',
        customer_name: 'Alpha Co',
        summary: 'Nozzle leak',
      },
      {
        incident_report_id: 'bbbb2222-cccc-dddd-eeee-ffff00001111',
        date: '2026-08-15',
        contact_id: 'c-2',
        customer_name: 'Beta Inc',
        summary: 'Crack',
      },
    ]);
    vi.stubGlobal('open', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('opens a themed Incident Report pick list on double-click and keeps it open after selecting one', async () => {
    const user = userEvent.setup();
    render(<IncidentItemsReport />);

    const partCell = await screen.findByText('PN-1');
    const row = partCell.closest('tr');
    expect(row).toBeTruthy();
    fireEvent.doubleClick(row!);

    const dialog = await screen.findByRole('dialog', { name: /Incident Reports/i });
    expect(dialog).toBeInTheDocument();
    expect(await screen.findByText('bbbb2222')).toBeInTheDocument();
    expect(screen.getAllByText('aaaa1111').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Alpha Co').length).toBeGreaterThan(0);
    expect(screen.getByText('Nozzle leak')).toBeInTheDocument();

    await waitFor(() => expect(fetchIncidentsMock).toHaveBeenCalledWith(expect.objectContaining({
      supplierId: '10',
      supplierName: 'QK9N',
      productId: '123',
      itemCode: 'P300',
      partNo: 'PN-1',
      description: 'Nozzle',
    })));

    await user.click(screen.getByRole('button', { name: /aaaa1111/i }));

    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining('warehouse-reports-incident-items-report?reportId=aaaa1111-bbbb-cccc-dddd-eeeeffff0001'),
      '_blank',
      'noopener,noreferrer'
    );
    expect(screen.getByRole('dialog', { name: /Incident Reports/i })).toBeInTheDocument();
  });
});
