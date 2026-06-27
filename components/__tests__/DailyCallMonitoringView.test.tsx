import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import DailyCallMonitoringView from '../DailyCallMonitoringView';

const addToastMock = vi.fn();
const fetchAgentSnapshotForDailyCallMock = vi.fn();
const fetchContactCustomerLogsForDailyCallMock = vi.fn();
const createCallLogForDailyCallMock = vi.fn();
const claimCustomerCallForDailyCallMock = vi.fn();
const releaseCustomerCallForDailyCallMock = vi.fn();
const createCustomerLogForDailyCallMock = vi.fn();
const subscribeToDailyCallMonitoringUpdatesMock = vi.fn(() => () => {});
const createContactMock = vi.fn();
const updateContactMock = vi.fn();
const fetchContactByIdMock = vi.fn();

vi.mock('../ToastProvider', () => ({
  useToast: () => ({
    addToast: addToastMock,
  }),
}));

vi.mock('../../services/dailyCallMonitoringService', () => ({
  fetchAgentSnapshotForDailyCall: (...args: unknown[]) => fetchAgentSnapshotForDailyCallMock(...args),
  fetchContactCustomerLogsForDailyCall: (...args: unknown[]) => fetchContactCustomerLogsForDailyCallMock(...args),
  createCallLogForDailyCall: (...args: unknown[]) => createCallLogForDailyCallMock(...args),
  claimCustomerCallForDailyCall: (...args: unknown[]) => claimCustomerCallForDailyCallMock(...args),
  releaseCustomerCallForDailyCall: (...args: unknown[]) => releaseCustomerCallForDailyCallMock(...args),
  createCustomerLogForDailyCall: (...args: unknown[]) => createCustomerLogForDailyCallMock(...args),
  subscribeToDailyCallMonitoringUpdates: (...args: unknown[]) => subscribeToDailyCallMonitoringUpdatesMock(...args),
}));

vi.mock('../../services/customerDatabaseLocalApiService', () => ({
  createContact: (...args: unknown[]) => createContactMock(...args),
  updateContact: (...args: unknown[]) => updateContactMock(...args),
  fetchContactById: (...args: unknown[]) => fetchContactByIdMock(...args),
}));

vi.mock('../CustomLoadingSpinner', () => ({
  default: ({ label }: { label?: string }) => <div>{label || 'Loading'}</div>,
}));

vi.mock('../AgentCallActivity', () => ({
  default: () => <div>AgentCallActivity</div>,
}));

vi.mock('../CustomerProfileModal', () => ({
  default: () => null,
}));

vi.mock('../ContactDetails', () => ({
  default: () => null,
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
  access_rights: ['sales-transaction-daily-call-monitoring'],
} as any;

const baseSnapshot = {
  contacts: [
    {
      id: 'contact-1',
      shopName: 'Test Shop',
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
  beforeEach(() => {
    cleanup();
    addToastMock.mockReset();
    fetchAgentSnapshotForDailyCallMock.mockReset();
    fetchContactCustomerLogsForDailyCallMock.mockReset();
    createCallLogForDailyCallMock.mockReset();
    claimCustomerCallForDailyCallMock.mockReset();
    releaseCustomerCallForDailyCallMock.mockReset();
    createCustomerLogForDailyCallMock.mockReset();
    subscribeToDailyCallMonitoringUpdatesMock.mockClear();
    createContactMock.mockReset();
    updateContactMock.mockReset();
    fetchContactByIdMock.mockReset();
    updateContactMock.mockResolvedValue(undefined);

    fetchAgentSnapshotForDailyCallMock.mockResolvedValue(baseSnapshot);
    fetchContactCustomerLogsForDailyCallMock.mockResolvedValue([]);
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

  afterEach(() => {
    cleanup();
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
          purchased_at: purchasedAt(45),
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

    expect(await screen.findByRole('heading', { name: 'Customer List' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'All Clients' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: "Today's List" })).not.toBeInTheDocument();
    expect(screen.queryByText('Monthly Quota')).not.toBeInTheDocument();

    const categorySummaries = screen.getByLabelText('Customer category summaries');
    const prioritySummary = within(categorySummaries)
      .getByTitle('Priority List (Any ledger activity since October 2025 onwards)')
      .closest('article')!;
    const recoverySummary = within(categorySummaries)
      .getByTitle('Recovery List (Over 1 month since last purchase)')
      .closest('article')!;
    const verifiedSummary = within(categorySummaries)
      .getByTitle('Verified Prospects (Verified, awaiting first purchase)')
      .closest('article')!;
    const unverifiedSummary = within(categorySummaries)
      .getByTitle('Unverified Prospects (No purchases yet)')
      .closest('article')!;

    expect(within(prioritySummary).getByText('3')).toBeInTheDocument();
    expect(within(recoverySummary).getByText('1')).toBeInTheDocument();
    expect(within(verifiedSummary).getByText('0')).toBeInTheDocument();
    expect(within(unverifiedSummary).getByText('1')).toBeInTheDocument();

    const categoryTables = screen.getByLabelText('Segregated customer category tables');
    const priorityTable = within(categoryTables)
      .getByTitle('Priority List (Any ledger activity since October 2025 onwards)')
      .closest('article')!;
    const unverifiedTable = within(categoryTables)
      .getByTitle('Unverified Prospects (No purchases yet)')
      .closest('article')!;

    const cadenceRow = within(priorityTable).getByText('Cadence Window Shop').closest('tr')!;
    const overdueRow = within(priorityTable).getByText('Overdue Shop').closest('tr')!;
    const freshRow = within(priorityTable).getByText('Fresh Purchase Shop').closest('tr')!;

    expect(cadenceRow.compareDocumentPosition(overdueRow)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(overdueRow.compareDocumentPosition(freshRow)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(within(unverifiedTable).getByText('No Purchase Shop')).toBeInTheDocument();
  });

  it('keeps verified no-purchase prospects in the verified prospects list after refresh', async () => {
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
    });

    render(<DailyCallMonitoringView currentUser={currentUser} />);

    expect(await screen.findByRole('heading', { name: 'Customer List' })).toBeInTheDocument();

    const categorySummaries = screen.getByLabelText('Customer category summaries');
    const verifiedSummary = within(categorySummaries)
      .getByTitle('Verified Prospects (Verified, awaiting first purchase)')
      .closest('article')!;
    const unverifiedSummary = within(categorySummaries)
      .getByTitle('Unverified Prospects (No purchases yet)')
      .closest('article')!;

    expect(within(verifiedSummary).getByText('1')).toBeInTheDocument();
    expect(within(unverifiedSummary).getByText('1')).toBeInTheDocument();
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

    await user.click(await screen.findByRole('button', { name: 'Request verification for Existing Unverified Prospect' }));

    expect(updateContactMock).toHaveBeenCalledWith('unverified-existing', {
      status: 'Prospective',
      verification: 'Pending Verification',
    });
  });

  it('submits a conversation report and keeps the customer in the list', async () => {
    createCallLogForDailyCallMock.mockResolvedValue({
      id: 'log-call-1',
      contact_id: 'contact-1',
      agent_name: 'Jane Doe',
      channel: 'call',
      direction: 'outbound',
      duration_seconds: 0,
      notes: '[Sales Agent Report] Customer requested updated quotation.',
      outcome: 'follow_up',
      occurred_at: '2026-04-04T00:00:00.000Z',
      next_action: null,
      next_action_due: null,
    });

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const user = userEvent.setup();

    render(<DailyCallMonitoringView currentUser={currentUser} />);

    const callButton = await screen.findByRole('button', { name: 'Call Test Shop' });
    await user.click(callButton);

    expect(claimCustomerCallForDailyCallMock).toHaveBeenCalledWith('contact-1');
    expect(await screen.findByRole('dialog', { name: 'Contact Test Shop' })).toBeInTheDocument();
    const responsiveDialog = screen.getByRole('dialog', { name: 'Contact Test Shop' });
    expect(responsiveDialog).toHaveClass('max-h-[calc(100dvh-1rem)]', 'sm:max-h-[calc(100dvh-2rem)]', 'sm:max-w-4xl');
    expect(screen.getByTestId('call-contact-scroll-area')).toHaveClass('min-h-0', 'overflow-y-auto');
    expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
    expect(screen.getByText('Purchasing Manager')).toBeInTheDocument();
    expect(screen.getByText('09987654321')).toBeInTheDocument();
    expect(screen.getByText('juan@example.com')).toBeInTheDocument();
    expect(screen.getByText('Reporting as Jane Doe')).toBeInTheDocument();
    expect(createCallLogForDailyCallMock).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();

    const reportInput = screen.getByPlaceholderText('Write a report about the customer conversation...');
    await user.type(reportInput, 'Customer requested updated quotation.');
    await user.selectOptions(screen.getByLabelText('Conversation outcome'), 'follow_up');
    await user.click(screen.getByRole('button', { name: 'Submit Report' }));

    await waitFor(() => {
      expect(createCallLogForDailyCallMock).toHaveBeenCalledWith(
        expect.objectContaining({
          contact_id: 'contact-1',
          agent_name: 'Jane Doe',
          channel: 'call',
          direction: 'outbound',
          notes: '[Sales Agent Report] Customer requested updated quotation.',
          outcome: 'follow_up',
        })
      );
    });

    expect(openSpy).not.toHaveBeenCalled();
    expect(addToastMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
    expect(callButton).toBeInTheDocument();
  });

  it('blocks the contact window when another agent already claimed the customer', async () => {
    claimCustomerCallForDailyCallMock.mockRejectedValue(new Error('Test Shop is already being called by John Smith.'));
    const user = userEvent.setup();

    render(<DailyCallMonitoringView currentUser={currentUser} />);
    await user.click(await screen.findByRole('button', { name: 'Call Test Shop' }));

    expect(screen.queryByRole('dialog', { name: 'Contact Test Shop' })).not.toBeInTheDocument();
    expect(addToastMock).toHaveBeenCalledWith(expect.objectContaining({
      type: 'error',
      message: 'Test Shop is already being called by John Smith.',
    }));
  });

  it('releases the claim when the agent closes without submitting a report', async () => {
    const user = userEvent.setup();
    render(<DailyCallMonitoringView currentUser={currentUser} />);

    await user.click(await screen.findByRole('button', { name: 'Call Test Shop' }));
    await user.click(await screen.findByRole('button', { name: 'Close contact window' }));

    await waitFor(() => expect(releaseCustomerCallForDailyCallMock).toHaveBeenCalledWith('contact-1'));
  });

  it('renders the customer details sheet responsively across screen sizes', async () => {
    const user = userEvent.setup();

    render(<DailyCallMonitoringView currentUser={currentUser} />);

    await user.click(await screen.findByText('Test Shop'));

    const closeButton = await screen.findByRole('button', { name: 'Close details panel' });
    const responsiveSheet = closeButton.closest('div.fixed');

    expect(responsiveSheet).not.toBeNull();
    expect(responsiveSheet).toHaveClass(
      'inset-x-0',
      'bottom-0',
      'top-auto',
      'max-h-[calc(100dvh-1rem)]',
      'sm:inset-y-0',
      'sm:left-auto',
      'sm:h-full',
      'sm:max-h-none',
      'sm:w-full',
      'sm:max-w-2xl'
    );

    const customerLogHeading = screen.getByText('Customer Log');
    const scrollArea = customerLogHeading.closest('div.flex-1');

    expect(scrollArea).not.toBeNull();
    expect(scrollArea).toHaveClass('min-h-0', 'overflow-y-auto');
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

  it('saves a legacy customer note from the details panel', async () => {
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

  it('saves a legacy status update from the details panel', async () => {
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
});
