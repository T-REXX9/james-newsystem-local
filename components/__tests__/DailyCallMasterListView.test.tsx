import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DailyCallMasterListView from '../DailyCallMasterListView';
import { fetchCustomersForDailyCall, fetchDailyCallMasterList } from '../../services/dailyCallMonitoringService';

vi.mock('../../services/dailyCallMonitoringService', () => ({
  fetchDailyCallMasterList: vi.fn(),
  fetchCustomersForDailyCall: vi.fn(),
}));

vi.mock('../DailyCallCustomerDetailModal', () => ({
  default: ({ isOpen, customer }: any) => isOpen && customer
    ? <div role="dialog">Customer detail popup for {customer.shopName}</div>
    : null,
}));

describe('DailyCallMasterListView', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders the complete four-category master list dashboard', async () => {
    vi.mocked(fetchDailyCallMasterList).mockResolvedValue({
      meta: { fromDate: '2025-10-01', toDate: '2026-06-15', count: 3 },
      items: [
        {
          id: 'warm-1',
          shopName: 'Warm Follow Up Shop',
          province: 'Cebu',
          city: 'Cebu City',
          contactNumber: '0917',
          assignedTo: 'Apostol Ella',
          lastPurchaseDate: 'May 30, 2026',
          lastPurchaseDateRaw: '2026-05-30',
          purchaseCount: 2,
          totalSales: 12000,
          currentMonthSales: 0,
          daysSinceLastPurchase: 16,
          monthsSinceLastPurchase: 0,
          purchaseAgeGroup: 'two_weeks_to_one_month',
        },
        {
          id: 'old-1',
          shopName: 'Recovery Shop',
          province: 'Davao',
          city: 'Davao City',
          contactNumber: '0920',
          assignedTo: 'Unassigned',
          lastPurchaseDate: 'Apr 1, 2026',
          lastPurchaseDateRaw: '2026-04-01',
          purchaseCount: 4,
          totalSales: 44000,
          currentMonthSales: 0,
          daysSinceLastPurchase: 75,
          monthsSinceLastPurchase: 2,
          purchaseAgeGroup: 'over_one_month',
        },
        {
          id: 'recent-1',
          shopName: 'Recent Buyer Shop',
          province: 'Manila',
          city: 'Manila',
          contactNumber: '0930',
          assignedTo: 'Joan Jerusalem',
          lastPurchaseDate: 'Jun 12, 2026',
          lastPurchaseDateRaw: '2026-06-12',
          purchaseCount: 1,
          totalSales: 5000,
          currentMonthSales: 5000,
          daysSinceLastPurchase: 3,
          monthsSinceLastPurchase: 0,
          purchaseAgeGroup: 'recent',
        },
      ],
    });

    render(<DailyCallMasterListView />);

    await waitFor(() => expect(screen.getByText('Warm Follow Up Shop')).toBeInTheDocument());

    expect(screen.getAllByText(/Priority List/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Recovery List/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Verified Prospects/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Unverified Prospects/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Customer Case Overview/i)).toBeInTheDocument();
    expect(screen.getByText(/Incident Report Flow/i)).toBeInTheDocument();
    expect(screen.getByText(/Quick Summary/i)).toBeInTheDocument();
    expect(screen.getByText(/Quick Go To/i)).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-fit-viewport')).toBeInTheDocument();
    expect(screen.getByText('Recent Buyer Shop')).toBeInTheDocument();
    expect(screen.getByText('Warm Follow Up Shop')).toBeInTheDocument();
    expect(screen.getByText('Recovery Shop')).toBeInTheDocument();
  });

  it('uses the quick go to buttons to scroll to category tables and the full overview', async () => {
    vi.mocked(fetchDailyCallMasterList).mockResolvedValue({
      meta: { fromDate: '2025-10-01', toDate: '2026-06-15', count: 1 },
      items: [{
        id: 'recent-1',
        shopName: 'Recent Buyer Shop',
        province: 'Manila',
        city: 'Manila',
        contactNumber: '0930',
        assignedTo: 'Joan Jerusalem',
        lastPurchaseDate: 'Jun 12, 2026',
        lastPurchaseDateRaw: '2026-06-12',
        purchaseCount: 1,
        totalSales: 5000,
        currentMonthSales: 5000,
        daysSinceLastPurchase: 3,
        monthsSinceLastPurchase: 0,
        purchaseAgeGroup: 'recent',
      }],
    });
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    render(<DailyCallMasterListView />);

    await screen.findByText('Recent Buyer Shop');

    fireEvent.click(screen.getByRole('button', { name: 'Priority List (1)' }));
    expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'smooth', block: 'start' });
    expect(document.activeElement).toBe(screen.getByTestId('category-table-priority'));

    fireEvent.click(screen.getByRole('button', { name: 'All Customers (1)' }));
    expect(document.activeElement).toBe(screen.getByTestId('master-list-dashboard'));
  });

  it('opens the full customer detail popup when a customer name is clicked', async () => {
    const user = userEvent.setup();
    const masterCustomer = {
      id: 'recent-1', shopName: 'Recent Buyer Shop', province: 'Manila', city: 'Manila',
      contactNumber: '0930', assignedTo: 'Joan Jerusalem', lastPurchaseDate: 'Jun 12, 2026',
      lastPurchaseDateRaw: '2026-06-12', purchaseCount: 1, totalSales: 5000,
      currentMonthSales: 5000, daysSinceLastPurchase: 3, monthsSinceLastPurchase: 0,
      purchaseAgeGroup: 'recent' as const,
    };
    vi.mocked(fetchDailyCallMasterList).mockResolvedValue({
      meta: { fromDate: '2025-10-01', toDate: '2026-06-15', count: 1 },
      items: [masterCustomer],
    });
    vi.mocked(fetchCustomersForDailyCall).mockResolvedValue([{
      ...masterCustomer,
      source: 'Customer Database', clientSince: '2024-01-15', codeDate: 'Gold',
      ishinomotoDealerSince: '2024-01-15', ishinomotoSignageSince: '2024-02-01',
      quota: 30000, modeOfPayment: '30 Days', courier: 'Manila', status: 'Active',
      outstandingBalance: 1000, averageMonthlyOrder: 5000, monthlyOrder: 5000,
      weeklyRangeTotals: [], dailyActivity: [],
    } as any]);

    render(<DailyCallMasterListView />);
    await user.click(await screen.findByRole('button', { name: 'View details for Recent Buyer Shop' }));

    expect(fetchCustomersForDailyCall).toHaveBeenCalledWith({});
    expect(await screen.findByRole('dialog')).toHaveTextContent('Customer detail popup for Recent Buyer Shop');
  });

  it('opens case overview details from each View Details button', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchDailyCallMasterList).mockResolvedValue({
      meta: { fromDate: '2025-10-01', toDate: '2026-06-15', count: 0 },
      items: [],
    });

    render(<DailyCallMasterListView />);
    await user.click(await screen.findByRole('button', { name: 'View Inquiry & Orders details' }));

    expect(screen.getByRole('dialog', { name: 'Inquiry & Orders Details' })).toBeInTheDocument();
    expect(screen.getByText('12 open cases')).toBeInTheDocument();
    expect(screen.getByText('6 pending cases')).toBeInTheDocument();
  });
});
