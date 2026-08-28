import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FastSlowInventoryReport from '../FastSlowInventoryReport';

const generateFastSlowReportMock = vi.fn();

vi.mock('../../services/inventoryMovementService', () => ({
  generateFastSlowReport: (...args: unknown[]) => generateFastSlowReportMock(...args),
}));

vi.mock('../CustomLoadingSpinner', () => ({
  default: ({ label }: { label: string }) => <span>{label}</span>,
}));

describe('FastSlowInventoryReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateFastSlowReportMock.mockResolvedValue({
      generatedAt: '2026-08-23T00:00:00Z',
      fastMovingItems: [{
        item_id: 'session-1',
        part_no: 'PN-001',
        item_code: 'IT-001',
        description: 'NOZZLE',
        vip1_price: 150,
        first_arrival_date: '2026-08-01',
        last_price_update: '2026-08-22 10:30:00',
        total_purchased: 20,
        total_sold: 6,
        month1_sales: 1,
        month2_sales: 2,
        month3_sales: 3,
        month1_label: 'May',
        month2_label: 'June',
        month3_label: 'July',
        category: 'fast',
      }],
      slowMovingItems: [],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('opens the clicked part number in Product Database and shows the latest price update date', async () => {
    render(<FastSlowInventoryReport />);
    fireEvent.click(screen.getByRole('button', { name: 'Generate Report' }));

    const partLink = await screen.findByRole('link', { name: 'PN-001' });
    expect(partLink).toHaveAttribute('target', '_blank');
    expect(partLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(partLink.getAttribute('href')).toContain('#/warehouse-inventory-product-database?');
    expect(partLink.getAttribute('href')).toContain('productId=session-1');
    expect(partLink.getAttribute('href')).toContain('partNo=PN-001');
    expect(screen.getAllByText('Last Price Update')).toHaveLength(2);
    expect(screen.getAllByRole('columnheader', { name: 'Item Code' })).toHaveLength(2);
    expect(screen.queryByRole('columnheader', { name: 'Listing Code' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('columnheader', { name: 'VIP 1 Price' })).toHaveLength(2);
    expect(screen.getByText('₱150.00')).toBeInTheDocument();
    expect(screen.getByText('08/22/2026')).toBeInTheDocument();
    expect(screen.getByText(/sales in all 3 consecutive months/i)).toBeInTheDocument();
    expect(screen.getByText(/Analyzed months: May, June, July/i)).toBeInTheDocument();
  });
});
