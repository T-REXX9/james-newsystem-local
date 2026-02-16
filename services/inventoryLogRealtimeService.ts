import { supabase } from './supabaseService';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface InventoryLogCallbacks {
  onInsert?: (log: any) => void;
  onUpdate?: (log: any) => void;
  onDelete?: (payload: { id: string }) => void;
  onError?: (error: Error) => void;
}

/**
 * Subscribe to inventory logs table changes
 * Optionally filter by item_id and/or warehouse_id
 */
export function subscribeToInventoryLogs(
  itemId?: string,
  warehouseId?: string,
  callbacks: InventoryLogCallbacks = {}
): () => void {
  const channelName = `inventory_logs-${itemId || 'all'}-${warehouseId || 'all'}-${Date.now()}`;
  const channel: RealtimeChannel = supabase.channel(channelName);

  const config: any = {
    event: '*',
    schema: 'public',
    table: 'inventory_logs',
  };

  // Build filter string if filters are provided
  const filters: string[] = [];
  if (itemId) {
    filters.push(`item_id=eq.${itemId}`);
  }
  if (warehouseId) {
    filters.push(`warehouse_id=eq.${warehouseId}`);
  }

  if (filters.length > 0) {
    config.filter = filters.join('&');
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
        console.error('Error handling inventory log event:', error);
        callbacks.onError?.(error as Error);
      }
    })
    .subscribe();

  // Return cleanup function
  return () => {
    supabase.removeChannel(channel);
  };
}
