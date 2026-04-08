import { io } from 'socket.io-client';
import { getLocalAuthSession } from './localAuthService';
import { InternalChatMessage } from './internalChatLocalApiService';

const SOCKET_URL = (import.meta as any)?.env?.VITE_INTERNAL_CHAT_SOCKET_URL || '';
const SOCKET_PATH = '/socket.io';

export type InternalChatRealtimeEvent =
  | {
      type: 'message.created';
      message: InternalChatMessage;
    }
  | {
      type: 'conversation.read';
      user_id: string;
      conversation_key: string;
      updated_count: number;
    };

const resolveSocketUrl = (): string => {
  if (SOCKET_URL) {
    return SOCKET_URL;
  }

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return '';
};

export const openInternalChatRealtimeStream = (
  onEvent: (event: InternalChatRealtimeEvent) => void,
  onError?: () => void
): (() => void) => {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const session = getLocalAuthSession();
  if (!session?.token) {
    return () => {};
  }

  const socket = io(resolveSocketUrl(), {
    path: SOCKET_PATH,
    transports: ['websocket'],
    auth: {
      token: session.token,
    },
    reconnection: true,
  });

  const handleEvent = (payload: InternalChatRealtimeEvent) => {
    if (!payload || typeof payload !== 'object' || typeof payload.type !== 'string') {
      onError?.();
      return;
    }

    if (payload.type === 'message.created' && payload.message) {
      onEvent(payload);
      return;
    }

    if (payload.type === 'conversation.read') {
      onEvent({
        ...payload,
        updated_count: Number(payload.updated_count || 0),
      });
      return;
    }

    onError?.();
  };

  const handleError = () => {
    onError?.();
  };

  socket.on('chat:event', handleEvent);
  socket.on('connect_error', handleError);

  return () => {
    socket.off('chat:event', handleEvent);
    socket.off('connect_error', handleError);
    socket.close();
  };
};
