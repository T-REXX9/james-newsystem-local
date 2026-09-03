import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import DailyCallCustomerDetailModal from '../DailyCallCustomerDetailModal';

vi.mock('../DailyCallCustomerDetailExpansion', () => ({
  default: () => <div>Detail expansion</div>,
}));

vi.mock('../../services/vipTierSettingsService', () => ({
  getVipTierConfig: vi.fn().mockResolvedValue({
    one_time_discount_threshold: 10000,
    unlimited_discount_threshold: 30000,
    discount_percentage: 10,
  }),
}));

const baseCustomer = {
  id: 'customer-1',
  source: 'Manual',
  assignedTo: 'Jane Doe',
  assignedDate: '2026-04-01',
  clientSince: '2026-01-01',
  province: 'Cebu',
  city: 'Cebu City',
  shopName: 'VIP Parts Center',
  contactNumber: '09170000001',
  codeDate: 'VIP2',
  dealerPriceDate: '2026-04-01',
  ishinomotoDealerSince: '2026-04-01',
  ishinomotoSignageSince: '2026-04-01',
  quota: 0,
  terms: 'COD',
  modeOfPayment: 'COD',
  courier: 'Main Branch',
  status: 'Active',
  statusDate: '2026-04-01',
  outstandingBalance: 0,
  averageMonthlyOrder: 10000,
  monthlyOrder: 32000,
  weeklyRangeTotals: [],
  dailyActivity: [],
} as any;

describe('DailyCallCustomerDetailModal', () => {
  afterEach(cleanup);

  it('renders at the document level so dashboard scaling cannot shrink the popup', () => {
    render(
      <DailyCallCustomerDetailModal
        isOpen
        customer={baseCustomer}
        currentUser={null}
        onClose={() => {}}
      />
    );

    expect(screen.getByRole('dialog').parentElement?.parentElement).toBe(document.body);
  });

  it('renders above the global navigation layer', () => {
    render(
      <DailyCallCustomerDetailModal
        isOpen
        customer={baseCustomer}
        currentUser={null}
        onClose={() => {}}
      />
    );

    expect(screen.getByTestId('customer-detail-backdrop')).toHaveClass('z-[2000]');
  });

  it('shows a VIP badge beside the customer name when last month spend earns a discount', () => {
    render(
      <DailyCallCustomerDetailModal
        isOpen
        customer={{ ...baseCustomer, lastMonthOrder: 35000 }}
        currentUser={null}
        onClose={() => {}}
      />
    );

    expect(screen.getByRole('heading', { name: /vip parts center/i })).toBeInTheDocument();
    expect(screen.getByAltText(/VIP Gold badge|VIP Silver badge/i)).toBeInTheDocument();
  });

  it('does not show a VIP badge when last month spend has no discount tier', () => {
    render(
      <DailyCallCustomerDetailModal
        isOpen
        customer={{ ...baseCustomer, dealerPriceGroup: 'VIP 1', lastMonthOrder: 5000 }}
        currentUser={null}
        onClose={() => {}}
      />
    );

    expect(screen.queryByAltText(/VIP Gold badge|VIP Silver badge/i)).not.toBeInTheDocument();
  });
});
