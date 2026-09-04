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
  lastTransactionDate: '2026-08-27 14:30:00',
  lastRrDate: '2026-08-12 09:15:00',
  reorderQuantity: 15,
  vip1Price: 100,
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
    const locationHeader = screen.getByRole('columnheader', { name: 'LOC' });
    expect(locationHeader.nextElementSibling).toHaveTextContent('LAST TRANSACTION DATE');
    expect(locationHeader.nextElementSibling?.nextElementSibling).toHaveTextContent('LAST RR DATE');
    expect(locationHeader.nextElementSibling?.nextElementSibling?.nextElementSibling).toHaveTextContent('REORDER QUANTITY');
    expect(screen.getByText('August 27, 2026')).toBeInTheDocument();
    expect(screen.getByText('August 12, 2026')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '15' })).toBeInTheDocument();

    // Verify the Product Database VIP 1 price, value, and footer total value.
    expect(screen.getByText('₱100.00')).toBeInTheDocument();
    expect(screen.getAllByText('₱1,200.00').length).toBe(2);
    expect(screen.getByText('Total Value:')).toBeInTheDocument();

    const reportTable = screen.getByRole('table');
    expect(reportTable).toHaveClass('inventory-report-print-table');
    const columnWidths = Array.from(reportTable.querySelectorAll('col')).map((column) =>
      Number.parseFloat((column as HTMLTableColElement).style.width),
    );
    expect(columnWidths).toHaveLength(11);
    expect(columnWidths.reduce((total, width) => total + width, 0)).toBe(100);
    expect(document.querySelector('style')?.textContent).toContain('size: A4 landscape');
    expect(reportTable.closest('.inventory-report-print-root')).toHaveClass('print:overflow-visible');
  });

  it('resets the description filter to All descriptions', async () => {
    render(<InventoryReport />);

    const descriptionSelect = await screen.findByDisplayValue('All descriptions');
    fireEvent.change(descriptionSelect, { target: { value: 'PLUNGER' } });
    expect(descriptionSelect).toHaveValue('PLUNGER');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByDisplayValue('All descriptions')).toHaveValue('');
  });

  it('fits every product report column into the fixed print layout', async () => {
    render(<InventoryReport />);

    await screen.findByDisplayValue('All descriptions');
    fireEvent.click(screen.getByRole('radio', { name: 'Products' }));
    fireEvent.click(screen.getByRole('button', { name: 'Generate Report' }));

    const reportTable = await screen.findByRole('table');
    const columnWidths = Array.from(reportTable.querySelectorAll('col')).map((column) =>
      Number.parseFloat((column as HTMLTableColElement).style.width),
    );
    expect(screen.getByText('Product Report')).toBeInTheDocument();
    expect(columnWidths).toHaveLength(10);
    expect(columnWidths.reduce((total, width) => total + width, 0)).toBe(100);
  });

  it('opens a part number Product Database record in a new tab on double-click', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<InventoryReport />);

    await screen.findByDisplayValue('All descriptions');
    fireEvent.click(screen.getByRole('button', { name: 'Generate Report' }));

    const partNumber = await screen.findByRole('button', { name: 'Open PN-001 in Product Database' });
    fireEvent.click(partNumber);
    expect(openSpy).not.toHaveBeenCalled();

    fireEvent.doubleClick(partNumber);
    expect(openSpy).toHaveBeenCalledTimes(1);
    const [url, target, features] = openSpy.mock.calls[0];
    expect(String(url)).toContain('#/warehouse-inventory-product-database?');
    expect(String(url)).toContain('productId=item-1');
    expect(String(url)).toContain('partNo=PN-001');
    expect(target).toBe('_blank');
    expect(features).toBe('noopener,noreferrer');

    openSpy.mockRestore();
  });
});
