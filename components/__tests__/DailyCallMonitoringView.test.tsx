import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import DailyCallMonitoringView from '../DailyCallMonitoringView';

const addToastMock = vi.fn();
const fetchAgentSnapshotForDailyCallMock = vi.fn();
const fetchContactCustomerLogsForDailyCallMock = vi.fn();
const createCallLogForDailyCallMock = vi.fn();
const createCustomerLogForDailyCallMock = vi.fn();
const subscribeToDailyCallMonitoringUpdatesMock = vi.fn(() => () => {});
const createContactMock = vi.fn();

vi.mock('../ToastProvider', () => ({
  useToast: () => ({
    addToast: addToastMock,
  }),
}));

vi.mock('../../services/dailyCallMonitoringService', () => ({
  fetchAgentSnapshotForDailyCall: (...args: unknown[]) => fetchAgentSnapshotForDailyCallMock(...args),
  fetchContactCustomerLogsForDailyCall: (...args: unknown[]) => fetchContactCustomerLogsForDailyCallMock(...args),
  createCallLogForDailyCall: (...args: unknown[]) => createCallLogForDailyCallMock(...args),
  createCustomerLogForDailyCall: (...args: unknown[]) => createCustomerLogForDailyCallMock(...args),
  subscribeToDailyCallMonitoringUpdates: (...args: unknown[]) => subscribeToDailyCallMonitoringUpdatesMock(...args),
}));

vi.mock('../../services/customerDatabaseLocalApiService', () => ({
  createContact: (...args: unknown[]) => createContactMock(...args),
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
      status: 'Active',
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
    createCustomerLogForDailyCallMock.mockReset();
    subscribeToDailyCallMonitoringUpdatesMock.mockClear();
    createContactMock.mockReset();

    fetchAgentSnapshotForDailyCallMock.mockResolvedValue(baseSnapshot);
    fetchContactCustomerLogsForDailyCallMock.mockResolvedValue([]);

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

  it('logs an outbound call and opens the dialer when the call button is clicked', async () => {
    createCallLogForDailyCallMock.mockResolvedValue({
      id: 'log-call-1',
      contact_id: 'contact-1',
      agent_name: 'Jane Doe',
      channel: 'call',
      direction: 'outbound',
      duration_seconds: 0,
      notes: 'Dialed 09123456789',
      outcome: 'logged',
      occurred_at: '2026-04-04T00:00:00.000Z',
      next_action: null,
      next_action_due: null,
    });

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const user = userEvent.setup();

    render(<DailyCallMonitoringView currentUser={currentUser} />);

    const callButton = await screen.findByRole('button', { name: 'Call Test Shop' });
    await user.click(callButton);

    await waitFor(() => {
      expect(createCallLogForDailyCallMock).toHaveBeenCalledWith(
        expect.objectContaining({
          contact_id: 'contact-1',
          agent_name: 'Jane Doe',
          channel: 'call',
          direction: 'outbound',
          notes: 'Dialed 09123456789',
        })
      );
    });

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith('tel:09123456789', '_self');
    });
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
