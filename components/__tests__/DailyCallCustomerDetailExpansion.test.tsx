import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import DailyCallCustomerDetailExpansion from '../DailyCallCustomerDetailExpansion';

const fetchContactCustomerLogsForDailyCallMock = vi.fn(async () => []);
const getLedgerMock = vi.fn();

vi.mock('../../services/dailyCallMonitoringService', () => ({
  fetchContactCustomerLogsForDailyCall: (...args: unknown[]) => fetchContactCustomerLogsForDailyCallMock(...args),
}));

vi.mock('../../services/customerLedgerService', async () => {
  const actual = await vi.importActual<typeof import('../../services/customerLedgerService')>(
    '../../services/customerLedgerService'
  );
  return {
    ...actual,
    customerLedgerService: {
      ...actual.customerLedgerService,
      getLedger: (...args: unknown[]) => getLedgerMock(...args),
    },
  };
});

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

vi.mock('../CustomerSalesReportChat', () => ({
  default: ({ compact }: { compact?: boolean }) => (
    <div>{compact ? 'Compact agent sales report chat' : 'Full agent sales report chat'}</div>
  ),
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
  beforeEach(() => {
    getLedgerMock.mockResolvedValue({ summary_rows: [], rows: [] });
    fetchContactCustomerLogsForDailyCallMock.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    getLedgerMock.mockReset();
    fetchContactCustomerLogsForDailyCallMock.mockReset();
    vi.restoreAllMocks();
  });

  it('shows ledger yearly sales on Overview without changing tabs', async () => {
    getLedgerMock.mockResolvedValue({
      summary_rows: [
        { year: 2013, month: 0, month_name: '', debit: 26000, credit: 0, balance: 0 },
        { year: 2014, month: 0, month_name: '', debit: 90000, credit: 0, balance: 0 },
        { year: 2015, month: 0, month_name: '', debit: 45000, credit: 0, balance: 0 },
        { year: 2016, month: 0, month_name: '', debit: 51000, credit: 0, balance: 0 },
        { year: 2017, month: 0, month_name: '', debit: 62000, credit: 0, balance: 0 },
        { year: 2018, month: 0, month_name: '', debit: 71000, credit: 0, balance: 0 },
        { year: 2019, month: 0, month_name: '', debit: 80000, credit: 0, balance: 0 },
        { year: 2020, month: 0, month_name: '', debit: 55000, credit: 0, balance: 0 },
        { year: 2021, month: 0, month_name: '', debit: 88000, credit: 0, balance: 0 },
        { year: 2022, month: 0, month_name: '', debit: 92000, credit: 0, balance: 0 },
        { year: 2023, month: 0, month_name: '', debit: 99000, credit: 0, balance: 0 },
        { year: 2024, month: 0, month_name: '', debit: 110000, credit: 0, balance: 0 },
      ],
      rows: [],
    });

    render(<DailyCallCustomerDetailExpansion customer={customer} currentUser={null} />);

    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');

    const yearlySales = await screen.findByTestId('customer-yearly-sales');
    expect(yearlySales).toHaveAttribute('data-compact', 'true');
    expect(yearlySales).toHaveAttribute('data-year-count', '12');
    expect(within(yearlySales).getByRole('heading', { name: /Yearly Sales/i })).toBeInTheDocument();
    for (const year of [2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]) {
      expect(within(yearlySales).getByText(String(year))).toBeInTheDocument();
    }
    expect(within(yearlySales).getByText('₱26,000')).toBeInTheDocument();
    expect(within(yearlySales).getByText('₱90,000')).toBeInTheDocument();
    expect(within(yearlySales).queryByRole('button')).not.toBeInTheDocument();
    expect(getLedgerMock).toHaveBeenCalledWith('customer-1', { reportType: 'yearly', dateType: 'all' });
  });

  it('matches the customer-detail template and switches to report tabs', async () => {
    const user = userEvent.setup();

    render(<DailyCallCustomerDetailExpansion customer={customer} currentUser={null} />);

    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Payment & Credit')).toBeInTheDocument();
    expect(screen.getByText('Sales Snapshot (MTD)')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Agent Sales Report' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Agent Sales Report' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Management Instructions' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Sales Agent Activity' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Communication Timeline' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Communication Timeline/i })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Quick Actions' })).toBeInTheDocument();
    expect(await screen.findByText('VIP GOLD')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Sales Inquiry' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Orders' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Collections' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Sales Returns' })).not.toBeInTheDocument();
    expect(screen.getByText('Compact agent sales report chat')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Agent Sales Report' }));
    expect(screen.getByText('Full agent sales report chat')).toBeInTheDocument();

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

  it('shows the Do Not Contact reason in the primary customer summary', async () => {
    fetchContactCustomerLogsForDailyCallMock.mockResolvedValueOnce([{
      id: 'status-1',
      contact_id: 'customer-1',
      entry_type: 'Status',
      topic: 'Status',
      status: 'Do Not Contact',
      note: 'Customer requested no further calls',
      promise_to_pay: '',
      comments: '',
      attachment: null,
      occurred_at: '2026-09-10T00:00:00.000Z',
      created_by: 'master-1',
      created_by_name: 'Master User',
    }]);

    render(
      <DailyCallCustomerDetailExpansion
        customer={{ ...customer, status: 'Blacklisted' }}
        currentUser={null}
        viewOnlyDoNotContact
      />
    );

    const summaryReason = await screen.findByText('Do Not Contact reason', { exact: true });
    expect(summaryReason.parentElement).toHaveTextContent('Customer requested no further calls');
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

    await user.click(screen.getByRole('tab', { name: 'Agent Sales Report' }));
    expect(screen.getByText('Full agent sales report chat')).toBeInTheDocument();
    expect(screen.getByText(/Management instructions and staff comments appear in the same conversation/i)).toBeInTheDocument();
  });

  it('opens the Agent Sales Report chat from quick actions and removes decorative AI actions', async () => {
    const user = userEvent.setup();
    render(
      <DailyCallCustomerDetailExpansion
        customer={customer}
        currentUser={{ id: 'master-1', role: 'Master User', full_name: 'Master User' } as any}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Agent Sales Report' }));

    expect(screen.getByText('Full agent sales report chat')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'AI SMS' })).not.toBeInTheDocument();
    expect(screen.queryByText('AI follow-up review')).not.toBeInTheDocument();
  });
});
