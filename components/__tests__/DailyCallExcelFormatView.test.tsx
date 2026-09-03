import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import DailyCallExcelFormatView from '../DailyCallExcelFormatView';

const addToastMock = vi.fn();
const fetchCustomersForDailyCallMock = vi.fn();
const subscribeToDailyCallMonitoringUpdatesMock = vi.fn(() => () => {});
const createContactMock = vi.fn();

vi.mock('../ToastProvider', () => ({
  useToast: () => ({
    addToast: addToastMock,
  }),
}));

vi.mock('../../services/dailyCallMonitoringService', () => ({
  fetchCustomersForDailyCall: (...args: unknown[]) => fetchCustomersForDailyCallMock(...args),
  subscribeToDailyCallMonitoringUpdates: (...args: unknown[]) => subscribeToDailyCallMonitoringUpdatesMock(...args),
}));

vi.mock('../../services/customerDatabaseLocalApiService', () => ({
  createContact: (...args: unknown[]) => createContactMock(...args),
}));

vi.mock('../../hooks/useDebounce', () => ({
  useDebounce: (value: string) => value,
}));

vi.mock('../DailyCallCustomerDetailModal', () => ({
  default: () => null,
}));

vi.mock('../../services/vipTierSettingsService', () => ({
  getVipTierConfig: vi.fn().mockResolvedValue({
    one_time_discount_threshold: 10000,
    unlimited_discount_threshold: 30000,
    discount_percentage: 10,
  }),
}));

vi.mock('../AddContactModal', () => ({
  default: () => null,
}));

describe('DailyCallExcelFormatView', () => {
  beforeEach(() => {
    cleanup();
    addToastMock.mockReset();
    fetchCustomersForDailyCallMock.mockReset();
    subscribeToDailyCallMonitoringUpdatesMock.mockClear();
    createContactMock.mockReset();

    fetchCustomersForDailyCallMock.mockResolvedValue([
      {
        id: 'vip2-row',
        shopName: 'VIP 2 Shop',
        assignedTo: 'Jane Doe',
        assignedDate: '2026-04-01',
        province: 'Cebu',
        city: 'Cebu City',
        contactNumber: '09170000001',
        source: 'Manual',
        clientSince: '2026-01-01',
        dealerPriceGroup: 'VIP2',
        dealerPriceDate: '2026-04-01',
        ishinomotoDealerSince: '2026-04-01',
        ishinomotoSignageSince: '2026-04-01',
        quota: 0,
        terms: 'COD',
        modeOfPayment: 'COD',
        courier: 'LBC',
        status: 'Active',
        statusDate: '2026-04-01',
        outstandingBalance: 0,
        averageMonthlyOrder: 12000,
        monthlyOrder: 32000,
        lastMonthOrder: 110000,
        weeklyRangeTotals: [],
        dailyActivity: [],
      },
      {
        id: 'vip1-row',
        shopName: 'VIP 1 Shop',
        assignedTo: 'Jane Doe',
        assignedDate: '2026-04-01',
        province: 'Davao del Sur',
        city: 'Davao City',
        contactNumber: '09170000002',
        source: 'Manual',
        clientSince: '2026-01-01',
        dealerPriceGroup: 'VIP 1',
        dealerPriceDate: '2026-04-01',
        ishinomotoDealerSince: '2026-04-01',
        ishinomotoSignageSince: '2026-04-01',
        quota: 0,
        terms: 'COD',
        modeOfPayment: 'COD',
        courier: 'LBC',
        status: 'Active',
        statusDate: '2026-04-01',
        outstandingBalance: 0,
        averageMonthlyOrder: 9000,
        monthlyOrder: 12000,
        lastMonthOrder: 15000,
        weeklyRangeTotals: [],
        dailyActivity: [],
      },
      {
        id: 'regular-row',
        shopName: 'Regular Shop',
        assignedTo: 'Jane Doe',
        assignedDate: '2026-04-01',
        province: 'Iloilo',
        city: 'Iloilo City',
        contactNumber: '09170000003',
        source: 'Manual',
        clientSince: '2026-01-01',
        dealerPriceGroup: 'aaa',
        dealerPriceDate: '2026-04-01',
        ishinomotoDealerSince: '2026-04-01',
        ishinomotoSignageSince: '2026-04-01',
        quota: 0,
        terms: 'COD',
        modeOfPayment: 'COD',
        courier: 'LBC',
        status: 'Active',
        statusDate: '2026-04-01',
        outstandingBalance: 0,
        averageMonthlyOrder: 5000,
        monthlyOrder: 5000,
        lastMonthOrder: 8000,
        weeklyRangeTotals: [],
        dailyActivity: [],
      },
    ]);
  });

  afterEach(() => {
    cleanup();
  });

  it('shows price groups separately from VIP discount badges', async () => {
    render(
      <DailyCallExcelFormatView
        currentUser={{
          id: 'user-1',
          full_name: 'Jane Doe',
          email: 'jane@example.com',
          role: 'Master User',
          access_rights: [],
        } as any}
      />
    );

    expect(await screen.findByText('VIP 2')).toBeInTheDocument();
    expect(screen.getByText('VIP 1')).toBeInTheDocument();
    expect(screen.getByText('Regular')).toBeInTheDocument();
    expect(screen.getAllByAltText('VIP Gold badge').length).toBeGreaterThan(0);
    expect(screen.getAllByAltText('VIP Silver badge').length).toBeGreaterThan(0);
  });

  it('shows customer since date when dealer dates are empty', async () => {
    fetchCustomersForDailyCallMock.mockResolvedValue([
      {
        id: 'customer-since-row',
        shopName: 'Customer Since Shop',
        assignedTo: 'Jane Doe',
        assignedDate: '2026-04-01',
        province: 'Cebu',
        city: 'Cebu City',
        contactNumber: '09170000001',
        source: 'Manual',
        clientSince: 'Jan 17, 2019',
        dealerPriceGroup: 'gold',
        dealerPriceDate: '—',
        ishinomotoDealerSince: '—',
        ishinomotoSignageSince: '—',
        quota: 0,
        terms: 'COD',
        modeOfPayment: 'COD',
        courier: 'LBC',
        status: 'Active',
        statusDate: '2026-04-01',
        outstandingBalance: 0,
        averageMonthlyOrder: 12000,
        monthlyOrder: 32000,
        weeklyRangeTotals: [],
        dailyActivity: [],
      },
    ]);

    render(
      <DailyCallExcelFormatView
        currentUser={{
          id: 'user-1',
          full_name: 'Jane Doe',
          email: 'jane@example.com',
          role: 'Master User',
          access_rights: [],
        } as any}
      />
    );

    expect(await screen.findByText('Jan 17, 2019')).toBeInTheDocument();
  });
});
