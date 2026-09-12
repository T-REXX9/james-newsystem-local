import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import CallReportActivityPanel from '../CallReportActivityPanel';

const fetchSalesReportConversationMock = vi.fn();
const sendSalesReportMessageMock = vi.fn();
const markSalesReportConversationReadMock = vi.fn();
const addToastMock = vi.fn();

vi.mock('../../services/dailyCallMonitoringService', () => ({
  fetchSalesReportConversation: (...args: unknown[]) => fetchSalesReportConversationMock(...args),
  sendSalesReportMessage: (...args: unknown[]) => sendSalesReportMessageMock(...args),
  markSalesReportConversationRead: (...args: unknown[]) => markSalesReportConversationReadMock(...args),
  uploadSalesReportAttachment: vi.fn(),
  resolveSalesReportAttachmentDisplayUrl: async (url: string) => url,
}));

vi.mock('../ToastProvider', () => ({
  useToast: () => ({ addToast: addToastMock }),
}));

describe('CallReportActivityPanel', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('delegates to the unified Agent Sales Report chat', async () => {
    fetchSalesReportConversationMock.mockResolvedValue({
      contact_id: 'customer-1',
      unread_count: 0,
      messages: [
        {
          id: 'report:1',
          contact_id: 'customer-1',
          kind: 'agent_report',
          sender_user_id: '2',
          sender_name: 'Jane Doe',
          sender_role: 'agent',
          body: 'Customer requested updated quotation.',
          created_at: '2026-06-21T10:00:00Z',
          is_from_current_user: false,
          is_from_master: false,
        },
      ],
    });

    render(
      <CallReportActivityPanel
        contactId="customer-1"
        currentUser={{ id: '1', role: 'Master User', full_name: 'Master User', user_type: '1' } as any}
      />
    );

    expect(await screen.findByText('Customer requested updated quotation.')).toBeInTheDocument();
    expect(screen.getByText(/Sales agent report/i)).toBeInTheDocument();
  });

  it('lets management send a reply through the unified chat', async () => {
    fetchSalesReportConversationMock.mockResolvedValue({
      contact_id: 'customer-1',
      unread_count: 0,
      messages: [
        {
          id: 'report:1',
          contact_id: 'customer-1',
          kind: 'agent_report',
          sender_user_id: '2',
          sender_name: 'Jane Doe',
          sender_role: 'agent',
          body: 'Customer requested updated quotation.',
          created_at: '2026-06-21T10:00:00Z',
          is_from_current_user: false,
          is_from_master: false,
        },
      ],
    });
    sendSalesReportMessageMock.mockResolvedValue({
      id: '2',
      contact_id: 'customer-1',
      kind: 'reply',
      sender_user_id: '1',
      sender_name: 'Master User',
      sender_role: 'master',
      body: 'Please follow up tomorrow.',
      created_at: '2026-06-21T11:00:00Z',
      is_from_current_user: true,
      is_from_master: true,
    });

    const user = userEvent.setup();
    render(
      <CallReportActivityPanel
        contactId="customer-1"
        currentUser={{ id: '1', role: 'Master User', full_name: 'Master User', user_type: '1' } as any}
      />
    );

    await screen.findByText('Customer requested updated quotation.');
    const composer = screen.getByPlaceholderText(/Reply in the Agent Sales Report conversation/i);
    await user.click(composer);
    await user.paste('Please follow up tomorrow.');
    await user.click(screen.getByRole('button', { name: /^Send$/i }));

    await waitFor(() => {
      expect(sendSalesReportMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          contactId: 'customer-1',
          body: 'Please follow up tomorrow.',
          senderName: 'Master User',
        })
      );
    });
  });
});
