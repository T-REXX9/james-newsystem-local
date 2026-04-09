import { getLocalAuthSession } from './localAuthService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';

export interface InternalChatParticipant {
  id: string;
  main_id: string;
  full_name: string;
  email: string;
  role: string;
  avatar_url: string;
  is_owner: boolean;
}

export interface InternalChatConversationSummary {
  conversation_key: string;
  other_participant: InternalChatParticipant;
  last_message_preview: string;
  last_message_at: string;
  unread_count: number;
}

export interface InternalChatMessage {
  id: string;
  conversation_key: string;
  sender_id: string;
  recipient_id: string;
  message: string;
  created_at: string;
  is_from_current_user: boolean;
  sender_name: string;
  recipient_name: string;
  sender_avatar_url: string;
  recipient_avatar_url: string;
  delivery_status: 'sent' | 'delivered' | 'read';
  is_read_by_recipient: boolean;
  reactions: InternalChatReactionSummary[];
  current_user_reaction: string | null;
  is_pending?: boolean;
}

export interface SendInternalChatMessageInput {
  message: string;
  recipientIds?: string[];
  conversationKey?: string;
}

export interface InternalChatRequestOptions {
  signal?: AbortSignal;
}

export interface InternalChatReactionSummary {
  emoji: string;
  count: number;
  reacted_by_current_user: boolean;
}

export interface InternalChatReactionPayload {
  message_id: string;
  conversation_key: string;
  reactions: InternalChatReactionSummary[];
  current_user_reaction: string | null;
  actor_user_id?: string;
}

export interface InternalChatTypingState {
  conversation_key: string;
  typing_user_ids: string[];
}

const parseApiErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = await response.json();
    if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error.trim();
    if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message.trim();
  } catch {
    // ignore parse errors
  }

  return `API request failed (${response.status}${response.statusText ? `: ${response.statusText}` : ''})`;
};

const getAuthHeaders = (): HeadersInit => {
  const session = getLocalAuthSession();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (session?.token) {
    headers.Authorization = `Bearer ${session.token}`;
  }

  return headers;
};

const extractApiData = <T>(result: unknown): T | undefined => {
  if (!result || typeof result !== 'object') {
    return undefined;
  }

  const outerData = (result as { data?: unknown }).data;
  if (outerData && typeof outerData === 'object' && 'data' in (outerData as Record<string, unknown>)) {
    return (outerData as { data?: T }).data;
  }

  return outerData as T | undefined;
};

const requestJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...getAuthHeaders(),
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(await parseApiErrorMessage(response));
  }

  const result = await response.json();
  return (extractApiData<T>(result) ?? result?.data ?? result) as T;
};

export const buildDirectConversationKey = (firstUserId: string, secondUserId: string): string => {
  const ids = [Number(firstUserId || 0), Number(secondUserId || 0)].sort((a, b) => a - b);
  return `dm:${ids[0]}:${ids[1]}`;
};

export async function fetchInternalChatParticipants(options?: InternalChatRequestOptions): Promise<InternalChatParticipant[]> {
  const payload = await requestJson<{ items?: InternalChatParticipant[] }>(`${API_BASE_URL}/internal-chat/participants`, {
    signal: options?.signal,
  });
  return Array.isArray(payload?.items) ? payload.items : [];
}

export async function fetchInternalChatConversations(options?: InternalChatRequestOptions): Promise<InternalChatConversationSummary[]> {
  const payload = await requestJson<{ items?: InternalChatConversationSummary[] }>(`${API_BASE_URL}/internal-chat/conversations`, {
    signal: options?.signal,
  });
  return Array.isArray(payload?.items) ? payload.items : [];
}

export async function fetchInternalChatMessages(
  conversationKey: string,
  options?: InternalChatRequestOptions
): Promise<InternalChatMessage[]> {
  const payload = await requestJson<{ items?: InternalChatMessage[] }>(
    `${API_BASE_URL}/internal-chat/conversations/${encodeURIComponent(conversationKey)}/messages`,
    {
      signal: options?.signal,
    }
  );
  return Array.isArray(payload?.items) ? payload.items : [];
}

export async function fetchInternalChatTypingState(
  conversationKey: string,
  options?: InternalChatRequestOptions
): Promise<InternalChatTypingState> {
  const payload = await requestJson<InternalChatTypingState>(
    `${API_BASE_URL}/internal-chat/conversations/${encodeURIComponent(conversationKey)}/typing`,
    {
      signal: options?.signal,
    }
  );

  return {
    conversation_key: payload?.conversation_key || conversationKey,
    typing_user_ids: Array.isArray(payload?.typing_user_ids)
      ? payload.typing_user_ids.map((value) => String(value || '')).filter(Boolean)
      : [],
  };
}

export async function sendInternalChatMessage(input: SendInternalChatMessageInput): Promise<InternalChatMessage[]> {
  const payload = await requestJson<{ items?: InternalChatMessage[] }>(`${API_BASE_URL}/internal-chat/messages`, {
    method: 'POST',
    body: JSON.stringify({
      message: input.message,
      recipient_ids: input.recipientIds || [],
      conversation_key: input.conversationKey || undefined,
    }),
  });
  return Array.isArray(payload?.items) ? payload.items : [];
}

export async function toggleInternalChatReaction(messageId: string, emoji: string): Promise<InternalChatReactionPayload> {
  return await requestJson<InternalChatReactionPayload>(`${API_BASE_URL}/internal-chat/messages/${encodeURIComponent(messageId)}/reaction`, {
    method: 'POST',
    body: JSON.stringify({ emoji }),
  });
}

export async function markInternalChatConversationRead(conversationKey: string): Promise<void> {
  await requestJson(`${API_BASE_URL}/internal-chat/conversations/${encodeURIComponent(conversationKey)}/read`, {
    method: 'POST',
  });
}

export async function updateInternalChatTyping(conversationKey: string, isTyping: boolean): Promise<InternalChatTypingState> {
  const payload = await requestJson<InternalChatTypingState>(
    `${API_BASE_URL}/internal-chat/conversations/${encodeURIComponent(conversationKey)}/typing`,
    {
      method: 'POST',
      body: JSON.stringify({
        is_typing: isTyping,
      }),
    }
  );

  return {
    conversation_key: payload?.conversation_key || conversationKey,
    typing_user_ids: Array.isArray(payload?.typing_user_ids)
      ? payload.typing_user_ids.map((value) => String(value || '')).filter(Boolean)
      : [],
  };
}

export async function fetchInternalChatUnreadCount(options?: InternalChatRequestOptions): Promise<number> {
  const payload = await requestJson<{ count?: number }>(`${API_BASE_URL}/internal-chat/unread-count`, {
    signal: options?.signal,
  });
  return Number(payload?.count || 0);
}
