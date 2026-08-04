import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRealtimeSubscription } from '../useRealtimeSubscription';

interface RealtimeRow {
  id: string;
  name?: string;
}

type PostgresPayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: RealtimeRow;
  old: RealtimeRow;
};

const mockState = vi.hoisted(() => {
  const state: {
    postgresChangesHandler: ((payload: PostgresPayload) => void) | null;
    subscribeStatusHandler: ((status: string) => void) | null;
  } = {
    postgresChangesHandler: null,
    subscribeStatusHandler: null,
  };

  const channel = {
    on: vi.fn(
      (
        _event: 'postgres_changes',
        _filter: Record<string, unknown>,
        callback: (payload: PostgresPayload) => void
      ) => {
        state.postgresChangesHandler = callback;
        return channel;
      }
    ),
    subscribe: vi.fn((callback: (status: string) => void) => {
      state.subscribeStatusHandler = callback;
      return channel;
    }),
  };

  return {
    state,
    channel,
    channelMock: vi.fn((_channelName: string) => channel),
    removeChannelMock: vi.fn((_channel: typeof channel) => {}),
  };
});

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    channel: mockState.channelMock,
    removeChannel: mockState.removeChannelMock,
  },
}));

describe('useRealtimeSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.state.postgresChangesHandler = null;
    mockState.state.subscribeStatusHandler = null;
  });

  it('keeps Supabase realtime disabled while the system uses the local API', async () => {
    const onInsert = vi.fn();
    const onUpdate = vi.fn();
    const onDelete = vi.fn();
    const onError = vi.fn();

    const { unmount } = renderHook(() =>
      useRealtimeSubscription<RealtimeRow>({
        tableName: 'test_table',
        callbacks: {
          onInsert,
          onUpdate,
          onDelete,
          onError,
        },
      })
    );

    await waitFor(() => expect(mockState.channelMock).not.toHaveBeenCalled());
    expect(mockState.channel.on).not.toHaveBeenCalled();
    expect(mockState.channel.subscribe).not.toHaveBeenCalled();
    expect(onInsert).not.toHaveBeenCalled();
    expect(onUpdate).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();

    unmount();
    expect(mockState.removeChannelMock).not.toHaveBeenCalled();
  });
});
