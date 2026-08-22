import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ManagementView from '../ManagementView';
import { fetchManagementDashboardData } from '../../services/managementDashboardLocalApiService';

vi.mock('../../services/managementDashboardLocalApiService', () => ({
  fetchManagementDashboardData: vi.fn(),
}));

vi.mock('../ContactDetails', () => ({
  default: () => null,
}));

const dashboardFixture = (year = 2026) => ({
  year,
  month: 8,
  kpis: {
    totalSalesYtd: 15722431.2,
    totalCollectionsYtd: 14987650.8,
    outstandingReceivables: 734780.4,
    activeCustomers: 128,
  },
  monthlySales: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, sales: index === 7 ? 118550 : 0, collections: index === 7 ? 100000 : 0 })),
  topCustomers: [{ customerName: 'Estancia Calibration', amount: 31880 }],
  topSalespeople: [{ salesperson: 'Master User', amount: 118550 }],
  bestItems: [{ itemCode: 'QF-044', partNo: 'P-5145', description: 'FEED PUMP OIL SEAL', qtyYtd: 5430, qtyMtd: 300 }],
  worstItems: [{ itemCode: 'QK-999', partNo: 'P-000', description: 'TEST ADAPTER', qtyYtd: 5, qtyMtd: 1 }],
  team: [], city: [], status: [], payment: [], inactive: [], criticalInactive: [], inquiryOnly: [],
});

describe('ManagementView', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('restricts the dashboard to the master user', () => {
    render(<ManagementView currentUser={{ id: 'agent-1', role: 'Sales Agent', user_type: '2' }} />);
    expect(screen.getByText('Master User access required')).toBeInTheDocument();
    expect(fetchManagementDashboardData).not.toHaveBeenCalled();
  });

  it('renders the production dashboard for the master user', async () => {
    vi.mocked(fetchManagementDashboardData).mockResolvedValue(dashboardFixture() as any);
    render(<ManagementView currentUser={{ id: 'master-1', role: 'Master User', user_type: '1', full_name: 'Master User', main_id: 1 }} />);

    expect(await screen.findByRole('heading', { name: /Sales Performance Dashboard/i })).toBeInTheDocument();
    expect(screen.getByText('Total Sales (YTD)')).toBeInTheDocument();
    expect(screen.getByText('₱15,722,431.20')).toBeInTheDocument();
    expect(screen.getByText('Estancia Calibration')).toBeInTheDocument();
    expect(screen.getByText('FEED PUMP OIL SEAL')).toBeInTheDocument();
    expect(screen.getByText('TEST ADAPTER')).toBeInTheDocument();
    expect(screen.getByText('Master User only')).toBeInTheDocument();
  });

  it('reloads data when the master user changes the selected year', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchManagementDashboardData).mockResolvedValue(dashboardFixture() as any);
    render(<ManagementView currentUser={{ id: 'master-1', role: 'Company Owner', user_type: '1', main_id: 1 }} />);

    const yearSelect = await screen.findByRole('combobox');
    await user.selectOptions(yearSelect, '2025');

    await waitFor(() => expect(fetchManagementDashboardData).toHaveBeenLastCalledWith(1, 2025, 8));
  });
});
