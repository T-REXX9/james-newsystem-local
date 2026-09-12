import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CustomerSalesReportChat from '../CustomerSalesReportChat';

const fetchSalesReportConversationMock = vi.fn();
const sendSalesReportMessageMock = vi.fn();
const markSalesReportConversationReadMock = vi.fn();
const uploadSalesReportAttachmentMock = vi.fn();

const resolveSalesReportAttachmentDisplayUrlMock = vi.fn(async (url: string) => url);
const addToastMock = vi.fn();

vi.mock('../../services/dailyCallMonitoringService', () => ({
  fetchSalesReportConversation: (...args: unknown[]) => fetchSalesReportConversationMock(...args),
  sendSalesReportMessage: (...args: unknown[]) => sendSalesReportMessageMock(...args),
  markSalesReportConversationRead: (...args: unknown[]) => markSalesReportConversationReadMock(...args),
  uploadSalesReportAttachment: (...args: unknown[]) => uploadSalesReportAttachmentMock(...args),
  resolveSalesReportAttachmentDisplayUrl: (...args: unknown[]) => resolveSalesReportAttachmentDisplayUrlMock(...args as [string]),
}));

vi.mock('../../utils/recordImage', () => ({
  RECORD_IMAGE_ACCEPT: 'image/jpeg,image/png,image/webp',
  validateRecordImageFile: (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return 'Only JPG, PNG, or WebP pictures are allowed.';
    }
    return null;
  },
  optimizeRecordImage: async () => 'data:image/png;base64,abc',
}));

vi.mock('../ToastProvider', () => ({
  useToast: () => ({ addToast: addToastMock }),
}));

describe('CustomerSalesReportChat', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSalesReportConversationMock.mockResolvedValue({
      contact_id: 'c1',
      unread_count: 1,
      messages: [
        {
          id: 'legacy:1',
          contact_id: 'c1',
          kind: 'management_instruction',
          sender_user_id: 'm1',
          sender_name: 'Master User',
          sender_role: 'master',
          body: 'Call this shop before Friday.',
          created_at: '2026-09-10T08:00:00Z',
          is_from_current_user: false,
          is_from_master: true,
        },
        {
          id: 'report:2',
          contact_id: 'c1',
          kind: 'agent_report',
          sender_user_id: 'a1',
          sender_name: 'Agent Ana',
          sender_role: 'agent',
          body: 'Customer asked about VIP terms.',
          created_at: '2026-09-11T09:00:00Z',
          is_from_current_user: false,
          is_from_master: false,
        },
      ],
    });
    markSalesReportConversationReadMock.mockResolvedValue(undefined);
    sendSalesReportMessageMock.mockResolvedValue({
      id: '3',
      contact_id: 'c1',
      kind: 'reply',
      sender_user_id: 'm1',
      sender_name: 'Master User',
      sender_role: 'master',
      body: 'Approved — proceed.',
      created_at: '2026-09-12T10:00:00Z',
      is_from_current_user: true,
      is_from_master: true,
    });
  });

  it('renders a unified chronological conversation including legacy management instructions', async () => {
    render(
      <CustomerSalesReportChat
        contactId="c1"
        currentUser={{ id: 'm1', role: 'Master User', full_name: 'Master User', user_type: '1' } as any}
      />
    );

    expect(await screen.findByText('Call this shop before Friday.')).toBeInTheDocument();
    expect(screen.getByText('Customer asked about VIP terms.')).toBeInTheDocument();
    expect(screen.getByText(/Management instruction/i)).toBeInTheDocument();
    expect(screen.getByText(/Sales agent report/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(markSalesReportConversationReadMock).toHaveBeenCalledWith('c1');
    });
  });

  it('lets management send a text reply in the unified chat', async () => {
    const user = userEvent.setup();
    render(
      <CustomerSalesReportChat
        contactId="c1"
        currentUser={{ id: 'm1', role: 'Master User', full_name: 'Master User', user_type: '1' } as any}
      />
    );

    await screen.findByText('Customer asked about VIP terms.');
    const composer = screen.getByPlaceholderText(/Reply in the Agent Sales Report conversation/i);
    await user.click(composer);
    await user.paste('Approved proceed');
    expect(composer).toHaveValue('Approved proceed');
    await user.click(screen.getByRole('button', { name: /^Send$/i }));

    await waitFor(() => {
      expect(sendSalesReportMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          contactId: 'c1',
          body: 'Approved proceed',
          senderName: 'Master User',
        })
      );
    });
  });

  it('keeps history visible but hides composer in view-only mode', async () => {
    render(
      <CustomerSalesReportChat
        contactId="c1"
        currentUser={{ id: 'm1', role: 'Master User', full_name: 'Master User', user_type: '1' } as any}
        viewOnly
      />
    );

    expect(await screen.findByText('Call this shop before Friday.')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Reply in the Agent Sales Report conversation/i)).not.toBeInTheDocument();
  });

  it('rejects non-image files before upload', async () => {
    render(
      <CustomerSalesReportChat
        contactId="c1"
        currentUser={{ id: 'm1', role: 'Master User', full_name: 'Master User', user_type: '1' } as any}
      />
    );

    await screen.findByText('Customer asked about VIP terms.');
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const badFile = new File(['%PDF'], 'notes.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [badFile] } });

    await waitFor(() => {
      expect(addToastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          message: expect.stringMatching(/JPG|PNG|WebP/i),
        })
      );
    });
    expect(uploadSalesReportAttachmentMock).not.toHaveBeenCalled();
  });
});
