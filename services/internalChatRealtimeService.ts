import { io } from 'socket.io-client';
import { getLocalAuthSession } from './localAuthService';
import { InternalChatMessage, InternalChatReactionSummary } from './internalChatLocalApiService';

const SOCKET_URL = (import.meta as any)?.env?.VITE_INTERNAL_CHAT_SOCKET_URL || '';
const SOCKET_PORT = (import.meta as any)?.env?.VITE_INTERNAL_CHAT_SOCKET_PORT || '';
const SOCKET_PATH = '/socket.io';

const isLoopbackHost = (hostname: string): boolean => {
  const normalized = hostname.trim().toLowerCase();
  return normalized === '127.0.0.1' || normalized === 'localhost' || normalized === '::1';
};

export type InternalChatRealtimeEvent =
  | {
      type: 'message.created';
      message: InternalChatMessage;
    }
  | {
      type: 'conversation.read';
      user_id: string;
      read_by_user_id?: string;
      conversation_key: string;
      updated_count: number;
    }
  | {
      type: 'reaction.updated';
      conversation_key: string;
      message_id: string;
      reactions: InternalChatReactionSummary[];
      current_user_reaction: string | null;
      actor_user_id: string;
    }
  | {
      type: 'typing.updated';
      conversation_key: string;
      user_id: string;
      is_typing: boolean;
      typing_user_ids: string[];
    };

const resolveSocketUrl = (): string => {
  const configured = String(SOCKET_URL || '').trim();
  if (typeof window === 'undefined') {
    return configured;
  }

  if (configured) {
    try {
      const resolvedUrl = new URL(configured, window.location.origin);
      if (isLoopbackHost(resolvedUrl.hostname) && !isLoopbackHost(window.location.hostname)) {
        return window.location.origin;
      }
      return resolvedUrl.toString().replace(/\/$/, '');
    } catch {
      return configured;
    }
  }

  if (SOCKET_PORT && isLoopbackHost(window.location.hostname)) {
    return `${window.location.protocol}//${window.location.hostname}:${SOCKET_PORT}`;
  }

  return window.location.origin;
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

  let closedByClient = false;

  const socket = io(resolveSocketUrl(), {
    path: SOCKET_PATH,
    auth: {
      token: session.token,
    },
    reconnection: true,
    reconnectionAttempts: Infinity,
  });

  const handleEvent = (payload: InternalChatRealtimeEvent) => {
    if (!payload || typeof payload !== 'object' || typeof payload.type !== 'string') {
      onError?.();
      return;
    }

    if (payload.type === 'message.created' && payload.message) {
      onEvent({
        ...payload,
        message: {
          ...payload.message,
          conversation_type: payload.message.conversation_type || 'direct',
          reply_to_message_id: payload.message.reply_to_message_id ?? null,
          reply_preview: payload.message.reply_preview ?? null,
        },
      });
      return;
    }

    if (payload.type === 'conversation.read') {
      onEvent({
        ...payload,
        updated_count: Number(payload.updated_count || 0),
      });
      return;
    }

    if (payload.type === 'reaction.updated') {
      onEvent({
        ...payload,
        reactions: Array.isArray(payload.reactions) ? payload.reactions : [],
        current_user_reaction: payload.current_user_reaction ?? null,
        actor_user_id: String(payload.actor_user_id || ''),
      });
      return;
    }

    if (payload.type === 'typing.updated') {
      onEvent({
        ...payload,
        is_typing: Boolean(payload.is_typing),
        typing_user_ids: Array.isArray(payload.typing_user_ids)
          ? payload.typing_user_ids.map((id) => String(id || '')).filter(Boolean)
          : [],
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
    if (closedByClient || reason === 'io client disconnect') {
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
    closedByClient = true;
    socket.off('chat:event', handleEvent);
    socket.close();
  };
};
