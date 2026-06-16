import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import DailyCallMasterListView from '../DailyCallMasterListView';
import { fetchDailyCallMasterList } from '../../services/dailyCallMonitoringService';

vi.mock('../../services/dailyCallMonitoringService', () => ({
  fetchDailyCallMasterList: vi.fn(),
}));

describe('DailyCallMasterListView', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('groups customers by last purchase age', async () => {
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

    expect(screen.getAllByText('2 weeks to 1 month').length).toBeGreaterThan(0);
    expect(screen.getAllByText('More than 1 month').length).toBeGreaterThan(0);
    expect(screen.queryByText('Recent purchase')).not.toBeInTheDocument();
    expect(screen.getByText('Recovery Shop')).toBeInTheDocument();
    expect(screen.queryByText('Recent Buyer Shop')).not.toBeInTheDocument();
    expect(screen.getAllByText('High').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Recover').length).toBeGreaterThan(0);
    expect(screen.queryByText('Monitor')).not.toBeInTheDocument();
  });
});
