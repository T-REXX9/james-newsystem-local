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

  it('creates a realtime channel and routes insert/update/delete callbacks', async () => {
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

    await waitFor(() => {
      expect(mockState.channelMock).toHaveBeenCalledTimes(1);
    });

    expect(mockState.channelMock.mock.calls[0]?.[0]).toMatch(/^test_table-realtime-/);
    expect(mockState.channel.on).toHaveBeenCalledTimes(1);
    expect(mockState.channel.subscribe).toHaveBeenCalledTimes(1);

    mockState.state.subscribeStatusHandler?.('SUBSCRIBED');

    mockState.state.postgresChangesHandler?.({
      eventType: 'INSERT',
      new: { id: '1', name: 'Created' },
      old: { id: '1' },
    });
    mockState.state.postgresChangesHandler?.({
      eventType: 'UPDATE',
      new: { id: '1', name: 'Updated' },
      old: { id: '1' },
    });
    mockState.state.postgresChangesHandler?.({
      eventType: 'DELETE',
      new: { id: '1' },
      old: { id: '1' },
    });

    expect(onInsert).toHaveBeenCalledWith({ id: '1', name: 'Created' });
    expect(onUpdate).toHaveBeenCalledWith({ id: '1', name: 'Updated' });
    expect(onDelete).toHaveBeenCalledWith({ id: '1' });
    expect(onError).not.toHaveBeenCalled();

    unmount();
    expect(mockState.removeChannelMock).toHaveBeenCalledTimes(1);
  });
});
