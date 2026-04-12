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
        id: 'gold-row',
        shopName: 'Gold Shop',
        assignedTo: 'Jane Doe',
        assignedDate: '2026-04-01',
        province: 'Cebu',
        city: 'Cebu City',
        contactNumber: '09170000001',
        source: 'Manual',
        clientSince: '2026-01-01',
        dealerPriceGroup: 'gold',
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
        weeklyRangeTotals: [],
        dailyActivity: [],
      },
      {
        id: 'silver-row',
        shopName: 'Silver Shop',
        assignedTo: 'Jane Doe',
        assignedDate: '2026-04-01',
        province: 'Davao del Sur',
        city: 'Davao City',
        contactNumber: '09170000002',
        source: 'Manual',
        clientSince: '2026-01-01',
        dealerPriceGroup: 'silver',
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
        dealerPriceGroup: 'regular',
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
        weeklyRangeTotals: [],
        dailyActivity: [],
      },
    ]);
  });

  afterEach(() => {
    cleanup();
  });

  it('shows VIP badges only for silver and gold dealers', async () => {
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

    expect(await screen.findByAltText('Gold VIP badge')).toBeInTheDocument();
    expect(screen.getByAltText('Silver VIP badge')).toBeInTheDocument();
    expect(screen.queryByAltText('Regular VIP badge')).not.toBeInTheDocument();
  });
});
