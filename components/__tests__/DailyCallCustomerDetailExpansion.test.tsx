import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import DailyCallCustomerDetailExpansion from '../DailyCallCustomerDetailExpansion';

const fetchManagementInstructionsMock = vi.fn(async () => []);

vi.mock('../../services/dailyCallMonitoringService', () => ({
  fetchManagementInstructions: (...args: unknown[]) => fetchManagementInstructionsMock(...args),
}));

vi.mock('../SalesReportTab', () => ({
  default: () => <div>Sales tab content</div>,
}));

vi.mock('../ItemIssueReportTab', () => ({
  default: () => <div>Item issue tab content</div>,
}));

vi.mock('../IncidentReportTab', () => ({
  default: () => <div>Incident tab content</div>,
}));

vi.mock('../PersonalCommentsTab', () => ({
  default: () => <div>Comments tab content</div>,
}));

vi.mock('../CallReportActivityPanel', () => ({
  default: ({ compact }: { compact?: boolean }) => (
    <div>{compact ? 'Compact sales agent reports' : 'Full sales agent reports'}</div>
  ),
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
  lastMonthOrder: 80000,
  weeklyRangeTotals: [],
  dailyActivity: [],
} as any;

describe('DailyCallCustomerDetailExpansion', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('matches the customer-detail template and switches to report tabs', async () => {
    const user = userEvent.setup();

    render(<DailyCallCustomerDetailExpansion customer={customer} currentUser={null} />);

    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Payment & Credit')).toBeInTheDocument();
    expect(screen.getByText('Sales Snapshot (MTD)')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Management Instructions' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Sales Agent Activity/i })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Communication Timeline' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Communication Timeline/i })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Quick Actions' })).toBeInTheDocument();
    expect(await screen.findByText('VIP GOLD')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Sales Inquiry' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Orders' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Collections' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Sales Returns' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Item Issues' }));

    expect(screen.getByText('Item issue tab content')).toBeInTheDocument();
  });

  it('shows preferred brand on the master customer profile', () => {
    render(
      <DailyCallCustomerDetailExpansion
        customer={{ ...customer, preferredBrand: 'Ishinomoto' }}
        currentUser={null}
      />
    );

    const label = screen.getByText('Preferred Brand');
    expect(label).toBeInTheDocument();
    expect(label.parentElement).toHaveTextContent('Ishinomoto');
  });

  it('shows a dash when preferred brand is unset', () => {
    render(
      <DailyCallCustomerDetailExpansion
        customer={{ ...customer, preferredBrand: '' }}
        currentUser={null}
      />
    );

    const label = screen.getByText('Preferred Brand');
    expect(label.parentElement).toHaveTextContent('—');
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

  it('shows submitted sales-agent reports in the master customer activity view', async () => {
    const user = userEvent.setup();
    render(
      <DailyCallCustomerDetailExpansion
        customer={customer}
        currentUser={{ id: 'master-1', role: 'Master User', full_name: 'Master User', user_type: '1' } as any}
      />
    );

    await user.click(screen.getByRole('tab', { name: 'Sales Agent Activity' }));
    expect(screen.getByText('Full sales agent reports')).toBeInTheDocument();
    expect(screen.getByText(/Master Users can reply directly to each report/)).toBeInTheDocument();
  });

  it('opens the real management-instruction form and removes decorative quick actions', async () => {
    const user = userEvent.setup();
    render(
      <DailyCallCustomerDetailExpansion
        customer={customer}
        currentUser={{ id: 'master-1', role: 'Master User', full_name: 'Master User' } as any}
      />
    );

    await user.click(screen.getByRole('button', { name: '+ Add Instruction' }));

    expect(screen.getByText('Comments tab content')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'AI SMS' })).not.toBeInTheDocument();
    expect(screen.queryByText('AI follow-up review')).not.toBeInTheDocument();
  });
});
