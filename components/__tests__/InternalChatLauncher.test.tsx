import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InternalChatLauncher from '../InternalChatLauncher';
import { ToastProvider } from '../ToastProvider';
import type {
  InternalChatConversationSummary,
  InternalChatMessage,
  InternalChatParticipant,
} from '../../services/internalChatLocalApiService';
import type { InternalChatRealtimeEvent } from '../../services/internalChatRealtimeService';

const localApiMocks = vi.hoisted(() => ({
  createInternalChatGroup: vi.fn(),
  fetchInternalChatGroup: vi.fn(),
  fetchInternalChatParticipants: vi.fn(),
  fetchInternalChatConversations: vi.fn(),
  fetchInternalChatMessages: vi.fn(),
  fetchInternalChatTypingState: vi.fn(),
  fetchInternalChatUnreadCount: vi.fn(),
  markInternalChatConversationRead: vi.fn(),
  addInternalChatGroupMembers: vi.fn(),
  removeInternalChatGroupMember: vi.fn(),
  renameInternalChatGroup: vi.fn(),
  sendInternalChatMessage: vi.fn(),
  toggleInternalChatReaction: vi.fn(),
  updateInternalChatTyping: vi.fn(),
}));

const realtimeMocks = vi.hoisted(() => ({
  openInternalChatRealtimeStream: vi.fn(),
}));

const mentionServiceMocks = vi.hoisted(() => ({
  searchInternalChatEntityMentions: vi.fn(),
  preloadInternalChatMentionCaches: vi.fn(),
}));

vi.mock('../../services/internalChatLocalApiService', async () => {
  const actual = await vi.importActual<typeof import('../../services/internalChatLocalApiService')>(
    '../../services/internalChatLocalApiService'
  );

  return {
    ...actual,
    ...localApiMocks,
  };
});

vi.mock('../../services/internalChatRealtimeService', async () => {
  const actual = await vi.importActual<typeof import('../../services/internalChatRealtimeService')>(
    '../../services/internalChatRealtimeService'
  );

  return {
    ...actual,
    ...realtimeMocks,
  };
});

vi.mock('../../services/internalChatMentionService', () => ({
  ...mentionServiceMocks,
}));

const currentUser = {
  id: '1',
  email: 'owner@example.com',
  full_name: 'Owner User',
  avatar_url: '',
  role: 'Owner',
};

const participant: InternalChatParticipant = {
  id: '2',
  main_id: '100',
  full_name: 'Teammate User',
  email: 'teammate@example.com',
  role: 'Sales Agent',
  avatar_url: '',
  is_owner: false,
};

const conversation: InternalChatConversationSummary = {
  conversation_key: 'dm:1:2',
  conversation_type: 'direct',
  title: 'Teammate User',
  subtitle: 'Sales Agent • teammate@example.com',
  avatar_label: 'TU',
  member_count: 2,
  can_manage: false,
  other_participant: participant,
  last_message_preview: 'Hello from teammate',
  last_message_at: '2026-04-12T10:00:00.000Z',
  unread_count: 0,
};

const firstMessage: InternalChatMessage = {
  id: '101',
  conversation_key: 'dm:1:2',
  conversation_type: 'direct',
  sender_id: '2',
  recipient_id: '1',
  message: 'Hello from teammate',
  created_at: '2026-04-12T10:00:00.000Z',
  is_from_current_user: false,
  sender_name: 'Teammate User',
  recipient_name: 'Owner User',
  sender_avatar_url: '',
  recipient_avatar_url: '',
  delivery_status: 'delivered',
  is_read_by_recipient: false,
  reactions: [],
  current_user_reaction: null,
  reply_to_message_id: null,
  reply_preview: null,
};

const secondMessage: InternalChatMessage = {
  id: '102',
  conversation_key: 'dm:1:2',
  conversation_type: 'direct',
  sender_id: '1',
  recipient_id: '2',
  message: 'Reply from owner',
  created_at: '2026-04-12T10:01:00.000Z',
  is_from_current_user: true,
  sender_name: 'Owner User',
  recipient_name: 'Teammate User',
  sender_avatar_url: '',
  recipient_avatar_url: '',
  delivery_status: 'read',
  is_read_by_recipient: true,
  reactions: [],
  current_user_reaction: null,
  reply_to_message_id: null,
  reply_preview: null,
};

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
};

const installViewportMetrics = (viewport: HTMLDivElement) => {
  let scrollTop = 0;
  let scrollHeight = 0;

  Object.defineProperty(viewport, 'clientHeight', {
    configurable: true,
    get: () => 200,
  });

  Object.defineProperty(viewport, 'scrollHeight', {
    configurable: true,
    get: () => scrollHeight,
  });

  Object.defineProperty(viewport, 'scrollTop', {
    configurable: true,
    get: () => scrollTop,
    set: (value: number) => {
      scrollTop = Number(value);
    },
  });

  return {
    getScrollTop: () => scrollTop,
    setScrollHeight: (value: number) => {
      scrollHeight = value;
    },
  };
};

describe('InternalChatLauncher', () => {
  let realtimeHandler: ((event: InternalChatRealtimeEvent) => void) | null;

  beforeEach(() => {
    cleanup();
    realtimeHandler = null;

    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });

    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(performance.now()), 0)
    );
    vi.stubGlobal('cancelAnimationFrame', (handle: number) => window.clearTimeout(handle));

    localApiMocks.fetchInternalChatParticipants.mockResolvedValue([participant]);
    localApiMocks.fetchInternalChatConversations.mockResolvedValue([conversation]);
    localApiMocks.fetchInternalChatGroup.mockResolvedValue({
      id: '55',
      conversation_key: 'grp:55',
      conversation_type: 'group',
      name: 'Support Squad',
      title: 'Support Squad',
      subtitle: '3 members',
      avatar_label: 'SS',
      member_count: 3,
      created_by_user_id: '1',
      can_manage: true,
      members: [participant],
    });
    localApiMocks.fetchInternalChatTypingState.mockResolvedValue({
      conversation_key: 'dm:1:2',
      typing_user_ids: [],
    });
    localApiMocks.fetchInternalChatUnreadCount.mockResolvedValue(0);
    localApiMocks.markInternalChatConversationRead.mockResolvedValue(undefined);
    localApiMocks.createInternalChatGroup.mockResolvedValue({
      id: '55',
      conversation_key: 'grp:55',
      conversation_type: 'group',
      name: 'Support Squad',
      title: 'Support Squad',
      subtitle: '3 members',
      avatar_label: 'SS',
      member_count: 3,
      created_by_user_id: '1',
      can_manage: true,
      members: [participant],
    });
    localApiMocks.renameInternalChatGroup.mockImplementation(async (_groupId: string, name: string) => ({
      id: '55',
      conversation_key: 'grp:55',
      conversation_type: 'group',
      name,
      title: name,
      subtitle: '3 members',
      avatar_label: 'SS',
      member_count: 3,
      created_by_user_id: '1',
      can_manage: true,
      members: [participant],
    }));
    localApiMocks.addInternalChatGroupMembers.mockImplementation(async () => ({
      id: '55',
      conversation_key: 'grp:55',
      conversation_type: 'group',
      name: 'Support Squad',
      title: 'Support Squad',
      subtitle: '3 members',
      avatar_label: 'SS',
      member_count: 3,
      created_by_user_id: '1',
      can_manage: true,
      members: [participant],
    }));
    localApiMocks.removeInternalChatGroupMember.mockImplementation(async () => ({
      id: '55',
      conversation_key: 'grp:55',
      conversation_type: 'group',
      name: 'Support Squad',
      title: 'Support Squad',
      subtitle: '2 members',
      avatar_label: 'SS',
      member_count: 2,
      created_by_user_id: '1',
      can_manage: true,
      members: [participant],
    }));
    localApiMocks.sendInternalChatMessage.mockResolvedValue([]);
    localApiMocks.toggleInternalChatReaction.mockResolvedValue({
      message_id: '101',
      conversation_key: 'dm:1:2',
      reactions: [],
      current_user_reaction: null,
    });
    localApiMocks.updateInternalChatTyping.mockResolvedValue({
      conversation_key: 'dm:1:2',
      typing_user_ids: [],
    });
    mentionServiceMocks.searchInternalChatEntityMentions.mockResolvedValue([]);
    mentionServiceMocks.preloadInternalChatMentionCaches.mockResolvedValue(undefined);
    realtimeMocks.openInternalChatRealtimeStream.mockImplementation((onEvent: (event: InternalChatRealtimeEvent) => void) => {
      realtimeHandler = onEvent;
      return () => {};
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('keeps the active conversation pinned to the bottom through loads, typing, new messages, and reply mode', async () => {
    const initialMessages = [firstMessage, secondMessage];
    const deferredMessages = createDeferred<InternalChatMessage[]>();
    let storedMessages = [...initialMessages];
    let fetchMessagesCallCount = 0;

    localApiMocks.fetchInternalChatMessages.mockImplementation(() => {
      fetchMessagesCallCount += 1;
      if (fetchMessagesCallCount === 1) {
        return deferredMessages.promise;
      }

      return Promise.resolve(storedMessages);
    });

    render(
      <ToastProvider>
        <InternalChatLauncher user={currentUser} />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open Internal Chat' }));

    const viewport = await screen.findByTestId('internal-chat-message-viewport');
    const metrics = installViewportMetrics(viewport as HTMLDivElement);

    metrics.setScrollHeight(600);
    await act(async () => {
      deferredMessages.resolve(initialMessages);
    });

    await waitFor(() => {
      expect(metrics.getScrollTop()).toBe(400);
    });

    metrics.setScrollHeight(640);
    await act(async () => {
      realtimeHandler?.({
        type: 'typing.updated',
        conversation_key: 'dm:1:2',
        user_id: '2',
        is_typing: true,
        typing_user_ids: ['2'],
      });
    });

    await waitFor(() => {
      expect(metrics.getScrollTop()).toBe(440);
    });

    const liveMessage: InternalChatMessage = {
      id: '103',
      conversation_key: 'dm:1:2',
      conversation_type: 'direct',
      sender_id: '2',
      recipient_id: '1',
      message: 'Newest update from teammate',
      created_at: '2026-04-12T10:02:00.000Z',
      is_from_current_user: false,
      sender_name: 'Teammate User',
      recipient_name: 'Owner User',
      sender_avatar_url: '',
      recipient_avatar_url: '',
      delivery_status: 'delivered',
      is_read_by_recipient: false,
      reactions: [
        {
          emoji: '👍',
          count: 1,
          reacted_by_current_user: true,
        },
      ],
      current_user_reaction: '👍',
      reply_to_message_id: null,
      reply_preview: null,
    };

    storedMessages = [...initialMessages, liveMessage];
    metrics.setScrollHeight(760);
    await act(async () => {
      realtimeHandler?.({
        type: 'message.created',
        message: liveMessage,
      });
    });

    await waitFor(() => {
      expect(metrics.getScrollTop()).toBe(560);
    });

    metrics.setScrollHeight(720);
    fireEvent.click(screen.getByRole('button', { name: /👍/ }));

    await waitFor(() => {
      expect(metrics.getScrollTop()).toBe(520);
    });

    metrics.setScrollHeight(780);
    fireEvent.click(screen.getAllByText('Hello from teammate')[1]);
    fireEvent.click(screen.getByLabelText('Reply to message 101'));

    await screen.findByText('Replying to Teammate User');
    await waitFor(() => {
      expect(metrics.getScrollTop()).toBe(580);
    });
  });

  it('renders stored record mentions as clickable links that navigate to the target module', async () => {
    const workflowHandler = vi.fn();
    window.addEventListener('workflow:navigate', workflowHandler as EventListener);

    localApiMocks.fetchInternalChatMessages.mockResolvedValue([
      {
        ...firstMessage,
        message: 'Open [Sales Order SO-1001](mention:sales-order:so-1001) for details.',
      },
    ]);

    render(
      <ToastProvider>
        <InternalChatLauncher user={currentUser} />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open Internal Chat' }));

    const mentionLink = await screen.findByRole('button', { name: 'Sales Order SO-1001' });
    fireEvent.click(mentionLink);

    expect(workflowHandler).toHaveBeenCalled();
    const navigationEvent = workflowHandler.mock.calls[0]?.[0] as CustomEvent<{ tab: string; payload?: Record<string, string> }>;
    expect(navigationEvent.detail).toEqual({
      tab: 'sales-transaction-sales-order',
      payload: { orderId: 'so-1001' },
    });

    window.removeEventListener('workflow:navigate', workflowHandler as EventListener);
  });

  it('treats @invoice as a scoped invoice mention trigger', async () => {
    mentionServiceMocks.searchInternalChatEntityMentions.mockResolvedValue([
      {
        entityType: 'invoice',
        entityId: 'inv-22',
        label: 'Invoice INV-22',
        subtitle: 'Open invoice',
      },
    ]);
    localApiMocks.fetchInternalChatMessages.mockResolvedValue([firstMessage]);

    render(
      <ToastProvider>
        <InternalChatLauncher user={currentUser} />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open Internal Chat' }));

    const composer = await screen.findByPlaceholderText(/try @invoice inv-1001/i);
    fireEvent.change(composer, { target: { value: '@invoice ' } });

    await waitFor(() => {
      expect(mentionServiceMocks.searchInternalChatEntityMentions).toHaveBeenCalledWith('', {
        entityTypes: ['invoice'],
      });
    });

    expect(await screen.findByText('Mention Invoice')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Invoice INV-22/i })).toBeInTheDocument();
  });

  it('keeps the composer readable while sending encoded entity mention payloads', async () => {
    mentionServiceMocks.searchInternalChatEntityMentions.mockResolvedValue([
      {
        entityType: 'invoice',
        entityId: '2026032923434820095',
        label: 'Invoice T-12940',
        subtitle: 'Open invoice',
      },
    ]);
    localApiMocks.fetchInternalChatMessages.mockResolvedValue([firstMessage]);
    localApiMocks.sendInternalChatMessage.mockResolvedValue([]);

    render(
      <ToastProvider>
        <InternalChatLauncher user={currentUser} />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open Internal Chat' }));

    const composer = await screen.findByPlaceholderText(/try @invoice inv-1001/i);
    fireEvent.change(composer, { target: { value: '@invoice ' } });

    const invoiceSuggestion = await screen.findByRole('button', { name: /Invoice T-12940/i });
    fireEvent.mouseDown(invoiceSuggestion);

    await waitFor(() => {
      expect((composer as HTMLTextAreaElement).value).toBe('@Invoice T-12940 ');
    });

    fireEvent.click(screen.getByLabelText('Send message'));

    await waitFor(() => {
      expect(localApiMocks.sendInternalChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '[Invoice T-12940](mention:invoice:2026032923434820095)',
        })
      );
    });
  });
});
