import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InventoryReport from '../InventoryReport';

const fetchInventoryReportOptionsMock = vi.fn();
const fetchInventoryReportMock = vi.fn();

vi.mock('../../services/inventoryReportService', () => ({
  fetchInventoryReportOptions: (...args: unknown[]) => fetchInventoryReportOptionsMock(...args),
  fetchInventoryReport: (...args: unknown[]) => fetchInventoryReportMock(...args),
}));

vi.mock('../ToastProvider', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

const reportRow = {
  id: 'item-1',
  partNo: 'PN-001',
  itemCode: 'IT-001',
  description: 'NOZZLE',
  category: 'Fuel System',
  location: 'A-01',
  cost: 100,
  warehouseStock: {},
  totalStock: 12,
  value: 1200,
};

describe('InventoryReport description filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchInventoryReportOptionsMock.mockResolvedValue({
      descriptions: ['CONTROL VALVE', 'NOZZLE', 'PLUNGER'],
      partNumbers: [],
      itemCodes: [],
      warehouses: [],
    });
    fetchInventoryReportMock.mockResolvedValue({ rows: [reportRow], warehouses: [] });
  });

  afterEach(() => {
    cleanup();
  });

  it('loads description options and generates a report for the selected description', async () => {
    render(<InventoryReport />);

    const descriptionSelect = await screen.findByDisplayValue('All descriptions');
    expect(descriptionSelect).toHaveValue('');
    expect(screen.getByRole('option', { name: 'NOZZLE' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'PLUNGER' })).toBeInTheDocument();

    fireEvent.change(descriptionSelect, { target: { value: 'NOZZLE' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate Report' }));

    await waitFor(() => {
      expect(fetchInventoryReportMock).toHaveBeenCalledWith(expect.objectContaining({
        description: 'NOZZLE',
        reportType: 'inventory',
      }));
    });
    expect(await screen.findByText('Inventory Report')).toBeInTheDocument();
    expect(screen.getByText('NOZZLE')).toBeInTheDocument();
  });

  it('resets the description filter to All descriptions', async () => {
    render(<InventoryReport />);

    const descriptionSelect = await screen.findByDisplayValue('All descriptions');
    fireEvent.change(descriptionSelect, { target: { value: 'PLUNGER' } });
    expect(descriptionSelect).toHaveValue('PLUNGER');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByDisplayValue('All descriptions')).toHaveValue('');
  });
});
