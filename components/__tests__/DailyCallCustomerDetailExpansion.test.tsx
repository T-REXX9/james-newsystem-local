import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import DailyCallCustomerDetailExpansion from '../DailyCallCustomerDetailExpansion';

vi.mock('../SalesReportTab', () => ({
  default: () => <div>Sales tab content</div>,
}));

vi.mock('../ItemIssueReportTab', () => ({
  default: () => <div>Item issue tab content</div>,
}));

vi.mock('../IncidentReportTab', () => ({
  default: () => <div>Incident tab content</div>,
}));

vi.mock('../SalesReturnTab', () => ({
  default: () => <div>Returns tab content</div>,
}));

vi.mock('../PurchaseHistoryTab', () => ({
  default: () => <div>Purchase tab content</div>,
}));

vi.mock('../PersonalCommentsTab', () => ({
  default: () => <div>Comments tab content</div>,
}));

vi.mock('../LBCRTOTab', () => ({
  default: () => <div>LBC RTO tab content</div>,
}));

vi.mock('../../services/vipTierSettingsService', () => ({
  getVipTierConfig: vi.fn(async () => ({
    silver_entry_threshold: 10000,
    gold_entry_threshold: 30000,
    silver_maintenance_threshold: 5000,
    gold_maintenance_threshold: 10000,
  })),
  setVipTierConfig: vi.fn(async (config) => config),
}));

const customer = {
  id: 'customer-1',
  source: 'Manual',
  assignedTo: 'Jane Doe',
  assignedDate: '2026-04-01',
  clientSince: '2026-02-24',
  province: 'Cebu',
  city: 'Cebu City',
  shopName: 'Injector Cebu Diesel Injection Specialist',
  contactNumber: '09177081946',
  codeDate: 'gold (Jan 1, 1970)',
  dealerPriceGroup: 'gold',
  dealerPriceDate: 'Jan 1, 1970',
  ishinomotoDealerSince: 'Jan 1, 1970',
  ishinomotoSignageSince: '—',
  quota: 0,
  terms: 'AP/TT-PNB',
  modeOfPayment: 'AP/TT-PNB',
  courier: 'AP REGULAR',
  status: 'Active',
  statusDate: 'Sep 22, 2020',
  outstandingBalance: 1115072,
  averageMonthlyOrder: 48666,
  monthlyOrder: 80000,
  weeklyRangeTotals: [],
  dailyActivity: [],
} as any;

describe('DailyCallCustomerDetailExpansion', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the new item issue reports tab and switches to it', async () => {
    const user = userEvent.setup();

    render(<DailyCallCustomerDetailExpansion customer={customer} currentUser={null} />);

    expect(screen.getByText('Sales tab content')).toBeInTheDocument();
    expect(screen.getByText('VIP Standing')).toBeInTheDocument();
    expect(screen.getByText('Gold VIP')).toBeInTheDocument();
    expect(screen.getByText(/Current month spend: ₱80,000/i)).toBeInTheDocument();
    expect(screen.getByText(/Gold VIP maintenance guidance is at least ₱10,000/i)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /item issue reports/i }));

    expect(screen.getByText('Item issue tab content')).toBeInTheDocument();
  });

  it('points staff to the dedicated maintenance page for vip threshold changes', () => {
    render(
      <DailyCallCustomerDetailExpansion
        customer={customer}
        currentUser={{ id: 'master-1', role: 'Master User', full_name: 'Master User' } as any}
      />
    );

    expect(screen.getAllByText(/Managed in Maintenance > Customer > VIP Thresholds/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /edit vip rules/i })).not.toBeInTheDocument();
  });
});
