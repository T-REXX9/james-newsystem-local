import { supabase } from './supabaseService';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface OrderSlipCallbacks {
  onInsert?: (slip: any) => void;
  onUpdate?: (slip: any) => void;
  onDelete?: (payload: { id: string }) => void;
  onError?: (error: Error) => void;
}

export interface OrderSlipItemCallbacks {
  onInsert?: (item: any) => void;
  onUpdate?: (item: any) => void;
  onDelete?: (payload: { id: string }) => void;
  onError?: (error: Error) => void;
}

export function subscribeToOrderSlips(callbacks: OrderSlipCallbacks): () => void {
  const channelName = `order_slips-realtime-${Date.now()}`;
  const channel: RealtimeChannel = supabase.channel(channelName);

  channel
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'order_slips',
      },
      (payload) => {
        try {
          switch (payload.eventType) {
            case 'INSERT':
              callbacks.onInsert?.(payload.new);
              break;
            case 'UPDATE':
              callbacks.onUpdate?.(payload.new);
              break;
            case 'DELETE':
              callbacks.onDelete?.({ id: (payload.old as any).id });
              break;
          }
        } catch (error) {
          console.error('Error handling order slip event:', error);
          callbacks.onError?.(error as Error);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToOrderSlipItems(
  slipId: string | null,
  callbacks: OrderSlipItemCallbacks
): () => void {
  const channelName = `order_slip_items-${slipId || 'all'}-${Date.now()}`;
  const channel: RealtimeChannel = supabase.channel(channelName);

  const config: any = {
    event: '*',
    schema: 'public',
    table: 'order_slip_items',
  };

  if (slipId) {
    config.filter = `order_slip_id=eq.${slipId}`;
  }

  channel
    .on('postgres_changes', config, (payload) => {
      try {
        switch (payload.eventType) {
          case 'INSERT':
            callbacks.onInsert?.(payload.new);
            break;
          case 'UPDATE':
            callbacks.onUpdate?.(payload.new);
            break;
          case 'DELETE':
            callbacks.onDelete?.({ id: (payload.old as any).id });
            break;
        }
      } catch (error) {
        console.error('Error handling order slip item event:', error);
        callbacks.onError?.(error as Error);
      }
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

