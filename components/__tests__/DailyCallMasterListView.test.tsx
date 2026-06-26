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

  it('counts every customer with ledger activity since October 2025 in the priority list', async () => {
    vi.mocked(fetchDailyCallMasterList).mockResolvedValue({
      meta: { fromDate: '2025-10-01', toDate: '2026-06-15', count: 5 },
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
        {
          id: 'prospect-verified-1',
          shopName: 'Verified Prospect Shop',
          province: 'Laguna',
          city: 'Calamba',
          contactNumber: '0940',
          assignedTo: 'Apostol Ella',
          verification: 'Verified',
          lastPurchaseDate: '—',
          lastPurchaseDateRaw: '',
          purchaseCount: 0,
          totalSales: 0,
          currentMonthSales: 0,
          daysSinceLastPurchase: 0,
          monthsSinceLastPurchase: 0,
          purchaseAgeGroup: 'no_purchase',
        },
        {
          id: 'prospect-unverified-1',
          shopName: 'Fresh Prospect Shop',
          province: 'Batangas',
          city: 'Lipa',
          contactNumber: '0950',
          assignedTo: 'Joan Jerusalem',
          verification: '',
          lastPurchaseDate: '—',
          lastPurchaseDateRaw: '',
          purchaseCount: 0,
          totalSales: 0,
          currentMonthSales: 0,
          daysSinceLastPurchase: 0,
          monthsSinceLastPurchase: 0,
          purchaseAgeGroup: 'no_purchase',
        },
      ],
    });

    render(<DailyCallMasterListView />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Priority List (3)' })).toBeInTheDocument()
    );

    expect(screen.getAllByText(/Priority List/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Recovery List/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Verified Prospects/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Unverified Prospects/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Customer Case Overview/i)).toBeInTheDocument();
    expect(screen.getByText(/Incident Report Flow/i)).toBeInTheDocument();
    expect(screen.getByText(/Quick Summary/i)).toBeInTheDocument();
    expect(screen.getByText(/Quick Go To/i)).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-fit-viewport')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Priority List (3)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recovery List (1)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verified Prospects (0)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unverified Prospects (2)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All Customers (5)' })).toBeInTheDocument();
    expect(screen.getAllByText(/No purchases yet/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Any ledger activity since October 2025 onwards/i).length).toBeGreaterThanOrEqual(1);
  });

  it('uses the quick go to buttons to scroll to category tables and the full overview', async () => {
    vi.mocked(fetchDailyCallMasterList).mockResolvedValue({
      meta: { fromDate: '2025-10-01', toDate: '2026-06-15', count: 1 },
      items: [{
        id: 'priority-1',
        shopName: 'Priority Shop',
        province: 'Manila',
        city: 'Manila',
        contactNumber: '0930',
        assignedTo: 'Joan Jerusalem',
        lastPurchaseDate: 'Jun 1, 2026',
        lastPurchaseDateRaw: '2026-06-01',
        purchaseCount: 1,
        totalSales: 5000,
        currentMonthSales: 0,
        daysSinceLastPurchase: 20,
        monthsSinceLastPurchase: 0,
        purchaseAgeGroup: 'two_weeks_to_one_month',
      }],
    });
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    render(<DailyCallMasterListView />);

    await screen.findByRole('navigation', { name: 'Quick Go To' });

    fireEvent.click(screen.getByRole('button', { name: /Priority List/i }));
    expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'smooth', block: 'start' });
    expect(document.activeElement).toBe(screen.getByTestId('category-table-priority'));

    fireEvent.click(screen.getByRole('button', { name: 'All Customers (1)' }));
    expect(document.activeElement).toBe(screen.getByTestId('master-list-dashboard'));
  });

  it('opens the full customer detail popup when a customer name is clicked', async () => {
    const user = userEvent.setup();
    const masterCustomer = {
      id: 'priority-1', shopName: 'Priority Buyer Shop', province: 'Manila', city: 'Manila',
      contactNumber: '0930', assignedTo: 'Joan Jerusalem', lastPurchaseDate: 'May 26, 2026',
      lastPurchaseDateRaw: '2026-05-26', purchaseCount: 1, totalSales: 5000,
      currentMonthSales: 0, daysSinceLastPurchase: 20, monthsSinceLastPurchase: 0,
      purchaseAgeGroup: 'two_weeks_to_one_month' as const,
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
    await user.click(await screen.findByRole('button', { name: 'View details for Priority Buyer Shop' }));

    expect(fetchCustomersForDailyCall).toHaveBeenCalledWith({});
    expect(await screen.findByRole('dialog')).toHaveTextContent('Customer detail popup for Priority Buyer Shop');
  });

  it('wires the call and message action buttons to the customer popup flow', async () => {
    const user = userEvent.setup();
    const masterCustomer = {
      id: 'priority-1', shopName: 'Priority Buyer Shop', province: 'Manila', city: 'Manila',
      contactNumber: '0930', assignedTo: 'Joan Jerusalem', lastPurchaseDate: 'May 26, 2026',
      lastPurchaseDateRaw: '2026-05-26', purchaseCount: 1, totalSales: 5000,
      currentMonthSales: 0, daysSinceLastPurchase: 20, monthsSinceLastPurchase: 0,
      purchaseAgeGroup: 'two_weeks_to_one_month' as const,
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

    await user.click(await screen.findByRole('button', { name: 'Call Priority Buyer Shop' }));
    expect(fetchCustomersForDailyCall).toHaveBeenCalledWith({});
    expect(await screen.findByRole('dialog')).toHaveTextContent('Customer detail popup for Priority Buyer Shop');

    cleanup();
    vi.clearAllMocks();

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

    await user.click(await screen.findByRole('button', { name: 'Message Priority Buyer Shop' }));
    expect(fetchCustomersForDailyCall).toHaveBeenCalledWith({});
    expect(await screen.findByRole('dialog')).toHaveTextContent('Customer detail popup for Priority Buyer Shop');
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
