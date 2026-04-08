import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openInternalChatRealtimeStream } from '../internalChatRealtimeService';

const getLocalAuthSessionMock = vi.fn();

vi.mock('../localAuthService', () => ({
  getLocalAuthSession: () => getLocalAuthSessionMock(),
}));

class MockEventSource {
  static lastInstance: MockEventSource | null = null;

  public readonly url: string;
  public onerror: (() => void) | null = null;
  private readonly listeners = new Map<string, Set<EventListener>>();

  constructor(url: string) {
    this.url = url;
    MockEventSource.lastInstance = this;
  }

  addEventListener(type: string, listener: EventListener) {
    const bucket = this.listeners.get(type) || new Set<EventListener>();
    bucket.add(listener);
    this.listeners.set(type, bucket);
  }

  removeEventListener(type: string, listener: EventListener) {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string, data: string) {
    const event = new MessageEvent(type, { data });
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }

  close() {
    // noop
  }
}

describe('internalChatRealtimeService', () => {
  const originalEventSource = globalThis.EventSource;

  beforeEach(() => {
    getLocalAuthSessionMock.mockReset();
    MockEventSource.lastInstance = null;
    Object.defineProperty(globalThis, 'EventSource', {
      configurable: true,
      writable: true,
      value: MockEventSource,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'EventSource', {
      configurable: true,
      writable: true,
      value: originalEventSource,
    });
  });

  it('opens a stream with the local auth token and forwards chat updates', () => {
    getLocalAuthSessionMock.mockReturnValue({
      token: 'abc123',
    });

    const onState = vi.fn();
    const onError = vi.fn();
    const cleanup = openInternalChatRealtimeStream(onState, onError);

    expect(MockEventSource.lastInstance).not.toBeNull();
    expect(MockEventSource.lastInstance?.url).toContain('/api/v1/internal-chat/stream');
    expect(MockEventSource.lastInstance?.url).toContain('token=abc123');

    MockEventSource.lastInstance?.emit(
      'chat_state',
      JSON.stringify({
        latest_message_id: '10',
        latest_message_at: '2026-04-08 23:00:00',
        latest_message_preview: 'hello',
        latest_conversation_key: 'dm:1:2',
        latest_sender_id: '1',
        latest_sender_name: 'Master User',
        latest_alert_id: '4',
        unread_count: '2',
      })
    );

    expect(onState).toHaveBeenCalledWith(
      expect.objectContaining({
        latest_message_id: '10',
        latest_message_preview: 'hello',
        unread_count: 2,
      })
    );

    cleanup();
    expect(onError).not.toHaveBeenCalled();
  });

  it('does not open a stream without a local auth token', () => {
    getLocalAuthSessionMock.mockReturnValue(null);

    const cleanup = openInternalChatRealtimeStream(vi.fn(), vi.fn());

    expect(MockEventSource.lastInstance).toBeNull();
    cleanup();
  });
});
