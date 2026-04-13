import { describe, expect, it } from 'vitest';
import {
  INTERNAL_CHAT_SOCKET_EVENT,
  translateInternalChatNotification,
} from '../../scripts/internal-chat-realtime-contract.mjs';

describe('internalChatRealtimeContract', () => {
  it('exports the shared socket event channel', () => {
    expect(INTERNAL_CHAT_SOCKET_EVENT).toBe('chat:event');
  });

  it('translates created messages into per-user socket events', () => {
    const events = translateInternalChatNotification({
      type: 'messages.created',
      items: [
        {
          id: '11',
          conversation_key: 'grp:55',
          conversation_type: 'group',
          sender_id: '1',
          recipient_id: '',
          message: 'hello team',
          created_at: '2026-04-13 15:10:00',
          sender_name: 'Creator',
          recipient_name: '',
          sender_avatar_url: '',
          recipient_avatar_url: '',
          delivery_status: 'delivered',
          is_read_by_recipient: false,
          reactions: [{ emoji: '👍', count: 2, reacted_by_current_user: false }],
          current_user_reaction: null,
          reply_to_message_id: '9',
          reply_preview: { message_id: '9', message: 'Earlier note' },
          target_user_ids: ['1', '2', '3'],
        },
      ],
    });

    expect(events).toHaveLength(3);
    expect(events.map(({ userId }) => userId)).toEqual(['1', '2', '3']);
    expect(events[0]?.event).toEqual(
      expect.objectContaining({
        type: 'message.created',
        message: expect.objectContaining({
          id: '11',
          conversation_key: 'grp:55',
          message: 'hello team',
          reply_to_message_id: '9',
          reply_preview: { message_id: '9', message: 'Earlier note' },
        }),
      })
    );
  });

  it('falls back to direct-conversation participants when explicit targets are absent', () => {
    const events = translateInternalChatNotification({
      type: 'conversation.read',
      conversation_key: 'dm:7:9',
      user_id: '7',
      updated_count: 2,
    });

    expect(events).toHaveLength(2);
    expect(events.map(({ userId }) => userId)).toEqual(['7', '9']);
    expect(events[0]?.event).toEqual({
      type: 'conversation.read',
      user_id: '7',
      read_by_user_id: '7',
      conversation_key: 'dm:7:9',
      updated_count: 2,
    });
  });

  it('normalizes reaction and typing payloads for socket delivery', () => {
    const reactionEvents = translateInternalChatNotification({
      type: 'reaction.updated',
      conversation_key: 'grp:55',
      message_id: '44',
      reactions: [{ emoji: '❤️', count: '1', reacted_by_current_user: 1 }],
      current_user_reaction: '❤️',
      actor_user_id: '2',
      target_user_ids: ['2', '4'],
    });
    const typingEvents = translateInternalChatNotification({
      type: 'typing.updated',
      conversation_key: 'grp:55',
      user_id: '4',
      is_typing: 1,
      typing_user_ids: ['4', '', null],
      target_user_ids: ['2', '4'],
    });

    expect(reactionEvents).toEqual([
      {
        userId: '2',
        event: {
          type: 'reaction.updated',
          conversation_key: 'grp:55',
          message_id: '44',
          reactions: [{ emoji: '❤️', count: 1, reacted_by_current_user: true }],
          current_user_reaction: '❤️',
          actor_user_id: '2',
        },
      },
      {
        userId: '4',
        event: {
          type: 'reaction.updated',
          conversation_key: 'grp:55',
          message_id: '44',
          reactions: [{ emoji: '❤️', count: 1, reacted_by_current_user: true }],
          current_user_reaction: '❤️',
          actor_user_id: '2',
        },
      },
    ]);

    expect(typingEvents).toEqual([
      {
        userId: '2',
        event: {
          type: 'typing.updated',
          conversation_key: 'grp:55',
          user_id: '4',
          is_typing: true,
          typing_user_ids: ['4'],
        },
      },
      {
        userId: '4',
        event: {
          type: 'typing.updated',
          conversation_key: 'grp:55',
          user_id: '4',
          is_typing: true,
          typing_user_ids: ['4'],
        },
      },
    ]);
  });
});
