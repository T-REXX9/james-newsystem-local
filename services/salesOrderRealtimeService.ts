import { supabase } from './supabaseService';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface SalesOrderCallbacks {
  onInsert?: (order: any) => void;
  onUpdate?: (order: any) => void;
  onDelete?: (payload: { id: string }) => void;
  onError?: (error: Error) => void;
}

export interface SalesOrderItemCallbacks {
  onInsert?: (item: any) => void;
  onUpdate?: (item: any) => void;
  onDelete?: (payload: { id: string }) => void;
  onError?: (error: Error) => void;
}

export function subscribeToSalesOrders(callbacks: SalesOrderCallbacks): () => void {
  const channelName = `sales_orders-realtime-${Date.now()}`;
  const channel: RealtimeChannel = supabase.channel(channelName);

  channel
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'sales_orders',
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
          console.error('Error handling sales order event:', error);
          callbacks.onError?.(error as Error);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToSalesOrderItems(
  orderId: string | null,
  callbacks: SalesOrderItemCallbacks
): () => void {
  const channelName = `sales_order_items-${orderId || 'all'}-${Date.now()}`;
  const channel: RealtimeChannel = supabase.channel(channelName);

  const config: any = {
    event: '*',
    schema: 'public',
    table: 'sales_order_items',
  };

  if (orderId) {
    config.filter = `sales_order_id=eq.${orderId}`;
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
        console.error('Error handling sales order item event:', error);
        callbacks.onError?.(error as Error);
      }
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

