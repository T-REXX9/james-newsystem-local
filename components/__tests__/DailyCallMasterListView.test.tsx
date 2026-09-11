import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DailyCallMasterListView from '../DailyCallMasterListView';
import { createCustomerLogForDailyCall, fetchCustomersForDailyCall, fetchDailyCallMasterList } from '../../services/dailyCallMonitoringService';
import { bulkUpdateContacts, updateContact, fetchSalesAgents } from '../../services/customerDatabaseLocalApiService';
import { getVipTierConfig } from '../../services/vipTierSettingsService';
import type { UserProfile } from '../../types';

const masterUser: UserProfile = {
  id: 'master-1',
  email: 'master@example.com',
  role: 'Master User',
};

vi.mock('../../services/dailyCallMonitoringService', () => ({
  fetchDailyCallMasterList: vi.fn(),
  fetchCustomersForDailyCall: vi.fn(),
  createCustomerLogForDailyCall: vi.fn(),
  getCachedDailyCallMasterList: vi.fn(() => null),
}));

vi.mock('../../services/customerDatabaseLocalApiService', () => ({
  createContact: vi.fn(),
  updateContact: vi.fn(),
  bulkUpdateContacts: vi.fn().mockResolvedValue(undefined),
  fetchSalesAgents: vi.fn().mockResolvedValue([
    { id: 'agent-1', full_name: 'Joan Jerusalem', email: '', role: 'Sales Agent' },
    { id: 'agent-2', full_name: 'Apostol Ella', email: '', role: 'Sales Agent' },
  ]),
}));

vi.mock('../../services/vipTierSettingsService', () => ({
  getVipTierConfig: vi.fn().mockResolvedValue({
    one_time_discount_threshold: 10000,
    unlimited_discount_threshold: 30000,
    discount_percentage: 10,
  }),
}));

vi.mock('../DailyCallCustomerDetailModal', () => ({
  default: ({ isOpen, customer, currentUser }: any) => isOpen && customer
    ? <div role="dialog" data-current-user={currentUser?.id || ''}>Customer detail popup for {customer.shopName}</div>
    : null,
}));

vi.mock('../ToastProvider', () => ({
  useToast: () => ({
    addToast: vi.fn(),
  }),
}));

describe('DailyCallMasterListView', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.mocked(createCustomerLogForDailyCall).mockResolvedValue({
      id: 'status-log-1',
      contact_id: 'customer-1',
      entry_type: 'Status',
      topic: 'Status',
      status: 'Do Not Contact',
      note: 'No longer operating',
      occurred_at: '2026-09-10T00:00:00.000Z',
      created_by: 'master-1',
      created_by_name: 'Master User',
    });
  });

  it('shows a prospect comment in the unverified prospects list', async () => {
    vi.mocked(fetchDailyCallMasterList).mockResolvedValue({
      meta: { fromDate: '2025-10-01', toDate: '2026-09-10', count: 1 },
      items: [{
        id: 'prospect-1', shopName: 'New Prospect Shop', province: 'Manila', city: 'Manila',
        contactNumber: '0917', assignedTo: 'Joan Jerusalem', profileType: 'Prospect',
        verification: 'Unverified', prospectComment: 'Interested in fleet pricing after the call.',
        lastPurchaseDate: '—', lastPurchaseDateRaw: '', purchaseCount: 0,
        totalSales: 0, currentMonthSales: 0, averageMonthlySales: 0,
        averageMonthlySalesMonthCount: 0, recentThreeMonthSales: 0,
        previousThreeMonthSales: 0, salesTrendPercent: 0, daysSinceLastPurchase: 0,
        monthsSinceLastPurchase: 0, purchaseAgeGroup: 'no_purchase', listCategory: 'no_purchase',
      }],
    });

    render(<DailyCallMasterListView currentUser={masterUser} />);

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Unverified Prospects (1)' }));
    expect(await screen.findByText('Interested in fleet pricing after the call.')).toBeInTheDocument();
  });

  it('shows the contact person name beside the contact number', async () => {
    vi.mocked(fetchDailyCallMasterList).mockResolvedValue({
      meta: { fromDate: '2025-10-01', toDate: '2026-09-10', count: 1 },
      items: [{
        id: 'contact-person-1', shopName: 'Named Contact Shop', province: 'Manila', city: 'Manila',
        contactNumber: '0917', contactPersonName: 'Maria Santos', assignedTo: 'Joan Jerusalem',
        lastPurchaseDate: 'Sep 1, 2026', lastPurchaseDateRaw: '2026-09-01', purchaseCount: 1, totalSales: 0,
        currentMonthSales: 0, averageMonthlySales: 0, averageMonthlySalesMonthCount: 0,
        recentThreeMonthSales: 0, previousThreeMonthSales: 0, salesTrendPercent: 0,
        daysSinceLastPurchase: 10, monthsSinceLastPurchase: 0, purchaseAgeGroup: 'recent',
        listCategory: 'priority',
      }],
    });

    render(<DailyCallMasterListView currentUser={masterUser} />);

    const row = (await screen.findByText('Named Contact Shop')).closest('tr');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText((_, element) => element?.textContent === '0917 · Maria Santos')).toBeInTheDocument();
  });

  it('lets master user approve a pending verification request into verified prospects', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchDailyCallMasterList).mockResolvedValue({
      meta: { fromDate: '2025-10-01', toDate: '2026-06-15', count: 1 },
      items: [{
        id: 'pending-verified-1',
        shopName: 'Pending Prospect Shop',
        province: 'Laguna',
        city: 'Calamba',
        contactNumber: '0940',
        assignedTo: 'Apostol Ella',
        profileType: 'Prospect',
        verification: 'Pending Verification',
        lastPurchaseDate: '—',
        lastPurchaseDateRaw: '',
        purchaseCount: 0,
        totalSales: 0,
        currentMonthSales: 0,
        daysSinceLastPurchase: 0,
        monthsSinceLastPurchase: 0,
        purchaseAgeGroup: 'no_purchase',
      }],
    });
    vi.mocked(updateContact).mockResolvedValue(undefined);

    render(<DailyCallMasterListView currentUser={masterUser} />);

    await user.click(await screen.findByRole('button', { name: 'Unverified Prospects (1)' }));
    await user.click(await screen.findByRole('button', { name: 'Approve verification for Pending Prospect Shop' }));

    expect(updateContact).toHaveBeenCalledWith('pending-verified-1', { verification: 'Verified' });
  });

  it('classifies current VIP status from last month sales instead of stored price group', async () => {
    vi.mocked(getVipTierConfig).mockResolvedValueOnce({
      one_time_discount_threshold: 10000,
      unlimited_discount_threshold: 30000,
      discount_percentage: 10,
    });
    vi.mocked(fetchDailyCallMasterList).mockResolvedValue({
      meta: { fromDate: '2025-10-01', toDate: '2026-09-03', count: 1 },
      items: [{
        id: 'last-month-vip-1',
        shopName: 'Last Month Qualified Shop',
        province: 'Cebu',
        city: 'Cebu City',
        contactNumber: '0917',
        assignedTo: 'Unassigned',
        priceGroup: 'regular',
        lastPurchaseDate: 'Aug 29, 2026',
        lastPurchaseDateRaw: '2026-08-29',
        purchaseCount: 2,
        listCategory: 'priority',
        totalSales: 35043,
        currentMonthSales: 0,
        lastMonthSales: 35043,
        averageMonthlySales: 35043,
        averageMonthlySalesMonthCount: 1,
        recentThreeMonthSales: 35043,
        previousThreeMonthSales: 0,
        salesTrendPercent: 100,
        daysSinceLastPurchase: 5,
        monthsSinceLastPurchase: 0,
        purchaseAgeGroup: 'recent',
      }],
    });

    render(<DailyCallMasterListView />);

    const row = (await screen.findByText('Last Month Qualified Shop')).closest('tr');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText('VIP Gold')).toBeInTheDocument();
    expect(within(row as HTMLElement).queryByText('Regular')).not.toBeInTheDocument();
  });

  it('separates October 2025 activity from historical recovery customers', async () => {
    vi.mocked(fetchDailyCallMasterList).mockResolvedValue({
      meta: { fromDate: '2025-10-01', toDate: '2026-06-15', count: 6 },
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
          listCategory: 'priority',
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
          lastPurchaseDate: 'Sep 1, 2025',
          lastPurchaseDateRaw: '2025-09-01',
          purchaseCount: 4,
          listCategory: 'recovery',
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
          listCategory: 'priority',
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
          profileType: 'Prospect',
          verification: 'Verified',
          verifiedBy: 'Apostol Ella',
          lastPurchaseDate: '—',
          lastPurchaseDateRaw: '',
          purchaseCount: 0,
          listCategory: 'no_purchase',
          totalSales: 0,
          currentMonthSales: 0,
          daysSinceLastPurchase: 0,
          monthsSinceLastPurchase: 0,
          purchaseAgeGroup: 'no_purchase',
        },
        {
          id: 'old-verified-no-purchase',
          shopName: 'Old Verified No Purchase',
          province: 'Laguna',
          city: 'Calamba',
          contactNumber: '0941',
          assignedTo: 'Apostol Ella',
          profileType: 'Old',
          verification: 'Verified',
          lastPurchaseDate: '—',
          lastPurchaseDateRaw: '',
          purchaseCount: 0,
          listCategory: 'no_purchase',
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
          profileType: 'Prospect',
          verification: '',
          lastPurchaseDate: '—',
          lastPurchaseDateRaw: '',
          purchaseCount: 0,
          listCategory: 'no_purchase',
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
      expect(screen.getByRole('button', { name: 'Priority List (2)' })).toBeInTheDocument()
    );

    expect(screen.getAllByText(/Priority List/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Recovery List/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Verified Prospects/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Unverified Prospects/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Verified By')).toBeInTheDocument();
    const tableHeader = screen.getByTestId('daily-call-table-scroll').querySelector('thead');
    expect(tableHeader).toHaveClass('sticky', 'top-0');
    expect(screen.getAllByText('Apostol Ella').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Customer Case Overview/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Incident Report Flow/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Quick Go To/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Priority List (2)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recovery List (1)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verified Prospects (1)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unverified Prospects (1)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All Customers (6)' })).toBeInTheDocument();
    expect(screen.getByTestId('potential-sales-formula')).toHaveTextContent('₱5,000 per verified prospect');
    expect(screen.getAllByText(/No purchases yet/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Any ledger activity since October 2025 onwards/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders additional rows on table scroll and applies every purchase-age colour', async () => {
    const user = userEvent.setup();
    const currentDate = new Date();
    const dateMonthsAgo = (monthsAgo: number) => {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - monthsAgo, 15);
      return date.toISOString().slice(0, 10);
    };
    const items = Array.from({ length: 31 }, (_, index) => {
      const monthsAgo = index === 0 ? 1 : index === 1 ? 2 : index === 2 ? 3 : 0;
      return {
        id: `scroll-${index + 1}`,
        shopName: `Scroll Customer ${index + 1}`,
        province: 'Cebu',
        city: 'Cebu City',
        contactNumber: '0917',
        assignedTo: 'Unassigned',
        lastPurchaseDate: dateMonthsAgo(monthsAgo),
        lastPurchaseDateRaw: dateMonthsAgo(monthsAgo),
        purchaseCount: 1,
        listCategory: 'priority' as const,
        totalSales: 1000,
        currentMonthSales: 0,
        daysSinceLastPurchase: monthsAgo * 30,
        monthsSinceLastPurchase: monthsAgo,
        purchaseAgeGroup: 'recent' as const,
      };
    });
    vi.mocked(fetchDailyCallMasterList).mockResolvedValue({
      meta: { fromDate: '2025-10-01', toDate: dateMonthsAgo(0), count: items.length },
      items,
    });

    render(<DailyCallMasterListView />);

    await screen.findByText('Scroll Customer 30');
    expect(screen.queryByText('Scroll Customer 31')).not.toBeInTheDocument();
    expect(screen.getByText('Scroll Customer 1').closest('tr')).toHaveClass('bg-yellow-100');
    expect(screen.getByText('Scroll Customer 2').closest('tr')).toHaveClass('bg-purple-100');
    expect(screen.getByText('Scroll Customer 3').closest('tr')).toHaveClass('bg-white');

    const pageScroll = screen.getByTestId('master-list-scroll-region');
    Object.defineProperties(pageScroll, {
      clientHeight: { configurable: true, value: 500 },
      scrollHeight: { configurable: true, value: 1200 },
      scrollTop: { configurable: true, value: 1000, writable: true },
    });
    fireEvent.scroll(pageScroll);
    expect(await screen.findByText('Scroll Customer 31')).toBeInTheDocument();
    expect(screen.queryByLabelText(/pagination/i)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Color status'), 'purple');
    expect(screen.getByText('Scroll Customer 2')).toBeInTheDocument();
    expect(screen.queryByText('Scroll Customer 1')).not.toBeInTheDocument();
  });

  it('uses the quick go to buttons to switch category tables', async () => {
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
    render(<DailyCallMasterListView />);

    await screen.findByRole('navigation', { name: 'Quick Go To' });

    expect(screen.getByTestId('category-table-priority')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Recovery List (0)' }));
    expect(screen.getByTestId('category-table-recovery')).toBeInTheDocument();
    expect(screen.queryByTestId('category-table-priority')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'All Customers (1)' }));
    expect(screen.getByTestId('category-table-all')).toBeInTheDocument();
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

    render(<DailyCallMasterListView currentUser={masterUser} />);
    await user.click(await screen.findByRole('button', { name: 'View details for Priority Buyer Shop' }));

    expect(fetchCustomersForDailyCall).toHaveBeenCalledWith({});
    const detailDialog = await screen.findByRole('dialog');
    expect(detailDialog).toHaveTextContent('Customer detail popup for Priority Buyer Shop');
    expect(detailDialog).toHaveAttribute('data-current-user', 'master-1');
    vi.mocked(fetchCustomersForDailyCall).mockResolvedValue([{ id: 'priority-1', shopName: 'Approved new name' } as any]);
    fireEvent(window, new CustomEvent('customer-workflow:updated', { detail: { contactId: 'priority-1' } }));
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveTextContent('Approved new name'));

  });

  it('wires the call action button to the customer popup flow', async () => {
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
  });

  it('assigns a sales agent inline from the Agent column dropdown', async () => {
    const user = userEvent.setup();
    const masterCustomer = {
      id: 'priority-1', shopName: 'Priority Buyer Shop', province: 'Manila', city: 'Manila',
      contactNumber: '0930', assignedTo: 'Unassigned', lastPurchaseDate: 'May 26, 2026',
      lastPurchaseDateRaw: '2026-05-26', purchaseCount: 1, totalSales: 5000,
      currentMonthSales: 0, daysSinceLastPurchase: 20, monthsSinceLastPurchase: 0,
      purchaseAgeGroup: 'two_weeks_to_one_month' as const,
    };
    vi.mocked(fetchDailyCallMasterList).mockResolvedValue({
      meta: { fromDate: '2025-10-01', toDate: '2026-06-15', count: 1 },
      items: [masterCustomer],
    });
    vi.mocked(updateContact).mockResolvedValue(undefined);

    render(<DailyCallMasterListView currentUser={masterUser} />);

    await user.selectOptions(
      await screen.findByLabelText('Assign sales agent for Priority Buyer Shop'),
      'agent-1'
    );

    await waitFor(() => {
      expect(updateContact).toHaveBeenCalledWith(
        'priority-1',
        expect.objectContaining({
          __salesPersonId: 'agent-1',
          salesman: 'Joan Jerusalem',
        }),
        'master-1'
      );
    });
    expect(screen.getByLabelText('Assign sales agent for Priority Buyer Shop')).toHaveValue('agent-1');
  });

  it('assigns the active category to one sales agent in bulk', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchDailyCallMasterList).mockResolvedValue({
      meta: { fromDate: '2025-10-01', toDate: '2026-06-15', count: 2 },
      items: [
        {
          id: 'priority-1', shopName: 'Priority Buyer Shop', province: 'Manila', city: 'Manila',
          contactNumber: '0930', assignedTo: 'Unassigned', listCategory: 'priority',
          lastPurchaseDate: 'May 26, 2026', lastPurchaseDateRaw: '2026-05-26', purchaseCount: 1,
          totalSales: 5000, currentMonthSales: 0, daysSinceLastPurchase: 20,
          monthsSinceLastPurchase: 0, purchaseAgeGroup: 'two_weeks_to_one_month' as const,
        },
        {
          id: 'priority-2', shopName: 'Second Priority Shop', province: 'Cebu', city: 'Cebu City',
          contactNumber: '0940', assignedTo: 'Apostol Ella', listCategory: 'priority',
          lastPurchaseDate: 'May 20, 2026', lastPurchaseDateRaw: '2026-05-20', purchaseCount: 1,
          totalSales: 6000, currentMonthSales: 0, daysSinceLastPurchase: 26,
          monthsSinceLastPurchase: 0, purchaseAgeGroup: 'two_weeks_to_one_month' as const,
        },
      ],
    });

    render(<DailyCallMasterListView currentUser={masterUser} />);

    await user.selectOptions(
      await screen.findByLabelText('Assign sales agent to Priority List'),
      'agent-1'
    );
    await user.click(screen.getByRole('button', { name: 'Assign agent' }));

    await waitFor(() => {
      expect(bulkUpdateContacts).toHaveBeenCalledWith(
        ['priority-1', 'priority-2'],
        expect.objectContaining({
          __salesPersonId: 'agent-1',
          salesman: 'Joan Jerusalem',
          assignedAgent: 'Joan Jerusalem',
        })
      );
    });
    expect(fetchDailyCallMasterList).toHaveBeenCalledWith({
      fromDate: '2025-10-01',
      search: '',
      forceRefresh: true,
    });
  });

  it('does not change a customer when do-not-contact confirmation is canceled', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    vi.mocked(fetchDailyCallMasterList).mockResolvedValue({
      meta: { fromDate: '2025-10-01', toDate: '2026-06-15', count: 1 },
      items: [{
        id: 'priority-1',
        shopName: 'Priority Buyer Shop',
        province: 'Manila',
        city: 'Manila',
        contactNumber: '0930',
        assignedTo: 'Joan Jerusalem',
        lastPurchaseDate: 'May 26, 2026',
        lastPurchaseDateRaw: '2026-05-26',
        purchaseCount: 1,
        listCategory: 'priority',
        totalSales: 5000,
        currentMonthSales: 0,
        daysSinceLastPurchase: 20,
        monthsSinceLastPurchase: 0,
        purchaseAgeGroup: 'two_weeks_to_one_month',
      }],
    });

    render(<DailyCallMasterListView currentUser={masterUser} />);

    await user.click(await screen.findByRole('button', { name: 'Mark Priority Buyer Shop as Do Not Contact' }));
    const dialog = await screen.findByRole('dialog', { name: 'Mark as Do Not Contact' });

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(within(dialog).getByText(/Priority Buyer Shop/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(updateContact).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Mark as Do Not Contact' })).not.toBeInTheDocument();
    expect(screen.getByText('Priority Buyer Shop')).toBeInTheDocument();
  });

  it('marks an unverified prospect do-not-contact and records Reject verification after confirmation', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    vi.mocked(fetchDailyCallMasterList)
      .mockResolvedValueOnce({
        meta: { fromDate: '2025-10-01', toDate: '2026-06-15', count: 1 },
        items: [{
          id: 'unverified-1',
          shopName: 'Fresh Prospect Shop',
          province: 'Batangas',
          city: 'Lipa',
          contactNumber: '0950',
          assignedTo: 'Joan Jerusalem',
          profileType: 'Prospect',
          verification: 'Unverified',
          lastPurchaseDate: '—',
          lastPurchaseDateRaw: '',
          purchaseCount: 0,
          listCategory: 'no_purchase',
          totalSales: 0,
          currentMonthSales: 0,
          daysSinceLastPurchase: 0,
          monthsSinceLastPurchase: 0,
          purchaseAgeGroup: 'no_purchase',
        }],
      })
      .mockResolvedValueOnce({
        meta: { fromDate: '2025-10-01', toDate: '2026-06-15', count: 1 },
        items: [{
          id: 'unverified-1',
          shopName: 'Fresh Prospect Shop',
          province: 'Batangas',
          city: 'Lipa',
          contactNumber: '0950',
          assignedTo: 'Joan Jerusalem',
          profileType: 'Prospect',
          verification: 'Rejected',
          customerStatus: 4,
          debtType: 'Bad',
          lastPurchaseDate: '—',
          lastPurchaseDateRaw: '',
          purchaseCount: 0,
          listCategory: 'no_purchase',
          totalSales: 0,
          currentMonthSales: 0,
          daysSinceLastPurchase: 0,
          monthsSinceLastPurchase: 0,
          purchaseAgeGroup: 'no_purchase',
        }],
      });
    vi.mocked(updateContact).mockResolvedValue(undefined);

    render(<DailyCallMasterListView currentUser={masterUser} />);

    await user.click(await screen.findByRole('button', { name: 'Unverified Prospects (1)' }));
    expect(await screen.findByRole('button', { name: 'Approve verification for Fresh Prospect Shop' })).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Mark Fresh Prospect Shop as Do Not Contact' }));
    const dialog = await screen.findByRole('dialog', { name: 'Mark as Do Not Contact' });
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('button', { name: 'Mark Do Not Contact' })).toBeDisabled();
    await user.type(within(dialog).getByLabelText('Reason for Do Not Contact'), 'No longer operating');
    expect(within(dialog).getByRole('button', { name: 'Mark Do Not Contact' })).toBeEnabled();
    await user.click(within(dialog).getByRole('button', { name: 'Mark Do Not Contact' }));

    expect(updateContact).toHaveBeenCalledWith(
      'unverified-1',
      {
        status: 'Blacklisted',
        debtType: 'Bad',
        verification: 'Rejected',
      },
      'master-1'
    );
    expect(createCustomerLogForDailyCall).toHaveBeenCalledWith({
      contact_id: 'unverified-1',
      entry_type: 'Status',
      topic: 'Status',
      status: 'Do Not Contact',
      note: 'No longer operating',
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Unverified Prospects (0)' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /blacklisted\/rejected -do not contact \(1\)/i })).toBeInTheDocument();
    expect(screen.getByTestId('category-table-unverified')).toBeInTheDocument();
    expect(screen.queryByText('Fresh Prospect Shop')).not.toBeInTheDocument();
  });

  it('marks a buyer do-not-contact without changing verification fields', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    vi.mocked(fetchDailyCallMasterList)
      .mockResolvedValueOnce({
        meta: { fromDate: '2025-10-01', toDate: '2026-06-15', count: 1 },
        items: [{
          id: 'priority-1',
          shopName: 'Priority Buyer Shop',
          province: 'Manila',
          city: 'Manila',
          contactNumber: '0930',
          assignedTo: 'Joan Jerusalem',
          verification: 'Verified',
          verifiedBy: 'Master User',
          lastPurchaseDate: 'May 26, 2026',
          lastPurchaseDateRaw: '2026-05-26',
          purchaseCount: 1,
          listCategory: 'priority',
          totalSales: 5000,
          currentMonthSales: 0,
          daysSinceLastPurchase: 20,
          monthsSinceLastPurchase: 0,
          purchaseAgeGroup: 'two_weeks_to_one_month',
        }],
      })
      .mockResolvedValueOnce({
        meta: { fromDate: '2025-10-01', toDate: '2026-06-15', count: 1 },
        items: [{
          id: 'priority-1',
          shopName: 'Priority Buyer Shop',
          province: 'Manila',
          city: 'Manila',
          contactNumber: '0930',
          assignedTo: 'Joan Jerusalem',
          verification: 'Verified',
          verifiedBy: 'Master User',
          customerStatus: 4,
          debtType: 'Bad',
          lastPurchaseDate: 'May 26, 2026',
          lastPurchaseDateRaw: '2026-05-26',
          purchaseCount: 1,
          listCategory: 'priority',
          totalSales: 5000,
          currentMonthSales: 0,
          daysSinceLastPurchase: 20,
          monthsSinceLastPurchase: 0,
          purchaseAgeGroup: 'two_weeks_to_one_month',
        }],
      });
    vi.mocked(updateContact).mockResolvedValue(undefined);

    render(<DailyCallMasterListView currentUser={masterUser} />);

    await user.click(await screen.findByRole('button', { name: 'Mark Priority Buyer Shop as Do Not Contact' }));
    const dialog = await screen.findByRole('dialog', { name: 'Mark as Do Not Contact' });
    expect(confirmSpy).not.toHaveBeenCalled();
    await user.type(within(dialog).getByLabelText('Reason for Do Not Contact'), 'No longer operating');
    await user.click(within(dialog).getByRole('button', { name: 'Mark Do Not Contact' }));

    expect(updateContact).toHaveBeenCalledWith(
      'priority-1',
      {
        status: 'Blacklisted',
        debtType: 'Bad',
      },
      'master-1'
    );
    expect(createCustomerLogForDailyCall).toHaveBeenCalledWith({
      contact_id: 'priority-1',
      entry_type: 'Status',
      topic: 'Status',
      status: 'Do Not Contact',
      note: 'No longer operating',
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Priority List (0)' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /blacklisted\/rejected -do not contact \(1\)/i })).toBeInTheDocument();
    expect(screen.getByTestId('category-table-priority')).toBeInTheDocument();
    expect(screen.queryByText('Priority Buyer Shop')).not.toBeInTheDocument();
  });

  it('allows a client with Customer Database edit permission to mark a buyer do-not-contact', async () => {
    const user = userEvent.setup();
    const clientUser: UserProfile = {
      id: 'client-1',
      email: 'client@example.com',
      role: 'Sales Agent',
      action_permissions: {
        pages: {
          'Customer Database': {
            can_view: true,
            can_edit: true,
          },
        },
      },
    };
    vi.mocked(fetchDailyCallMasterList).mockResolvedValue({
      meta: { fromDate: '2025-10-01', toDate: '2026-06-15', count: 1 },
      items: [{
        id: 'sunny-1', shopName: 'Sunny Dalapo', province: 'Manila', city: 'Manila',
        contactNumber: '0930', assignedTo: 'Joan Jerusalem', verification: 'Verified',
        lastPurchaseDate: 'May 26, 2026', lastPurchaseDateRaw: '2026-05-26', purchaseCount: 1,
        listCategory: 'priority', totalSales: 5000, currentMonthSales: 0, daysSinceLastPurchase: 20,
        monthsSinceLastPurchase: 0, purchaseAgeGroup: 'two_weeks_to_one_month',
      }],
    });
    vi.mocked(updateContact).mockResolvedValue(undefined);

    render(<DailyCallMasterListView currentUser={clientUser} />);

    await user.click(await screen.findByRole('button', { name: 'Mark Sunny Dalapo as Do Not Contact' }));
    const dialog = await screen.findByRole('dialog', { name: 'Mark as Do Not Contact' });
    await user.type(within(dialog).getByLabelText('Reason for Do Not Contact'), 'Client requested no further calls');
    await user.click(within(dialog).getByRole('button', { name: 'Mark Do Not Contact' }));

    await waitFor(() => expect(updateContact).toHaveBeenCalledWith(
      'sunny-1',
      { status: 'Blacklisted', debtType: 'Bad' },
      'client-1',
    ));
  });

  it('shows the blocked do-not-contact quick go to category', async () => {
    vi.mocked(fetchDailyCallMasterList).mockResolvedValue({
      meta: { fromDate: '2025-10-01', toDate: '2026-06-15', count: 1 },
      items: [{
        id: 'blocked-1',
        shopName: 'Blocked Shop',
        province: 'Manila',
        city: 'Manila',
        contactNumber: '0911',
        assignedTo: 'Unassigned',
        customerStatus: 4,
        debtType: 'Bad',
        lastPurchaseDate: 'May 1, 2026',
        lastPurchaseDateRaw: '2026-05-01',
        purchaseCount: 1,
        currentMonthSales: 0,
        daysSinceLastPurchase: 30,
        monthsSinceLastPurchase: 1,
        purchaseAgeGroup: 'two_weeks_to_one_month' as const,
      }],
    });

    render(<DailyCallMasterListView />);

    expect(await screen.findByRole('button', { name: /blacklisted\/rejected -do not contact \(1\)/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark Blocked Shop as Do Not Contact' })).not.toBeInTheDocument();
  });

  it('does not show master do-not-contact controls when the master view is rendered without a master user', async () => {
    vi.mocked(fetchDailyCallMasterList).mockResolvedValue({
      meta: { fromDate: '2025-10-01', toDate: '2026-06-15', count: 1 },
      items: [{
        id: 'priority-1',
        shopName: 'Priority Buyer Shop',
        province: 'Manila',
        city: 'Manila',
        contactNumber: '0930',
        assignedTo: 'Joan Jerusalem',
        lastPurchaseDate: 'May 26, 2026',
        lastPurchaseDateRaw: '2026-05-26',
        purchaseCount: 1,
        listCategory: 'priority',
        totalSales: 5000,
        currentMonthSales: 0,
        daysSinceLastPurchase: 20,
        monthsSinceLastPurchase: 0,
        purchaseAgeGroup: 'two_weeks_to_one_month',
      }],
    });

    render(<DailyCallMasterListView />);

    expect(await screen.findByRole('button', { name: 'Call Priority Buyer Shop' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark Priority Buyer Shop as Do Not Contact' })).not.toBeInTheDocument();
  });

  it('does not render the removed customer case and incident-flow footer area', async () => {
    vi.mocked(fetchDailyCallMasterList).mockResolvedValue({
      meta: { fromDate: '2025-10-01', toDate: '2026-06-15', count: 0 },
      items: [],
    });

    render(<DailyCallMasterListView />);
    await waitFor(() => expect(screen.getByTestId('master-list-dashboard')).toBeInTheDocument());

    expect(screen.queryByText(/Customer Case Overview/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Incident Report Flow/i)).not.toBeInTheDocument();
  });

  it('shows category summary metrics without Average Monthly Sales on top', async () => {
    vi.mocked(fetchDailyCallMasterList).mockResolvedValue({
      meta: { fromDate: '2025-10-01', toDate: '2026-09-09', count: 4 },
      items: [
        {
          id: 'priority-1',
          shopName: 'Priority Buyer Shop',
          province: 'Manila',
          city: 'Manila',
          contactNumber: '0930',
          assignedTo: 'Joan Jerusalem',
          lastPurchaseDate: 'Sep 1, 2026',
          lastPurchaseDateRaw: '2026-09-01',
          purchaseCount: 2,
          listCategory: 'priority',
          totalSales: 20000,
          currentMonthSales: 8000,
          averageMonthlySales: 10000,
          averageMonthlySalesMonthCount: 2,
          daysSinceLastPurchase: 8,
          monthsSinceLastPurchase: 0,
          purchaseAgeGroup: 'recent',
        },
        {
          id: 'recovery-1',
          shopName: 'Recovery Shop',
          province: 'Davao',
          city: 'Davao City',
          contactNumber: '0920',
          assignedTo: 'Unassigned',
          lastPurchaseDate: 'Sep 1, 2025',
          lastPurchaseDateRaw: '2025-09-01',
          purchaseCount: 4,
          listCategory: 'recovery',
          totalSales: 44000,
          currentMonthSales: 0,
          averageMonthlySales: 11000,
          averageMonthlySalesMonthCount: 4,
          daysSinceLastPurchase: 373,
          monthsSinceLastPurchase: 12,
          purchaseAgeGroup: 'over_one_month',
        },
        {
          id: 'verified-1',
          shopName: 'Verified Prospect Shop',
          province: 'Laguna',
          city: 'Calamba',
          contactNumber: '0940',
          assignedTo: 'Apostol Ella',
          profileType: 'Prospect',
          verification: 'Verified',
          lastPurchaseDate: '—',
          lastPurchaseDateRaw: '',
          purchaseCount: 0,
          listCategory: 'no_purchase',
          totalSales: 0,
          currentMonthSales: 0,
          averageMonthlySales: 0,
          daysSinceLastPurchase: 0,
          monthsSinceLastPurchase: 0,
          purchaseAgeGroup: 'no_purchase',
        },
        {
          id: 'blocked-1',
          shopName: 'Blocked Shop',
          province: 'Cebu',
          city: 'Cebu City',
          contactNumber: '0917',
          assignedTo: 'Unassigned',
          customerStatus: 4,
          debtType: 'Bad',
          lastPurchaseDate: 'Aug 1, 2025',
          lastPurchaseDateRaw: '2025-08-01',
          purchaseCount: 3,
          listCategory: 'recovery',
          totalSales: 30000,
          currentMonthSales: 0,
          averageMonthlySales: 9000,
          averageMonthlySalesMonthCount: 3,
          daysSinceLastPurchase: 400,
          monthsSinceLastPurchase: 13,
          purchaseAgeGroup: 'over_one_month',
        },
      ],
    });

    render(<DailyCallMasterListView />);

    const summaries = await screen.findByRole('region', { name: 'Customer category summaries' });
    expect(within(summaries).queryByText('Average Monthly Sales')).not.toBeInTheDocument();
    expect(within(summaries).queryByText('Average Monthly Purchase')).not.toBeInTheDocument();

    const priorityCard = within(summaries).getByRole('heading', { name: /Priority List/i }).closest('article') as HTMLElement;
    expect(within(priorityCard).getByText('Current Month Sales')).toBeInTheDocument();
    expect(within(priorityCard).getByText('Monthly Sales Potential')).toBeInTheDocument();

    const recoveryCard = within(summaries).getByRole('heading', { name: /Recovery List/i }).closest('article') as HTMLElement;
    expect(within(recoveryCard).queryByText('Current Month Sales')).not.toBeInTheDocument();
    expect(within(recoveryCard).getByText('Monthly Sales Potential')).toBeInTheDocument();

    const verifiedCard = within(summaries).getByRole('heading', { name: /^Verified Prospects/i }).closest('article') as HTMLElement;
    expect(within(verifiedCard).getByText('Monthly Potential Sales')).toBeInTheDocument();
    expect(within(verifiedCard).queryByText('Current Month Sales')).not.toBeInTheDocument();

    const blockedCard = within(summaries).getByRole('heading', { name: /blacklisted\/rejected -do not contact/i }).closest('article') as HTMLElement;
    expect(within(blockedCard).getByText('Monthly Potential Sales')).toBeInTheDocument();
    expect(within(blockedCard).queryByText('Current Month Sales')).not.toBeInTheDocument();
  });

  it('moves clients who start buying into the Priority List', async () => {
    vi.mocked(fetchDailyCallMasterList).mockResolvedValue({
      meta: { fromDate: '2025-10-01', toDate: '2026-09-09', count: 1 },
      items: [{
        id: 'former-prospect-1',
        shopName: 'First Purchase Shop',
        province: 'Laguna',
        city: 'Calamba',
        contactNumber: '0940',
        assignedTo: 'Apostol Ella',
        profileType: 'Prospect',
        verification: 'Verified',
        lastPurchaseDate: 'Sep 5, 2026',
        lastPurchaseDateRaw: '2026-09-05',
        purchaseCount: 1,
        priorityTransactionCount: 1,
        // Stale prospect shape must still leave Verified once buying starts.
        listCategory: 'no_purchase',
        totalSales: 5000,
        currentMonthSales: 5000,
        averageMonthlySales: 5000,
        averageMonthlySalesMonthCount: 1,
        daysSinceLastPurchase: 4,
        monthsSinceLastPurchase: 0,
        purchaseAgeGroup: 'recent',
      }],
    });

    render(<DailyCallMasterListView />);

    expect(await screen.findByRole('button', { name: 'Priority List (1)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verified Prospects (0)' })).toBeInTheDocument();
    expect(screen.getByText('First Purchase Shop')).toBeInTheDocument();
  });
});
