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
}

export interface SendInternalChatMessageInput {
  message: string;
  recipientIds?: string[];
  conversationKey?: string;
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

export async function fetchInternalChatParticipants(): Promise<InternalChatParticipant[]> {
  const payload = await requestJson<{ items?: InternalChatParticipant[] }>(`${API_BASE_URL}/internal-chat/participants`);
  return Array.isArray(payload?.items) ? payload.items : [];
}

export async function fetchInternalChatConversations(): Promise<InternalChatConversationSummary[]> {
  const payload = await requestJson<{ items?: InternalChatConversationSummary[] }>(`${API_BASE_URL}/internal-chat/conversations`);
  return Array.isArray(payload?.items) ? payload.items : [];
}

export async function fetchInternalChatMessages(conversationKey: string): Promise<InternalChatMessage[]> {
  const payload = await requestJson<{ items?: InternalChatMessage[] }>(
    `${API_BASE_URL}/internal-chat/conversations/${encodeURIComponent(conversationKey)}/messages`
  );
  return Array.isArray(payload?.items) ? payload.items : [];
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

export async function markInternalChatConversationRead(conversationKey: string): Promise<void> {
  await requestJson(`${API_BASE_URL}/internal-chat/conversations/${encodeURIComponent(conversationKey)}/read`, {
    method: 'POST',
  });
}

export async function fetchInternalChatUnreadCount(): Promise<number> {
  const payload = await requestJson<{ count?: number }>(`${API_BASE_URL}/internal-chat/unread-count`);
  return Number(payload?.count || 0);
}
