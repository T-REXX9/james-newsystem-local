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

const logRealtimeEvent = (level: 'info' | 'warn' | 'error', message: string, details?: Record<string, unknown>) => {
  const payload = {
    socketUrl: resolveSocketUrl(),
    socketPath: SOCKET_PATH,
    ...(details || {}),
  };

  if (level === 'error') {
    console.error(`[InternalChatRealtime] ${message}`, payload);
    return;
  }

  if (level === 'warn') {
    console.warn(`[InternalChatRealtime] ${message}`, payload);
    return;
  }

  console.info(`[InternalChatRealtime] ${message}`, payload);
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

  socket.on('connect', () => {
    logRealtimeEvent('info', 'Connected', {
      socketId: socket.id,
      userId: session.userProfile?.id || session.context?.user?.id || null,
    });
  });

  socket.on('disconnect', (reason) => {
    if (reason === 'io client disconnect') {
      logRealtimeEvent('info', 'Closed by client', { reason });
      return;
    }

    logRealtimeEvent('warn', 'Disconnected', {
      reason,
      active: typeof document !== 'undefined' ? document.visibilityState : 'unknown',
    });
    onError?.();
  });

  socket.io.on('reconnect_attempt', (attempt) => {
    logRealtimeEvent('warn', 'Reconnecting', { attempt });
  });

  socket.io.on('reconnect', (attempt) => {
    logRealtimeEvent('info', 'Reconnected', { attempt });
  });

  socket.io.on('reconnect_error', (error) => {
    logRealtimeEvent('error', 'Reconnect failed', {
      message: error instanceof Error ? error.message : String(error),
    });
  });

  socket.io.on('reconnect_failed', () => {
    logRealtimeEvent('error', 'Reconnect attempts exhausted');
  });

  socket.io.on('error', (error) => {
    logRealtimeEvent('error', 'Manager error', {
      message: error instanceof Error ? error.message : String(error),
    });
  });

  socket.on('error', (error) => {
    logRealtimeEvent('error', 'Socket error', {
      message: error instanceof Error ? error.message : String(error),
    });
  });

  socket.on('connect_error', (error) => {
    logRealtimeEvent('error', 'Connect failed', {
      message: error instanceof Error ? error.message : String(error),
      description:
        typeof error === 'object' && error !== null && 'description' in error
          ? String((error as { description?: unknown }).description || '')
          : '',
      context:
        typeof error === 'object' && error !== null && 'context' in error
          ? (error as { context?: unknown }).context
          : undefined,
    });
    handleError();
  });

  socket.on('chat:event', handleEvent);

  return () => {
    socket.off('chat:event', handleEvent);
    socket.close();
  };
};
