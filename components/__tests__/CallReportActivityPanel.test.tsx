import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import CallReportActivityPanel from '../CallReportActivityPanel';

const fetchCallReportThreadsMock = vi.fn();
const sendCallReportReplyMock = vi.fn();
const markCallReportThreadReadMock = vi.fn();
const addToastMock = vi.fn();

vi.mock('../../services/dailyCallMonitoringService', () => ({
  fetchCallReportThreads: (...args: unknown[]) => fetchCallReportThreadsMock(...args),
  sendCallReportReply: (...args: unknown[]) => sendCallReportReplyMock(...args),
  markCallReportThreadRead: (...args: unknown[]) => markCallReportThreadReadMock(...args),
}));

vi.mock('../ToastProvider', () => ({
  useToast: () => ({ addToast: addToastMock }),
}));

describe('CallReportActivityPanel', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders report threads in a chat-style layout', async () => {
    fetchCallReportThreadsMock.mockResolvedValue([
      {
        id: 'thread-1',
        contact_id: 'customer-1',
        call_log_entry_id: '10',
        call_log_refno: 'API-CALL-1',
        agent_user_id: '2',
        agent_name: 'Jane Doe',
        outcome: 'follow_up',
        report_body: 'Customer requested updated quotation.',
        call_started_at: '2026-06-21T09:30:00',
        call_ended_at: '2026-06-21T10:00:00',
        duration_seconds: 1800,
        created_at: '2026-06-21T10:00:00',
        last_activity_at: '2026-06-21T10:00:00',
        unread_count: 0,
        messages: [],
      },
    ]);

    render(
      <CallReportActivityPanel
        contactId="customer-1"
        currentUser={{ id: 'master-1', role: 'Master User', user_type: '1', full_name: 'Master User' } as any}
      />
    );

    expect(await screen.findByText('Customer requested updated quotation.')).toBeInTheDocument();
    expect(screen.getByText('Sales agent report')).toBeInTheDocument();
    expect(screen.getByText('Follow-up required')).toBeInTheDocument();
    expect(screen.getByText(/Call started:/i)).toBeInTheDocument();
    expect(screen.getByText(/Call ended:/i)).toBeInTheDocument();
    expect(screen.getByText(/Duration:/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Write a reply for the sales agent...')).toBeInTheDocument();
  });

  it('sends a master reply to a report thread', async () => {
    const user = userEvent.setup();
    fetchCallReportThreadsMock.mockResolvedValue([
      {
        id: 'thread-1',
        contact_id: 'customer-1',
        call_log_entry_id: '10',
        call_log_refno: 'API-CALL-1',
        agent_user_id: '2',
        agent_name: 'Jane Doe',
        outcome: 'note',
        report_body: 'Customer requested updated quotation.',
        call_started_at: '2026-06-21T09:30:00',
        call_ended_at: '2026-06-21T10:00:00',
        duration_seconds: 1800,
        created_at: '2026-06-21T10:00:00',
        last_activity_at: '2026-06-21T10:00:00',
        unread_count: 0,
        messages: [],
      },
    ]);
    sendCallReportReplyMock.mockResolvedValue({
      id: 'msg-1',
      thread_id: 'thread-1',
      sender_user_id: 'master-1',
      sender_name: 'Master User',
      sender_role: 'master',
      body: 'Send the updated price list today.',
      created_at: '2026-06-21T11:00:00',
      is_from_current_user: true,
      is_from_master: true,
    });

    render(
      <CallReportActivityPanel
        contactId="customer-1"
        currentUser={{ id: 'master-1', role: 'Master User', user_type: '1', full_name: 'Master User' } as any}
      />
    );

    await screen.findByText('Customer requested updated quotation.');
    await user.type(screen.getByPlaceholderText('Write a reply for the sales agent...'), 'Send the updated price list today.');
    await user.click(screen.getByRole('button', { name: 'Send Reply' }));

    await waitFor(() => expect(sendCallReportReplyMock).toHaveBeenCalledWith({
      threadId: 'thread-1',
      body: 'Send the updated price list today.',
      senderName: 'Master User',
    }));
    expect(await screen.findByText('Send the updated price list today.')).toBeInTheDocument();
  });
});
