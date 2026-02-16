import { useEffect, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

export interface RealtimeCallbacks<T = any> {
  onInsert?: (payload: T) => void;
  onUpdate?: (payload: T) => void;
  onDelete?: (payload: { id: string }) => void;
  onError?: (error: Error) => void;
}

export interface UseRealtimeSubscriptionOptions<T = any> {
  tableName: string;
  filter?: string;
  callbacks: RealtimeCallbacks<T>;
  enabled?: boolean;
}

export function useRealtimeSubscription<T = any>({
  tableName,
  filter,
  callbacks,
  enabled = true,
}: UseRealtimeSubscriptionOptions<T>) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const callbacksRef = useRef<RealtimeCallbacks<T>>(callbacks);
  const retryCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const instanceIdRef = useRef<string>(`${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const maxRetries = 5;

  // Keep latest callbacks without forcing a resubscription.
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  useEffect(() => {
    if (!enabled) return;

    let isCancelled = false;

    const clearReconnectTimer = () => {
      if (reconnectTimeoutRef.current !== null) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    const teardown = () => {
      clearReconnectTimer();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };

    const handleReconnect = () => {
      if (isCancelled) return;

      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
        clearReconnectTimer();
        reconnectTimeoutRef.current = window.setTimeout(() => {
          if (!isCancelled) setupSubscription();
        }, delay);
      } else {
        callbacksRef.current.onError?.(
          new Error(`Failed to subscribe to ${tableName} after ${maxRetries} attempts`)
        );
      }
    };

    const setupSubscription = () => {
      if (isCancelled) return;

      try {
        // Ensure we don't leak multiple channels (reconnects, re-renders, strict-mode).
        teardown();

        // Stable per-hook-instance channel name (helps debugging, avoids infinite unique channels).
        const channelName = `${tableName}-realtime-${instanceIdRef.current}`;
        const channel = supabase.channel(channelName);

        channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: tableName,
            ...(filter && { filter }),
          },
          (payload: any) => {
            try {
              switch (payload.eventType) {
                case 'INSERT':
                  callbacksRef.current.onInsert?.(payload.new as T);
                  break;
                case 'UPDATE':
                  callbacksRef.current.onUpdate?.(payload.new as T);
                  break;
                case 'DELETE':
                  callbacksRef.current.onDelete?.({ id: (payload.old as any).id });
                  break;
              }
              retryCountRef.current = 0;
            } catch (error) {
              console.error(`Error handling ${payload.eventType} event:`, error);
              callbacksRef.current.onError?.(error as Error);
            }
          }
        );

        channel.subscribe((status) => {
          if (isCancelled) return;

          if (status === 'SUBSCRIBED') {
            // Keep this as debug signal, but avoid spamming in reconnect loops.
            retryCountRef.current = 0;
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            handleReconnect();
          }
        });

        channelRef.current = channel;
      } catch (error) {
        console.error(`Error setting up subscription for ${tableName}:`, error);
        callbacksRef.current.onError?.(error as Error);
        handleReconnect();
      }
    };

    setupSubscription();

    return () => {
      isCancelled = true;
      teardown();
    };
  }, [tableName, filter, enabled]);

  return {
    channel: channelRef.current,
  };
}
