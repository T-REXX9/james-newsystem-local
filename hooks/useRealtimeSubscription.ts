import { useEffect, useRef } from 'react';

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
  callbacks,
  enabled = true,
}: UseRealtimeSubscriptionOptions<T>) {
  const callbacksRef = useRef<RealtimeCallbacks<T>>(callbacks);

  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  useEffect(() => {
    if (!enabled) return;
    // Local API mode: Supabase realtime is intentionally disabled.
  }, [enabled]);

  return {
    channel: null,
  };
}
