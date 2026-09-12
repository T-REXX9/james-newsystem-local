import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import OwnerDailyCallMonitoringUnifiedView from '../OwnerDailyCallMonitoringUnifiedView';

const getSalesReportDataMock = vi.fn();

vi.mock('../DailyCallMasterListView', () => ({
  default: () => <div data-testid="master-list-view">Master List View</div>,
}));

vi.mock('../../services/dailyCallMonitoringService', () => ({
  fetchDailyCallMasterList: vi.fn().mockResolvedValue({ items: [] }),
}));

vi.mock('../../services/salesReportService', () => ({
  getSalesReportData: (...args: unknown[]) => getSalesReportDataMock(...args),
}));

describe('OwnerDailyCallMonitoringUnifiedView', () => {
  afterEach(() => {
    cleanup();
    getSalesReportDataMock.mockReset();
  });

  it('renders the Daily Call Monitoring master list by default', () => {
    getSalesReportDataMock.mockResolvedValue({ summary: { grandTotal: { total: 0 } } });
    render(<OwnerDailyCallMonitoringUnifiedView currentUser={null} />);

    expect(screen.getByTestId('master-list-view')).toBeInTheDocument();
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
  });
});
