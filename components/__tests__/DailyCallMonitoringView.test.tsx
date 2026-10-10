import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import DailyCallMonitoringView from '../DailyCallMonitoringView';

const addToastMock = vi.fn();
const fetchAgentSnapshotForDailyCallMock = vi.fn();
const fetchContactCustomerLogsForDailyCallMock = vi.fn();
const fetchSalesReportDirectoryStateMock = vi.fn();
const fetchDailySubmittedSalesReportContactIdsMock = vi.fn();
const createCallLogForDailyCallMock = vi.fn();
const claimCustomerCallForDailyCallMock = vi.fn();
const releaseCustomerCallForDailyCallMock = vi.fn();
const setDailyCallBookmarkMock = vi.fn();
const createCustomerLogForDailyCallMock = vi.fn();
const subscribeToDailyCallMonitoringUpdatesMock = vi.fn(() => () => {});
const createContactMock = vi.fn();
const updateContactMock = vi.fn();
const fetchContactByIdMock = vi.fn();
const fetchContactForDailyCallMock = vi.fn();

vi.mock('../ToastProvider', () => ({
  useToast: () => ({
    addToast: addToastMock,
  }),
}));

vi.mock('../../services/dailyCallMonitoringService', () => ({
  fetchDailyCallSalesColorBreakdown: vi.fn().mockResolvedValue({
    month: '2026-10', company_total: 0, agents: [],
    unassigned: { id: '', name: 'Unassigned', customer_count: 0, sales: 0, unclassified_sales: 0, colors: {
      green: { customer_count: 0, sales: 0 }, yellow: { customer_count: 0, sales: 0 },
      purple: { customer_count: 0, sales: 0 }, white: { customer_count: 0, sales: 0 }, red: { customer_count: 0, sales: 0 },
    } },
  }),
  fetchAgentSnapshotForDailyCall: (...args: unknown[]) => fetchAgentSnapshotForDailyCallMock(...args),
  fetchContactCustomerLogsForDailyCall: (...args: unknown[]) => fetchContactCustomerLogsForDailyCallMock(...args),
  fetchSalesReportDirectoryState: (...args: unknown[]) => fetchSalesReportDirectoryStateMock(...args),
  fetchDailySubmittedSalesReportContactIds: (...args: unknown[]) => fetchDailySubmittedSalesReportContactIdsMock(...args),
  createCallLogForDailyCall: (...args: unknown[]) => createCallLogForDailyCallMock(...args),
  claimCustomerCallForDailyCall: (...args: unknown[]) => claimCustomerCallForDailyCallMock(...args),
  releaseCustomerCallForDailyCall: (...args: unknown[]) => releaseCustomerCallForDailyCallMock(...args),
  setDailyCallBookmark: (...args: unknown[]) => setDailyCallBookmarkMock(...args),
  createCustomerLogForDailyCall: (...args: unknown[]) => createCustomerLogForDailyCallMock(...args),
  subscribeToDailyCallMonitoringUpdates: (...args: unknown[]) => subscribeToDailyCallMonitoringUpdatesMock(...args),
}));

vi.mock('../../services/customerDatabaseLocalApiService', () => ({
  createContact: (...args: unknown[]) => createContactMock(...args),
  updateContact: (...args: unknown[]) => updateContactMock(...args),
  fetchContactById: (...args: unknown[]) => fetchContactByIdMock(...args),
  fetchContactForDailyCall: (...args: unknown[]) => fetchContactForDailyCallMock(...args),
}));

vi.mock('../CustomLoadingSpinner', () => ({
  default: ({ label }: { label?: string }) => <div>{label || 'Loading'}</div>,
}));

vi.mock('../CustomerSalesReportChat', () => ({
  default: ({ contactId }: { contactId: string }) => (
    <div role="region" aria-label="Agent Sales Report">Agent Sales Report chat for {contactId}</div>
  ),
}));

vi.mock('../AgentCallActivity', () => ({
  default: () => <div>AgentCallActivity</div>,
}));

vi.mock('../ContactDetails', () => ({
  default: ({ contact, permissionPage, showAgentSalesReportInOverview }: { contact: { id: string; businessLine?: string; contactPersons?: Array<{ name?: string }>; phone?: string }; permissionPage?: string; showAgentSalesReportInOverview?: boolean }) => (
    <div data-testid="full-contact-details" data-permission-page={permissionPage} data-unified-report={showAgentSalesReportInOverview ? 'true' : 'false'}>
      {contact.id}:{contact.businessLine || 'blank-overview'}
      <span>{contact.contactPersons?.[0]?.name || 'No Contact Person'}</span>
      <span>{contact.phone || 'No Contact Number'}</span>
    </div>
  ),
}));

vi.mock('../CreateIncidentReportModal', () => ({
  default: ({ contactId, isOpen }: { contactId: string; isOpen: boolean }) => isOpen
    ? <div role="dialog" aria-label={`Create incident report for ${contactId}`}>Incident report form</div>
    : null,
}));

vi.mock('../AddContactModal', () => ({
  default: () => null,
}));

vi.mock('recharts', () => ({
  PieChart: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Pie: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Cell: () => null,
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tooltip: () => null,
  Legend: () => null,
}));

const currentUser = {
  id: 'agent-1',
  full_name: 'Jane Doe',
  email: 'jane@example.com',
  role: 'Sales Agent',
  access_rights: ['home'],
} as any;

const baseSnapshot = {
  contacts: [
    {
      id: 'contact-1',
      shopName: 'Test Shop',
      contactPersonName: 'Maria Santos',
      assignedTo: 'Jane Doe',
      province: 'Davao del Sur',
      city: 'Davao City',
      contactNumber: '09123456789',
      source: 'Manual',
      clientSince: '2026-01-01',
      dealerPriceGroup: 'gold',
      dealerPriceDate: '2026-01-01',
      ishinomotoDealerSince: '2026-01-01',
      ishinomotoSignageSince: '2026-01-01',
      quota: 0,
      terms: 'COD',
      modeOfPayment: 'COD',
      courier: 'LBC',
      status: 'prospective',
      verification: 'Unverified',
      statusDate: '2026-04-01',
      outstandingBalance: 0,
      averageMonthlyOrder: 0,
      monthlyOrder: 0,
      weeklyRangeTotals: [],
      dailyActivity: [],
    },
  ],
  callLogs: [],
  inquiries: [],
  purchases: [],
  teamMessages: [],
};

describe('DailyCallMonitoringView communication actions', () => {
  const expandSummaries = async () => {
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Sales summaries/i }));
  };
  const expandList = async (label: string, user = userEvent.setup()) => {
    await user.click(await screen.findByRole('button', { name: new RegExp(`^${label}`, 'i') }));
    return user;
  };

  beforeEach(() => {
    cleanup();
    addToastMock.mockReset();
    fetchAgentSnapshotForDailyCallMock.mockReset();
    fetchContactCustomerLogsForDailyCallMock.mockReset();
    fetchSalesReportDirectoryStateMock.mockReset();
    fetchDailySubmittedSalesReportContactIdsMock.mockReset();
    createCallLogForDailyCallMock.mockReset();
    claimCustomerCallForDailyCallMock.mockReset();
    releaseCustomerCallForDailyCallMock.mockReset();
    setDailyCallBookmarkMock.mockReset();
    createCustomerLogForDailyCallMock.mockReset();
    subscribeToDailyCallMonitoringUpdatesMock.mockClear();
    createContactMock.mockReset();
    updateContactMock.mockReset();
    fetchContactByIdMock.mockReset();
    fetchContactForDailyCallMock.mockReset();
    updateContactMock.mockResolvedValue(undefined);

    fetchAgentSnapshotForDailyCallMock.mockResolvedValue(baseSnapshot);
    setDailyCallBookmarkMock.mockImplementation(async (contactId: string | null) => contactId);
    fetchContactCustomerLogsForDailyCallMock.mockResolvedValue([]);
    fetchSalesReportDirectoryStateMock.mockResolvedValue({ unreadByContact: {}, reportedContactIds: new Set() });
    fetchDailySubmittedSalesReportContactIdsMock.mockResolvedValue(new Set());
    fetchContactByIdMock.mockResolvedValue({
      id: 'contact-1',
      company: 'Test Shop',
      phone: '09123456789',
      mobile: '09123456789',
      email: 'shop@example.com',
      contactPersons: [{
        id: 'person-1',
        enabled: true,
        name: 'Juan Dela Cruz',
        position: 'Purchasing Manager',
        birthday: '',
        telephone: '0281234567',
        mobile: '09987654321',
        email: 'juan@example.com',
      }],
    });
    fetchContactForDailyCallMock.mockResolvedValue({
      id: 'contact-1',
      company: 'Test Shop',
      businessLine: 'Diesel Injection',
    });
    claimCustomerCallForDailyCallMock.mockResolvedValue({
      contact_id: 'contact-1', status: 'in_progress', agent_user_id: 'agent-1', agent_name: 'Jane Doe',
    });
    releaseCustomerCallForDailyCallMock.mockResolvedValue(undefined);

    if (!(globalThis as any).ResizeObserver) {
      (globalThis as any).ResizeObserver = class {
        observe() {}
        disconnect() {}
        unobserve() {}
      };
    }
  });

  it('keeps customer lists primary and reveals sales summaries on demand', async () => {
    const user = userEvent.setup();
    render(<DailyCallMonitoringView currentUser={currentUser} />);

    const toggle = await screen.findByRole('button', { name: /Sales summaries/i });
    expect(screen.queryByLabelText('Customer category summaries')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Segregated customer category tables')).toBeInTheDocument();

    await user.click(toggle);

    expect(screen.getByRole('dialog', { name: 'Sales summaries' })).toBeInTheDocument();
    expect(screen.getByLabelText('Customer category summaries')).toBeInTheDocument();
    expect(await screen.findByText('Team sales by Daily Call status')).toBeInTheDocument();
  });

  it('expands only the selected category for all five customer lists', async () => {
    render(<DailyCallMonitoringView currentUser={currentUser} />);
    const categoryGrid = await screen.findByLabelText('Segregated customer category tables');
    expect(categoryGrid).toHaveClass('grid-cols-6');
    expect(await screen.findByText('Test Shop')).toBeInTheDocument();
    for (const id of ['priority', 'recovery', 'verified', 'unverified', 'blocked']) {
      expect(document.getElementById(`${id}-customer-list`)).toBeInTheDocument();
    }

    for (const [label, id] of [
      ['Priority List', 'priority'],
      ['Recovery List', 'recovery'],
      ['Verified Prospects', 'verified'],
      ['Unverified Prospects', 'unverified'],
      ['blacklisted/rejected -do not contact', 'blocked'],
    ]) {
      await expandList(label);
      const expandedButton = screen.getByRole('button', { name: new RegExp(`^${label}`, 'i') });
      expect(expandedButton).toHaveAttribute('aria-expanded', 'true');
      expect(expandedButton.closest('article')).toHaveClass('col-span-2');
      expect(document.getElementById(`${id}-customer-list`)).toBeInTheDocument();
      expect(screen.getByText('Test Shop')).toBeInTheDocument();
      const categoryButtons = screen.getAllByRole('button', { name: /^(Priority List|Recovery List|Verified Prospects|Unverified Prospects|blacklisted\/rejected)/i });
      expect(categoryButtons.filter((button) => button.getAttribute('aria-expanded') === 'true')).toHaveLength(1);
      for (const button of categoryButtons) {
        expect(button.closest('article')).toHaveClass(button === expandedButton ? 'col-span-2' : 'col-span-1');
      }
    }
  });

  it('shows a Sales Map shortcut that navigates to the Sales Map route', async () => {
    const user = userEvent.setup();
    const navigationHandler = vi.fn();
    window.addEventListener('workflow:navigate', navigationHandler);

    render(<DailyCallMonitoringView currentUser={currentUser} />);
    await user.click(await screen.findByRole('button', { name: /Sales Map/i }));

    expect(navigationHandler).toHaveBeenCalledOnce();
    expect(navigationHandler.mock.calls[0][0]).toMatchObject({
      detail: { tab: 'sales-reports-sales-map' },
    });
    window.removeEventListener('workflow:navigate', navigationHandler);
  });

  it('restores board filters and search after browser Back remounts the page', async () => {
    const user = userEvent.setup();
    window.sessionStorage.clear();
    window.history.replaceState(null, '', '/#/sales-transaction-daily-call-monitoring');
    const firstRender = render(<DailyCallMonitoringView currentUser={currentUser} />);

    const customerSearch = await screen.findByRole('textbox', { name: 'Search by customer name' });
    await user.type(customerSearch, 'Test Shop');
    await user.click(screen.getByText('Filters & legend').closest('button') as HTMLButtonElement);
    await user.selectOptions(screen.getByLabelText('Color status'), 'green');

    window.history.pushState(null, '', '/#/sales-reports-sales-map');
    firstRender.unmount();
    window.history.replaceState(null, '', '/#/sales-transaction-daily-call-monitoring');

    render(<DailyCallMonitoringView currentUser={currentUser} />);

    expect(await screen.findByRole('textbox', { name: 'Search by customer name' })).toHaveValue('Test Shop');
    await user.click(await screen.findByText('Filters & legend').then((label) => label.closest('button') as HTMLButtonElement));
    expect(screen.getByLabelText('Color status')).toHaveValue('green');
  });

  it('uses API debt and customer status rather than outstanding balance for do-not-contact classification', async () => {
    fetchAgentSnapshotForDailyCallMock.mockResolvedValue({
      ...baseSnapshot,
      contacts: [
        {
          ...baseSnapshot.contacts[0],
          id: 'good-debt-with-balance',
          shopName: 'Good Debt With Balance',
          status: 'active',
          customerStatus: 1,
          debtType: 'Good',
          outstandingBalance: 5000,
        },
        {
          ...baseSnapshot.contacts[0],
          id: 'blacklisted-by-status',
          shopName: 'Blacklisted By Status',
          status: 'active',
          customerStatus: 4,
          debtType: 'Good',
          outstandingBalance: 0,
        },
      ],
    });

    render(<DailyCallMonitoringView currentUser={currentUser} />);

    await expandList('blacklisted/rejected -do not contact');
    const blockedList = (await screen.findByText('Blacklisted By Status')).closest('article')!;
    expect(within(blockedList).getByText('Blacklisted By Status')).toBeInTheDocument();
    expect(within(blockedList).queryByText('Good Debt With Balance')).not.toBeInTheDocument();
  });

  it('shows company-wide do-not-contact identities without exposing contact or sales actions', async () => {
    fetchAgentSnapshotForDailyCallMock.mockResolvedValue({
      ...baseSnapshot,
      doNotContactCustomers: [{
        id: 'foreign-blocked-customer',
        shopName: 'Foreign Blacklist Customer',
        assignedTo: 'Other Sales Agent',
        assignedTeam: 'Beta',
      }],
    });

    render(<DailyCallMonitoringView currentUser={currentUser} />);
    await expandList('blacklisted/rejected -do not contact');

    const blockedList = document.getElementById('blocked-customer-list')!;
    expect(within(blockedList).getByText('Foreign Blacklist Customer')).toBeInTheDocument();
    expect(within(blockedList).getByText('Assigned to Other Sales Agent · Beta')).toBeInTheDocument();
    expect(within(blockedList).getByText('Do not contact')).toBeInTheDocument();
    expect(within(blockedList).queryByText('09123456789')).not.toBeInTheDocument();
    expect(within(blockedList).queryByRole('button', { name: /Call Foreign Blacklist Customer/i })).not.toBeInTheDocument();
    expect(within(blockedList).queryByRole('button', { name: /Send SMS to Foreign Blacklist Customer/i })).not.toBeInTheDocument();
    expect(within(blockedList.closest('article')!).getByText('Showing 1 to 1 of 1 entries')).toBeInTheDocument();
  });

  it('uses the Master List purchase date for agent color coding when snapshot transaction dates disagree', async () => {
    fetchAgentSnapshotForDailyCallMock.mockResolvedValue({
      ...baseSnapshot,
      contacts: [{ ...baseSnapshot.contacts[0], id: 'color-date-customer', shopName: 'Color Date Customer', status: 'active' }],
      purchases: [{ id: 'linked-order', contact_id: 'color-date-customer', amount: 100, status: 'paid', purchased_at: '2026-09-20' }],
      masterList: [{
        id: 'color-date-customer', shopName: 'Color Date Customer', assignedTo: 'Jane Doe',
        lastPurchaseDateRaw: '2026-07-15', currentMonthSales: 0,
      }],
    });

    render(<DailyCallMonitoringView currentUser={currentUser} initialSelectedDate="2026-10-02" />);

    const customerName = await screen.findByText('Color Date Customer');
    expect(customerName.closest('tr')).toHaveAttribute('title', 'No purchase for 3+ months');
  });

  afterEach(() => {
    cleanup();
  });

  it('saves a calling stop on a Priority List customer and marks it in the list', async () => {
    const user = userEvent.setup();
    fetchAgentSnapshotForDailyCallMock.mockResolvedValue({
      ...baseSnapshot,
      contacts: [{ ...baseSnapshot.contacts[0], id: 'priority-stop', shopName: 'Stop Point Shop', status: 'active' }],
      purchases: [{
        id: 'purchase-stop',
        contact_id: 'priority-stop',
        amount: 500,
        status: 'paid',
        purchased_at: new Date().toISOString(),
      }],
    });
    setDailyCallBookmarkMock.mockResolvedValue('priority-stop');

    render(<DailyCallMonitoringView currentUser={currentUser} />);

    const setBookmarkButton = await screen.findByRole('button', { name: 'Set calling stop at Stop Point Shop' });
    await user.click(setBookmarkButton);

    expect(setDailyCallBookmarkMock).toHaveBeenCalledWith('priority-stop');
    expect(await screen.findByText('Stop after Stop Point Shop')).toBeInTheDocument();
    expect(screen.getByText('Stop here')).toBeInTheDocument();
  });

  it.each([
    {
      label: 'Recovery List',
      id: 'recovery-bookmark',
      name: 'Recovery Bookmark Shop',
      status: 'active',
      master: { listCategory: 'recovery', purchaseCount: 1, lastPurchaseDateRaw: '2025-09-01' },
    },
    {
      label: 'Verified Prospects',
      id: 'verified-bookmark',
      name: 'Verified Bookmark Prospect',
      status: 'verified_prospect',
      master: { profileType: 'Prospect', verification: 'Verified', verifiedInSystem: true, customerStatus: 3, listCategory: 'no_purchase' },
    },
    {
      label: 'Unverified Prospects',
      id: 'unverified-bookmark',
      name: 'Unverified Bookmark Prospect',
      status: 'prospective',
      master: { profileType: 'Prospect', verification: 'Unverified', customerStatus: 3, listCategory: 'no_purchase' },
    },
  ])('saves a calling stop from $label', async ({ label, id, name, status, master }) => {
    const user = userEvent.setup();
    fetchAgentSnapshotForDailyCallMock.mockResolvedValue({
      ...baseSnapshot,
      contacts: [{ ...baseSnapshot.contacts[0], id, shopName: name, status }],
      masterList: [{
        id,
        shopName: name,
        purchaseCount: 0,
        priorityTransactionCount: 0,
        ledgerTransactionCount: 0,
        historicalTransactionCount: 0,
        ...master,
      }],
    });
    setDailyCallBookmarkMock.mockImplementation(async (contactId: string | null) => contactId);

    render(<DailyCallMonitoringView currentUser={currentUser} />);
    await expandList(label, user);
    await user.click(await screen.findByRole('button', { name: `Set calling stop at ${name}` }));

    expect(setDailyCallBookmarkMock).toHaveBeenCalledWith(id);
    expect(await screen.findByText(`Stop after ${name}`)).toBeInTheDocument();
    cleanup();
  });

  it('keeps the saved-stop clear action available when search hides the bookmarked customer', async () => {
    const user = userEvent.setup();
    fetchAgentSnapshotForDailyCallMock.mockResolvedValue({
      ...baseSnapshot,
      contacts: [{ ...baseSnapshot.contacts[0], id: 'filtered-bookmark', shopName: 'Filtered Recovery Shop', status: 'active' }],
      masterList: [{ id: 'filtered-bookmark', shopName: 'Filtered Recovery Shop', listCategory: 'recovery', purchaseCount: 1, lastPurchaseDateRaw: '2025-09-01' }],
    });
    setDailyCallBookmarkMock.mockImplementation(async (contactId: string | null) => contactId);

    render(<DailyCallMonitoringView currentUser={currentUser} />);
    await expandList('Recovery List', user);
    await user.click(await screen.findByRole('button', { name: 'Set calling stop at Filtered Recovery Shop' }));
    await user.type(screen.getByRole('textbox', { name: 'Search by customer name' }), 'no matching customer');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument());
    expect(screen.getByText('Stop after Filtered Recovery Shop')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(setDailyCallBookmarkMock).toHaveBeenLastCalledWith(null);
  });

  it('prioritizes the 15-to-30-day cadence, overdue buyers, no-history customers, then very recent buyers', async () => {
    const purchasedAt = (daysAgo: number) => new Date(Date.now() - (daysAgo * 86_400_000)).toISOString();
    fetchAgentSnapshotForDailyCallMock.mockResolvedValue({
      ...baseSnapshot,
      contacts: [
        {
          ...baseSnapshot.contacts[0],
          id: 'contact-cadence',
          shopName: 'Cadence Window Shop',
        },
        {
          ...baseSnapshot.contacts[0],
          id: 'contact-overdue',
          shopName: 'Overdue Shop',
        },
        {
          ...baseSnapshot.contacts[0],
          id: 'contact-fresh',
          shopName: 'Fresh Purchase Shop',
        },
        {
          ...baseSnapshot.contacts[0],
          id: 'contact-never',
          shopName: 'No Purchase Shop',
        },
      ],
      purchases: [
        {
          id: 'purchase-cadence',
          contact_id: 'contact-cadence',
          amount: 100,
          status: 'paid',
          purchased_at: purchasedAt(20),
        },
        {
          id: 'purchase-overdue',
          contact_id: 'contact-overdue',
          amount: 100_000,
          status: 'paid',
          purchased_at: '2025-09-01T00:00:00.000Z',
        },
        {
          id: 'purchase-fresh',
          contact_id: 'contact-fresh',
          amount: 200_000,
          status: 'paid',
          purchased_at: purchasedAt(5),
        },
      ],
    });

    render(<DailyCallMonitoringView currentUser={currentUser} />);

    expect(await screen.findByLabelText('Customer board controls')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'All Clients' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: "Today's List" })).not.toBeInTheDocument();
    expect(screen.queryByText('Monthly Quota')).not.toBeInTheDocument();

    await expandSummaries();
    const categorySummaries = screen.getByLabelText('Customer category summaries');
    const prioritySummary = within(categorySummaries)
      .getByRole('heading', { name: 'Priority List' })
      .closest('article')!;
    const recoverySummary = within(categorySummaries)
      .getByRole('heading', { name: 'Recovery List' })
      .closest('article')!;
    const verifiedSummary = within(categorySummaries)
      .getByRole('heading', { name: 'Verified Prospects' })
      .closest('article')!;
    const unverifiedSummary = within(categorySummaries)
      .getByRole('heading', { name: 'Unverified Prospects' })
      .closest('article')!;

    expect(within(prioritySummary).getByText('2')).toBeInTheDocument();
    expect(within(recoverySummary).getByText('1')).toBeInTheDocument();
    expect(within(verifiedSummary).getByText('0')).toBeInTheDocument();
    expect(within(unverifiedSummary).getByText('1')).toBeInTheDocument();

    const categoryTables = screen.getByLabelText('Segregated customer category tables');
    const priorityTable = within(categoryTables)
      .getByTitle('Priority List (Any ledger activity since October 2025 onwards)')
      .closest('article')!;
    const recoveryTable = within(categoryTables)
      .getByTitle('Recovery List (Purchase history before October 2025, with none since)')
      .closest('article')!;
    const unverifiedTable = within(categoryTables)
      .getByTitle('Unverified Prospects (No purchases yet)')
      .closest('article')!;

    const cadenceRow = within(priorityTable).getByText('Cadence Window Shop').closest('tr')!;
    const freshRow = within(priorityTable).getByText('Fresh Purchase Shop').closest('tr')!;
    expect(cadenceRow.compareDocumentPosition(freshRow)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    await expandList('Recovery List');
    expect(within(recoveryTable).getByText('Overdue Shop')).toBeInTheDocument();
    await expandList('Unverified Prospects');
    expect(within(unverifiedTable).getByText('No Purchase Shop')).toBeInTheDocument();
  });

  it('does not show lifetime purchase totals as Potential Sales (client report: ₱25M priority / ₱105K recovery)', async () => {
    // Feedback loop for dashboard Potential Sales: cards must not surface lifetime totals
    // as "Potential Sales" (documented formula uses average monthly sales instead).
    fetchAgentSnapshotForDailyCallMock.mockResolvedValue({
      ...baseSnapshot,
      contacts: [
        {
          ...baseSnapshot.contacts[0],
          id: 'priority-lifetime',
          shopName: 'Priority Lifetime Shop',
          status: 'active',
          verification: 'Verified',
        },
        {
          ...baseSnapshot.contacts[0],
          id: 'recovery-lifetime',
          shopName: 'Recovery Lifetime Shop',
          status: 'active',
          verification: 'Verified',
        },
        {
          ...baseSnapshot.contacts[0],
          id: 'test-client-prospect',
          shopName: 'Test Client',
          status: 'prospective',
          verification: 'Unverified',
        },
      ],
      purchases: [
        {
          id: 'purchase-priority-1',
          contact_id: 'priority-lifetime',
          amount: 5_000_000,
          status: 'paid',
          purchased_at: '2026-01-15T00:00:00.000Z',
        },
        {
          id: 'purchase-priority-2',
          contact_id: 'priority-lifetime',
          amount: 5_000_000,
          status: 'paid',
          purchased_at: '2026-02-15T00:00:00.000Z',
        },
        {
          id: 'purchase-priority-3',
          contact_id: 'priority-lifetime',
          amount: 5_000_000,
          status: 'paid',
          purchased_at: '2026-03-15T00:00:00.000Z',
        },
        {
          id: 'purchase-priority-4',
          contact_id: 'priority-lifetime',
          amount: 5_000_000,
          status: 'paid',
          purchased_at: '2026-04-15T00:00:00.000Z',
        },
        {
          id: 'purchase-priority-5',
          contact_id: 'priority-lifetime',
          amount: 5_000_000,
          status: 'paid',
          purchased_at: '2026-05-15T00:00:00.000Z',
        },
        {
          id: 'purchase-recovery-1',
          contact_id: 'recovery-lifetime',
          amount: 35_000,
          status: 'paid',
          purchased_at: '2024-01-10T00:00:00.000Z',
        },
        {
          id: 'purchase-recovery-2',
          contact_id: 'recovery-lifetime',
          amount: 35_000,
          status: 'paid',
          purchased_at: '2024-02-10T00:00:00.000Z',
        },
        {
          id: 'purchase-recovery-3',
          contact_id: 'recovery-lifetime',
          amount: 35_000,
          status: 'paid',
          purchased_at: '2024-03-10T00:00:00.000Z',
        },
      ],
    });

    render(<DailyCallMonitoringView currentUser={currentUser} />);

    expect(await screen.findByLabelText('Customer board controls')).toBeInTheDocument();

    await expandSummaries();
    const categorySummaries = screen.getByLabelText('Customer category summaries');
    const prioritySummary = within(categorySummaries)
      .getByRole('heading', { name: 'Priority List' })
      .closest('article')!;
    const recoverySummary = within(categorySummaries)
      .getByRole('heading', { name: 'Recovery List' })
      .closest('article')!;

    const priorityPotential = within(prioritySummary).getByText(/Potential sales/i).parentElement!;
    const recoveryPotential = within(recoverySummary).getByText(/Potential sales/i).parentElement!;

    // Lifetime totals would compact to ₱25M / ₱105K — Potential Sales must use monthly averages instead.
    expect(within(priorityPotential).queryByText('₱25M')).not.toBeInTheDocument();
    expect(within(recoveryPotential).queryByText('₱105K')).not.toBeInTheDocument();
    expect(priorityPotential).toHaveTextContent('₱5M');
    expect(recoveryPotential).toHaveTextContent('₱35K');

    // Client symptom: a Test Client record still appears in the prospect list.
    // (Deletion is handled by migration 039; this UI assertion documents the unwanted inclusion path.)
    const categoryTables = screen.getByLabelText('Segregated customer category tables');
    const unverifiedTable = within(categoryTables)
      .getByTitle('Unverified Prospects (No purchases yet)')
      .closest('article')!;
    // Soft-delete is a data migration; until deleted, prospective Test Client still lists here.
    // After migration 039, API no longer returns these rows. Keep the fixture to prove list membership rules.
    await expandList('Unverified Prospects');
    expect(within(unverifiedTable).getByText('Test Client')).toBeInTheDocument();
  });

  it('shows Current Month Sales in full peso format on category cards', async () => {
    const currentMonthPurchaseDate = new Date().toISOString();
    fetchAgentSnapshotForDailyCallMock.mockResolvedValue({
      ...baseSnapshot,
      contacts: [{
        ...baseSnapshot.contacts[0],
        id: 'current-month-buyer',
        shopName: 'Current Month Buyer',
        status: 'active',
        verification: 'Verified',
      }],
      purchases: [{
        id: 'current-month-sale',
        contact_id: 'current-month-buyer',
        amount: 1_000_000,
        status: 'paid',
        purchased_at: currentMonthPurchaseDate,
      }],
    });

    render(<DailyCallMonitoringView currentUser={currentUser} />);

    expect(await screen.findByLabelText('Customer board controls')).toBeInTheDocument();

    await expandSummaries();
    const categorySummaries = screen.getByLabelText('Customer category summaries');
    const prioritySummary = within(categorySummaries)
      .getByRole('heading', { name: 'Priority List' })
      .closest('article')!;
    const currentMonthSales = within(prioritySummary).getByText(/Current Month Sales/);

    expect(currentMonthSales).toHaveTextContent('₱1,000,000');
    expect(currentMonthSales).not.toHaveTextContent('₱1M');
  });

  it('shows only workflow-verified prospects in the verified list after refresh', async () => {
    fetchAgentSnapshotForDailyCallMock.mockResolvedValue({
      ...baseSnapshot,
      contacts: [
        {
          ...baseSnapshot.contacts[0],
          id: 'verified-existing',
          shopName: 'Existing Verified Prospect',
          status: 'verified_prospect',
          verification: 'Verified',
        },
        {
          ...baseSnapshot.contacts[0],
          id: 'unverified-existing',
          shopName: 'Existing Unverified Prospect',
          status: 'prospective',
          verification: 'Unverified',
        },
        {
          ...baseSnapshot.contacts[0],
          id: 'old-verified-no-purchase',
          shopName: 'Old Verified No Purchase',
          status: 'active',
          verification: 'Verified',
        },
      ],
      purchases: [],
      masterList: [
        {
          id: 'verified-existing',
          shopName: 'Existing Verified Prospect',
          profileType: 'Prospect',
          verification: 'Verified',
          verifiedInSystem: true,
          customerStatus: 3,
          listCategory: 'no_purchase',
          purchaseCount: 0,
          priorityTransactionCount: 0,
          ledgerTransactionCount: 0,
          lastPurchaseDateRaw: '',
        },
        {
          id: 'unverified-existing',
          shopName: 'Existing Unverified Prospect',
          profileType: 'Prospect',
          verification: 'Unverified',
          customerStatus: 3,
          listCategory: 'no_purchase',
          purchaseCount: 0,
          priorityTransactionCount: 0,
          ledgerTransactionCount: 0,
          lastPurchaseDateRaw: '',
        },
        {
          id: 'old-verified-no-purchase',
          shopName: 'Old Verified No Purchase',
          profileType: 'Old',
          verification: 'Verified',
          verifiedInSystem: false,
          customerStatus: 3,
          listCategory: 'no_purchase',
          purchaseCount: 0,
          priorityTransactionCount: 0,
          ledgerTransactionCount: 0,
          lastPurchaseDateRaw: '',
        },
      ],
    });

    render(<DailyCallMonitoringView currentUser={currentUser} />);

    expect(await screen.findByLabelText('Customer board controls')).toBeInTheDocument();

    await expandSummaries();
    const categorySummaries = screen.getByLabelText('Customer category summaries');
    const verifiedSummary = within(categorySummaries)
      .getByRole('heading', { name: 'Verified Prospects' })
      .closest('article')!;
    const unverifiedSummary = within(categorySummaries)
      .getByRole('heading', { name: 'Unverified Prospects' })
      .closest('article')!;

    expect(within(verifiedSummary).getByText('1')).toBeInTheDocument();
    expect(within(unverifiedSummary).getByText('2')).toBeInTheDocument();
  });

  it('sales agents request verification instead of directly verifying an existing prospect', async () => {
    const user = userEvent.setup();
    fetchAgentSnapshotForDailyCallMock.mockResolvedValue({
      ...baseSnapshot,
      contacts: [{
        ...baseSnapshot.contacts[0],
        id: 'unverified-existing',
        shopName: 'Existing Unverified Prospect',
        status: 'prospective',
        verification: 'Unverified',
      }],
      purchases: [],
    });

    render(<DailyCallMonitoringView currentUser={currentUser} />);

    await expandList('Unverified Prospects', user);
    await user.click(await screen.findByRole('button', { name: 'Request verification for Existing Unverified Prospect' }));

    expect(updateContactMock).toHaveBeenCalledWith('unverified-existing', {
      status: 'Prospective',
      verification: 'Pending Verification',
    });
  });

  it('shows the unified Agent Sales Report chat when a sales agent opens a customer', async () => {
    fetchSalesReportDirectoryStateMock.mockResolvedValue({
      unreadByContact: { 'contact-1': 2 },
      reportedContactIds: new Set(['contact-1']),
    });
    const user = userEvent.setup();

    render(<DailyCallMonitoringView currentUser={currentUser} />);
    await expandList('Unverified Prospects', user);
    expect(await screen.findByLabelText(/2 unread Agent Sales Report messages/i)).toBeInTheDocument();
    await user.click(await screen.findByText('Test Shop'));

    const panel = await screen.findByRole('region', { name: 'Agent Sales Report' });
    expect(within(panel).getByText(/Agent Sales Report chat for contact-1/i)).toBeInTheDocument();
  });

  it('filters the long customer list to reported or unread Agent Sales Report conversations', async () => {
    fetchSalesReportDirectoryStateMock.mockResolvedValue({
      unreadByContact: { 'contact-1': 2 },
      reportedContactIds: new Set(['contact-1']),
    });
    const user = userEvent.setup();

    render(<DailyCallMonitoringView currentUser={currentUser} />);
    await user.click(await screen.findByRole('button', { name: /^Filters$/i }));
    const filter = await screen.findByLabelText('Agent Sales Report filter');
    await user.selectOptions(filter, 'reported');
    expect(screen.getByText('1 customer')).toBeInTheDocument();

    await user.selectOptions(filter, 'unread');
    expect(screen.getByText('1 customer')).toBeInTheDocument();
  });

  it('blocks the contact window when another agent already claimed the customer', async () => {
    claimCustomerCallForDailyCallMock.mockRejectedValue(new Error('Test Shop is already being called by John Smith.'));
    const user = userEvent.setup();

    render(<DailyCallMonitoringView currentUser={currentUser} />);
    await expandList('Unverified Prospects', user);
    await user.click(await screen.findByRole('button', { name: 'Call Test Shop' }));

    expect(screen.queryByRole('dialog', { name: 'Contact Test Shop' })).not.toBeInTheDocument();
    expect(addToastMock).toHaveBeenCalledWith(expect.objectContaining({
      type: 'error',
      message: 'Test Shop is already being called by John Smith.',
    }));
  });

  it('closes the call window without a legacy conversation report and releases the claim', async () => {
    const user = userEvent.setup();
    render(<DailyCallMonitoringView currentUser={currentUser} />);

    await expandList('Unverified Prospects', user);
    await user.click(await screen.findByRole('button', { name: 'Call Test Shop' }));
    await user.click(await screen.findByRole('button', { name: 'Close contact window' }));

    await waitFor(() => expect(releaseCustomerCallForDailyCallMock).toHaveBeenCalledWith('contact-1'));
    expect(screen.queryByRole('heading', { name: /Contact Test Shop/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Conversation report')).not.toBeInTheDocument();
  });

  it('renders the customer details sheet responsively across screen sizes', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/#/sales-transaction-daily-call-monitoring');

    render(<DailyCallMonitoringView currentUser={currentUser} />);

    await expandList('Unverified Prospects', user);
    await user.click(await screen.findByText('Test Shop'));

    const closeButton = await screen.findByRole('button', { name: 'Close details panel' });
    const responsiveSheet = closeButton.closest('div.fixed');

    expect(responsiveSheet).not.toBeNull();
    expect(responsiveSheet).toHaveClass(
      'inset-x-0',
      'bottom-0',
      'top-auto',
      'max-h-[calc(100dvh-1rem)]',
      'sm:top-16',
      'sm:bottom-0',
      'sm:left-auto',
      'sm:h-auto',
      'sm:max-h-none',
      'sm:w-full',
      'sm:max-w-2xl'
    );
    expect(screen.queryByRole('button', { name: 'Open Patient Chart' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Full Details' })).toHaveTextContent('Full Details');
    expect(await screen.findByTestId('full-contact-details')).toHaveTextContent('contact-1:Diesel Injection');
    expect(screen.getByRole('region', { name: 'Agent Sales Report' })).toBeInTheDocument();
    expect(screen.queryByText('Customer Log')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Customer note')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Customer comments')).not.toBeInTheDocument();

    const scrollArea = closeButton.closest('div.fixed')?.querySelector('div.min-h-0.flex-1');

    expect(scrollArea).not.toBeNull();
    expect(scrollArea).toHaveClass('min-h-0', 'overflow-y-auto');
    expect(window.history.state).toMatchObject({ __jamesDailyCallDetail: { contactId: 'contact-1' } });
    window.history.back();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Test Shop details' })).not.toBeInTheDocument());
    expect(screen.queryByTestId('full-contact-details')).not.toBeInTheDocument();
  });

  it('opens ContactDetails for the selected customer from the agent workflow', async () => {
    fetchContactForDailyCallMock.mockResolvedValueOnce({
      id: 'contact-1',
      company: 'Test Shop',
      businessLine: 'Diesel Injection',
      contactPersons: [{
        id: 'person-1',
        enabled: true,
        name: '',
        mobile: '',
        telephone: '',
      }],
    });
    const user = userEvent.setup();
    render(<DailyCallMonitoringView currentUser={currentUser} />);

    await expandList('Unverified Prospects', user);
    await user.click(await screen.findByText('Test Shop'));

    expect(await screen.findByTestId('full-contact-details')).toHaveTextContent('contact-1:Diesel Injection');
    expect(screen.getByTestId('full-contact-details')).toHaveAttribute('data-permission-page', 'Daily Call Monitoring Dashboard');
    expect(screen.getByTestId('full-contact-details')).toHaveAttribute('data-unified-report', 'true');
    expect(screen.getByTestId('full-contact-details')).toHaveTextContent('Maria Santos');
    expect(screen.getByTestId('full-contact-details')).toHaveTextContent('09123456789');
    expect(fetchContactForDailyCallMock).toHaveBeenCalledWith('contact-1');
  });

  it('keeps the selected customer contact person and number visible when full-profile loading fails', async () => {
    fetchContactForDailyCallMock.mockRejectedValueOnce(new Error('Profile unavailable'));
    const user = userEvent.setup();
    render(<DailyCallMonitoringView currentUser={currentUser} />);

    await expandList('Unverified Prospects', user);
    await user.click(await screen.findByText('Test Shop'));

    const contactDetails = await screen.findByLabelText('Customer contact details');
    expect(contactDetails).toHaveTextContent('Maria Santos');
    expect(contactDetails).toHaveTextContent('09123456789');
    expect(screen.getByRole('alert')).toHaveTextContent('Profile unavailable');
  });

  it('keeps list contact details visible when profile loading ends with an auth session error', async () => {
    const authError = new Error('');
    authError.name = 'AuthSessionEndedError';
    fetchContactForDailyCallMock.mockRejectedValueOnce(authError);
    const user = userEvent.setup();
    render(<DailyCallMonitoringView currentUser={currentUser} />);

    await expandList('Unverified Prospects', user);
    await user.click(await screen.findByText('Test Shop'));

    const contactDetails = await screen.findByLabelText('Customer contact details');
    expect(contactDetails).toHaveTextContent('Maria Santos');
    expect(contactDetails).toHaveTextContent('09123456789');
  });

  it('logs an outbound SMS and opens the messaging app with the composed body', async () => {
    createCallLogForDailyCallMock.mockResolvedValue({
      id: 'log-sms-1',
      contact_id: 'contact-1',
      agent_name: 'Jane Doe',
      channel: 'text',
      direction: 'outbound',
      duration_seconds: 0,
      notes: 'Hello from test',
      outcome: 'logged',
      occurred_at: '2026-04-04T00:00:00.000Z',
      next_action: null,
      next_action_due: null,
    });

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const user = userEvent.setup();

    render(<DailyCallMonitoringView currentUser={currentUser} />);

    await expandList('Unverified Prospects');
    const smsButton = await screen.findByRole('button', { name: 'Send SMS to Test Shop' });
    await user.click(smsButton);

    const textarea = await screen.findByPlaceholderText('Type your message here...');
    await user.type(textarea, 'Hello from test');
    await user.click(screen.getByRole('button', { name: 'Send SMS' }));

    await waitFor(() => {
      expect(createCallLogForDailyCallMock).toHaveBeenCalledWith(
        expect.objectContaining({
          contact_id: 'contact-1',
          agent_name: 'Jane Doe',
          channel: 'text',
          direction: 'outbound',
          notes: 'Hello from test',
        })
      );
    });

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith('sms:09123456789?body=Hello%20from%20test', '_self');
    });

    expect(addToastMock).toHaveBeenCalledWith(expect.objectContaining({
      type: 'success',
    }));
  });

  it.skip('saves a legacy customer note from the details panel', async () => {
    createCustomerLogForDailyCallMock.mockResolvedValue({
      id: 'cust-log-1',
      contact_id: 'contact-1',
      entry_type: 'Note',
      topic: 'Payment',
      status: 'Call Back',
      note: 'Will pay on Friday',
      promise_to_pay: 'Friday afternoon',
      comments: 'Asked for reminder',
      attachment: null,
      occurred_at: '2026-04-04T00:00:00.000Z',
      created_by: 'agent-1',
      created_by_name: 'Jane Doe',
    });

    const user = userEvent.setup();

    render(<DailyCallMonitoringView currentUser={currentUser} />);

    await user.click(await screen.findByText('Test Shop'));

    await user.selectOptions(await screen.findByLabelText('Customer log topic'), 'Payment');
    await user.selectOptions(screen.getByLabelText('Customer log status'), 'Call Back');
    await user.type(screen.getByLabelText('Customer note'), 'Will pay on Friday');
    await user.type(screen.getByLabelText('Customer promise to pay'), 'Friday afternoon');
    await user.type(screen.getByLabelText('Customer comments'), 'Asked for reminder');
    await user.click(screen.getByRole('button', { name: 'Save Note' }));

    await waitFor(() => {
      expect(createCustomerLogForDailyCallMock).toHaveBeenCalledWith({
        contact_id: 'contact-1',
        entry_type: 'Note',
        topic: 'Payment',
        status: 'Call Back',
        note: 'Will pay on Friday',
        promise_to_pay: 'Friday afternoon',
        comments: 'Asked for reminder',
      });
    });

    expect(await screen.findByText('Will pay on Friday')).toBeInTheDocument();
  });

  it.skip('saves a legacy status update from the details panel', async () => {
    createCustomerLogForDailyCallMock.mockResolvedValue({
      id: 'cust-log-status-1',
      contact_id: 'contact-1',
      entry_type: 'Status',
      topic: 'Status',
      status: 'No Answer',
      note: '',
      promise_to_pay: '',
      comments: '',
      attachment: null,
      occurred_at: '2026-04-04T00:00:00.000Z',
      created_by: 'agent-1',
      created_by_name: 'Jane Doe',
    });

    const user = userEvent.setup();

    render(<DailyCallMonitoringView currentUser={currentUser} />);

    await user.click(await screen.findByText('Test Shop'));
    await user.selectOptions(await screen.findByLabelText('Customer log status'), 'No Answer');
    await user.click(screen.getByRole('button', { name: 'Update Status' }));

    await waitFor(() => {
      expect(createCustomerLogForDailyCallMock).toHaveBeenCalledWith({
        contact_id: 'contact-1',
        entry_type: 'Status',
        topic: 'Status',
        status: 'No Answer',
      });
    });

    const statusHistory = await screen.findByText('Status History');
    expect(statusHistory).toBeInTheDocument();
    expect(within(statusHistory.closest('div')?.parentElement as HTMLElement).getByText('No Answer')).toBeInTheDocument();
  });

  it('renders every one of 400 customers returned for the assigned sales agent', async () => {
    const assignedContacts = Array.from({ length: 400 }, (_, index) => ({
      ...baseSnapshot.contacts[0],
      id: `contact-${index + 1}`,
      shopName: `Assigned Customer ${index + 1}`,
      status: 'active',
      verification: '',
    }));
    fetchAgentSnapshotForDailyCallMock.mockResolvedValue({
      ...baseSnapshot,
      contacts: assignedContacts,
      masterList: assignedContacts.map((contact) => ({
        id: contact.id,
        shopName: contact.shopName,
        listCategory: 'recovery',
        purchaseCount: 1,
        priorityTransactionCount: 0,
        ledgerTransactionCount: 1,
        purchaseAgeGroup: 'over_one_month',
      })),
    });

    render(<DailyCallMonitoringView currentUser={currentUser} />);

    await expandList('Recovery List');
    expect(await screen.findByText('Assigned Customer 400')).toBeInTheDocument();
    expect(screen.getByText('400 customers')).toBeInTheDocument();
  });

  it('uses the master-list classification for the sales-agent view without an Other Customers bucket', async () => {
    fetchAgentSnapshotForDailyCallMock.mockResolvedValue({
      ...baseSnapshot,
      contacts: [{
        ...baseSnapshot.contacts[0],
        id: 'legacy-recovery',
        shopName: 'Legacy Recovery Customer',
        status: 'active',
        verification: '',
      }],
      purchases: [],
      masterList: [{
        id: 'legacy-recovery',
        shopName: 'Legacy Recovery Customer',
        listCategory: 'recovery',
        purchaseCount: 1,
        priorityTransactionCount: 0,
        ledgerTransactionCount: 1,
        purchaseAgeGroup: 'over_one_month',
      }],
    });

    render(<DailyCallMonitoringView currentUser={currentUser} />);

    expect(await screen.findByLabelText('Customer board controls')).toBeInTheDocument();
    expect(screen.queryByText('Other Customers')).not.toBeInTheDocument();
    await expandList('Recovery List');

    const categoryTables = screen.getByLabelText('Segregated customer category tables');
    const recoveryTable = within(categoryTables)
      .getByTitle('Recovery List (Purchase history before October 2025, with none since)')
      .closest('article')!;
    expect(within(recoveryTable).getByText('Legacy Recovery Customer')).toBeInTheDocument();
  });

  it('finds an assigned customer by its contact person name', async () => {
    const contacts = [
      {
        ...baseSnapshot.contacts[0],
        id: 'contact-ejurango',
        shopName: 'ARL KENT DIESEL CALIBRATION AND PARTS SALES',
        contactPersonName: 'Primary Contact',
        contactPersonNames: 'Primary Contact | Arsolin T Ejurango',
        contactNumbers: '(02) 8123-4567 / +63 (917) 123-4567',
        status: 'active',
        verification: '',
      },
      {
        ...baseSnapshot.contacts[0],
        id: 'contact-other',
        shopName: 'Another Assigned Customer',
        assignedTo: 'John Smith',
        status: 'active',
        verification: '',
      },
    ];
    fetchAgentSnapshotForDailyCallMock.mockResolvedValue({
      ...baseSnapshot,
      contacts,
      masterList: contacts.map((contact) => ({
        id: contact.id,
        shopName: contact.shopName,
        listCategory: 'recovery',
        purchaseCount: 1,
        ledgerTransactionCount: 1,
        purchaseAgeGroup: 'over_one_month',
      })),
    });

    render(<DailyCallMonitoringView currentUser={currentUser} />);

    await expandList('Recovery List');
    await screen.findByText('ARL KENT DIESEL CALIBRATION AND PARTS SALES');
    const user = userEvent.setup();
    const searchFor = async (field: string, query: string) => {
      const searchInput = screen.getByRole('textbox', { name: `Search by ${field}` });
      await user.clear(searchInput);
      await user.type(searchInput, query);
      await waitFor(() => {
        expect(screen.getByText('ARL KENT DIESEL CALIBRATION AND PARTS SALES')).toBeInTheDocument();
        expect(screen.queryByText('Another Assigned Customer')).not.toBeInTheDocument();
      });
    };

    await searchFor('customer name', 'ARL KENT');
    await searchFor('contact person', 'Ejurango');
    await searchFor('phone number', '0917-123-4567');
    await searchFor('phone number', '+63 917 123 4567');
    await searchFor('phone number', '+63 (0) 917 123 4567');
    await searchFor('sales agent', 'Jane Doe');
  });

  it('sums Priority List row current-month sales in the category summary', async () => {
    fetchAgentSnapshotForDailyCallMock.mockResolvedValue({
      ...baseSnapshot,
      contacts: [
        {
          ...baseSnapshot.contacts[0],
          id: 'ledger-sales-customer-a',
          shopName: 'Ledger Sales Customer A',
          status: 'active',
          verification: '',
        },
        {
          ...baseSnapshot.contacts[0],
          id: 'ledger-sales-customer-b',
          shopName: 'Ledger Sales Customer B',
          status: 'active',
          verification: '',
        },
      ],
      purchases: [{
        id: 'stale-purchase-total',
        contact_id: 'ledger-sales-customer-a',
        amount: 100,
        status: 'paid',
        purchased_at: new Date().toISOString(),
      }],
      masterList: [{
        id: 'ledger-sales-customer-a',
        shopName: 'Ledger Sales Customer A',
        listCategory: 'priority',
        currentMonthSales: 10_200,
        totalSales: 10_200,
        purchaseCount: 1,
        priorityTransactionCount: 1,
        ledgerTransactionCount: 1,
        purchaseAgeGroup: 'recent',
      }],
    });

    render(<DailyCallMonitoringView currentUser={currentUser} />);

    await expandSummaries();
    const summary = within(screen.getByLabelText('Customer category summaries'))
      .getByRole('heading', { name: 'Priority List' }).closest('article');
    expect(summary).not.toBeNull();
    expect(within(summary as HTMLElement).getByText(/Current Month Sales:/)).toHaveTextContent('₱10,200');
  });

  it('uses the ledger average monthly sales for potential sales', async () => {
    fetchAgentSnapshotForDailyCallMock.mockResolvedValue({
      ...baseSnapshot,
      contacts: [{
        ...baseSnapshot.contacts[0],
        id: 'ledger-potential-customer',
        shopName: 'Ledger Potential Customer',
        status: 'active',
        verification: '',
      }],
      purchases: [{
        id: 'stale-potential-purchase',
        contact_id: 'ledger-potential-customer',
        amount: 100,
        status: 'paid',
        purchased_at: '2025-09-01T00:00:00.000Z',
      }],
      masterList: [{
        id: 'ledger-potential-customer',
        shopName: 'Ledger Potential Customer',
        listCategory: 'recovery',
        averageMonthlySales: 18_000,
        averageMonthlySalesMonthCount: 3,
        totalSales: 54_000,
        purchaseCount: 3,
        ledgerTransactionCount: 3,
        purchaseAgeGroup: 'over_one_month',
        lastPurchaseDateRaw: '2025-09-01',
      }],
    });

    render(<DailyCallMonitoringView currentUser={currentUser} />);

    await expandSummaries();
    const summary = within(screen.getByLabelText('Customer category summaries'))
      .getByRole('heading', { name: 'Recovery List' }).closest('article');
    expect(summary).not.toBeNull();
    expect(within(summary as HTMLElement).getByText(/Average Monthly Sales:/)).toHaveTextContent('₱18K');
    expect(within(summary as HTMLElement).getByText(/Potential sales:/)).toHaveTextContent('₱18K');
  });
});
