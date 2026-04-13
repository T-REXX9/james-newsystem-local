export const INTERNAL_CHAT_SOCKET_EVENT = 'chat:event';

const normalizeString = (value) => String(value ?? '').trim();

const participantsFromConversationKey = (conversationKey) => {
  const match = normalizeString(conversationKey).match(/^dm:(\d+):(\d+)$/);
  if (!match) {
    return [];
  }

  return [match[1], match[2]];
};

const normalizeTargetUserIds = (payload, fallbackConversationKey = payload?.conversation_key) => {
  const targetUserIds = Array.isArray(payload?.target_user_ids)
    ? payload.target_user_ids.map((userId) => normalizeString(userId)).filter(Boolean)
    : [];

  if (targetUserIds.length > 0) {
    return [...new Set(targetUserIds)];
  }

  return participantsFromConversationKey(fallbackConversationKey);
};

const normalizeReactionSummaries = (reactions) =>
  Array.isArray(reactions)
    ? reactions
        .map((reaction) => ({
          emoji: normalizeString(reaction?.emoji),
          count: Number(reaction?.count || 0),
          reacted_by_current_user: Boolean(reaction?.reacted_by_current_user),
        }))
        .filter((reaction) => reaction.emoji !== '')
    : [];

const normalizeTypingUserIds = (typingUserIds) =>
  Array.isArray(typingUserIds)
    ? typingUserIds.map((userId) => normalizeString(userId)).filter(Boolean)
    : [];

const normalizeMessage = (item) => ({
  id: normalizeString(item?.id),
  conversation_key: normalizeString(item?.conversation_key),
  conversation_type: normalizeString(item?.conversation_type) || 'direct',
  sender_id: normalizeString(item?.sender_id),
  recipient_id: normalizeString(item?.recipient_id),
  message: String(item?.message ?? ''),
  created_at: normalizeString(item?.created_at),
  is_from_current_user: false,
  sender_name: String(item?.sender_name ?? ''),
  recipient_name: String(item?.recipient_name ?? ''),
  sender_avatar_url: String(item?.sender_avatar_url ?? ''),
  recipient_avatar_url: String(item?.recipient_avatar_url ?? ''),
  delivery_status: normalizeString(item?.delivery_status) || 'sent',
  is_read_by_recipient: Boolean(item?.is_read_by_recipient),
  reactions: normalizeReactionSummaries(item?.reactions),
  current_user_reaction: item?.current_user_reaction ?? null,
  reply_to_message_id: item?.reply_to_message_id ?? null,
  reply_preview: item?.reply_preview ?? null,
});

export const translateInternalChatNotification = (payload) => {
  const type = normalizeString(payload?.type);

  if (type === 'messages.created') {
    const items = Array.isArray(payload?.items) ? payload.items : [];

    return items.flatMap((item) => {
      const message = normalizeMessage(item);
      const targetUserIds = normalizeTargetUserIds(item, message.conversation_key);

      return targetUserIds.map((userId) => ({
        userId,
        event: {
          type: 'message.created',
          message,
        },
      }));
    });
  }

  if (type === 'conversation.read') {
    return normalizeTargetUserIds(payload).map((userId) => ({
      userId,
      event: {
        type: 'conversation.read',
        user_id: normalizeString(payload?.user_id),
        read_by_user_id: normalizeString(payload?.read_by_user_id || payload?.user_id),
        conversation_key: normalizeString(payload?.conversation_key),
        updated_count: Number(payload?.updated_count || 0),
      },
    }));
  }

  if (type === 'reaction.updated') {
    return normalizeTargetUserIds(payload).map((userId) => ({
      userId,
      event: {
        type: 'reaction.updated',
        conversation_key: normalizeString(payload?.conversation_key),
        message_id: normalizeString(payload?.message_id),
        reactions: normalizeReactionSummaries(payload?.reactions),
        current_user_reaction: payload?.current_user_reaction ?? null,
        actor_user_id: normalizeString(payload?.actor_user_id),
      },
    }));
  }

  if (type === 'typing.updated') {
    return normalizeTargetUserIds(payload).map((userId) => ({
      userId,
      event: {
        type: 'typing.updated',
        conversation_key: normalizeString(payload?.conversation_key),
        user_id: normalizeString(payload?.user_id),
        is_typing: Boolean(payload?.is_typing),
        typing_user_ids: normalizeTypingUserIds(payload?.typing_user_ids),
      },
    }));
  }

  return [];
};
