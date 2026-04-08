import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openInternalChatRealtimeStream } from '../internalChatRealtimeService';

const getLocalAuthSessionMock = vi.fn();
const ioMock = vi.fn();

vi.mock('../localAuthService', () => ({
  getLocalAuthSession: () => getLocalAuthSessionMock(),
}));

vi.mock('socket.io-client', () => ({
  io: (...args: unknown[]) => ioMock(...args),
}));

describe('internalChatRealtimeService', () => {
  let socketMock: {
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    getLocalAuthSessionMock.mockReset();
    ioMock.mockReset();

    socketMock = {
      on: vi.fn(),
      off: vi.fn(),
      close: vi.fn(),
    };

    ioMock.mockReturnValue(socketMock);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('opens a websocket with the local auth token and forwards chat events', () => {
    getLocalAuthSessionMock.mockReturnValue({
      token: 'abc123',
    });

    const onEvent = vi.fn();
    const onError = vi.fn();
    const cleanup = openInternalChatRealtimeStream(onEvent, onError);

    expect(ioMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        path: '/socket.io',
        transports: ['websocket'],
        auth: { token: 'abc123' },
      })
    );

    const chatHandler = socketMock.on.mock.calls.find(([name]) => name === 'chat:event')?.[1];
    expect(typeof chatHandler).toBe('function');

    chatHandler?.({
      type: 'message.created',
      message: {
        id: '10',
        conversation_key: 'dm:1:2',
        sender_id: '1',
        recipient_id: '2',
        message: 'hello',
        created_at: '2026-04-08 23:00:00',
        is_from_current_user: false,
        sender_name: 'Master User',
        recipient_name: 'Sales Agent',
        sender_avatar_url: '',
        recipient_avatar_url: '',
      },
    });

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'message.created',
        message: expect.objectContaining({
          id: '10',
          message: 'hello',
        }),
      })
    );

    cleanup();
    expect(socketMock.close).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('does not open a websocket without a local auth token', () => {
    getLocalAuthSessionMock.mockReturnValue(null);

    const cleanup = openInternalChatRealtimeStream(vi.fn(), vi.fn());

    expect(ioMock).not.toHaveBeenCalled();
    cleanup();
  });
});
