import { getLocalAuthSession } from './localAuthService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';

export interface InternalChatRealtimeState {
  latest_message_id: string;
  latest_message_at: string;
  latest_message_preview: string;
  latest_conversation_key: string;
  latest_sender_id: string;
  latest_sender_name: string;
  latest_alert_id: string;
  unread_count: number;
}

const buildStreamUrl = (token: string): string => {
  const streamUrl = new URL(`${API_BASE_URL}/internal-chat/stream`, window.location.origin);
  streamUrl.searchParams.set('token', token);
  return streamUrl.toString();
};

export const openInternalChatRealtimeStream = (
  onState: (state: InternalChatRealtimeState) => void,
  onError?: () => void
): (() => void) => {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
    return () => {};
  }

  const session = getLocalAuthSession();
  if (!session?.token) {
    return () => {};
  }

  const eventSource = new EventSource(buildStreamUrl(session.token));

  const handleState = (event: MessageEvent<string>) => {
    try {
      const payload = JSON.parse(event.data) as InternalChatRealtimeState;
      onState({
        ...payload,
        unread_count: Number(payload?.unread_count || 0),
      });
    } catch {
      onError?.();
    }
  };

  eventSource.addEventListener('chat_state', handleState as EventListener);
  eventSource.onerror = () => {
    onError?.();
  };

  return () => {
    eventSource.removeEventListener('chat_state', handleState as EventListener);
    eventSource.close();
  };
};
