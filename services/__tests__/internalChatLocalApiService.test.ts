import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addInternalChatGroupMembers,
  createInternalChatGroup,
  removeInternalChatGroupMember,
  renameInternalChatGroup,
  sendInternalChatMessage,
} from '../internalChatLocalApiService';

const getLocalAuthSessionMock = vi.fn();

vi.mock('../localAuthService', () => ({
  getLocalAuthSession: () => getLocalAuthSessionMock(),
}));

describe('internalChatLocalApiService', () => {
  beforeEach(() => {
    getLocalAuthSessionMock.mockReset();
    getLocalAuthSessionMock.mockReturnValue({
      token: 'token-123',
      userProfile: {
        id: '73',
      },
      context: {
        user: {
          id: 73,
        },
      },
    });
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('includes reply_to_message_id when sending a reply', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          items: [
            {
              id: '11',
              conversation_key: 'dm:73:74',
              conversation_type: 'direct',
              sender_id: '73',
              recipient_id: '74',
              message: 'Replying now',
              created_at: '2026-04-10 00:00:00',
              is_from_current_user: true,
              sender_name: 'Test User',
              recipient_name: 'Other User',
              sender_avatar_url: '',
              recipient_avatar_url: '',
              delivery_status: 'delivered',
              is_read_by_recipient: false,
              reactions: [],
              current_user_reaction: null,
              reply_to_message_id: '9',
              reply_preview: {
                message_id: '9',
                sender_id: '74',
                sender_name: 'Other User',
                message: 'Original message',
                is_from_current_user: false,
                is_available: true,
              },
            },
          ],
        },
      }),
    });

    const items = await sendInternalChatMessage({
      message: 'Replying now',
      conversationKey: 'dm:73:74',
      recipientIds: ['74'],
      replyToMessageId: '9',
    });

    const [, init] = (global.fetch as any).mock.calls[0];
    expect(JSON.parse(String(init.body))).toEqual(
      expect.objectContaining({
        message: 'Replying now',
        conversation_key: 'dm:73:74',
        recipient_ids: ['74'],
        reply_to_message_id: '9',
      })
    );
    expect(items[0]?.reply_to_message_id).toBe('9');
    expect(items[0]?.reply_preview?.message_id).toBe('9');
  });

  it('sends the expected group management requests', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: '55',
          conversation_key: 'grp:55',
          conversation_type: 'group',
          name: 'Ops',
          title: 'Ops',
          subtitle: '2 members',
          avatar_label: 'OP',
          member_count: 2,
          created_by_user_id: '73',
          can_manage: true,
          members: [],
        },
      }),
    });

    await createInternalChatGroup('Ops', ['2', '3']);
    await renameInternalChatGroup('55', 'Ops Updated');
    await addInternalChatGroupMembers('55', ['4']);
    await removeInternalChatGroupMember('55', '4');

    const createCall = (global.fetch as any).mock.calls[0];
    const renameCall = (global.fetch as any).mock.calls[1];
    const addMembersCall = (global.fetch as any).mock.calls[2];
    const removeMemberCall = (global.fetch as any).mock.calls[3];

    expect(createCall[0]).toBe('/api/v1/internal-chat/groups');
    expect(createCall[1]).toEqual(
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: 'Ops',
          member_ids: ['2', '3'],
        }),
      })
    );

    expect(renameCall[0]).toBe('/api/v1/internal-chat/groups/55');
    expect(renameCall[1]).toEqual(
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ name: 'Ops Updated' }),
      })
    );

    expect(addMembersCall[0]).toBe('/api/v1/internal-chat/groups/55/members');
    expect(addMembersCall[1]).toEqual(
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ member_ids: ['4'] }),
      })
    );

    expect(removeMemberCall[0]).toBe('/api/v1/internal-chat/groups/55/members/4');
    expect(removeMemberCall[1]).toEqual(
      expect.objectContaining({
        method: 'DELETE',
      })
    );
  });
});
