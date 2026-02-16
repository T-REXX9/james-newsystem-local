import { supabase } from './supabaseService';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface RecycleBinCallbacks {
  onInsert?: (item: any) => void;
  onUpdate?: (item: any) => void;
  onDelete?: (payload: { id: string }) => void;
  onError?: (error: Error) => void;
}

export function subscribeToRecycleBinItems(
  itemType?: string,
  callbacks?: RecycleBinCallbacks
): () => void {
  const channelName = `recycle_bin_items-${itemType || 'all'}-${Date.now()}`;
  const channel: RealtimeChannel = supabase.channel(channelName);

  const config: any = {
    event: '*',
    schema: 'public',
    table: 'recycle_bin_items',
  };

  if (itemType) {
    config.filter = `item_type=eq.${itemType}`;
  }

  channel
    .on('postgres_changes', config, (payload) => {
      try {
        switch (payload.eventType) {
          case 'INSERT':
            callbacks?.onInsert?.(payload.new);
            break;
          case 'UPDATE':
            callbacks?.onUpdate?.(payload.new);
            break;
          case 'DELETE':
            callbacks?.onDelete?.({ id: (payload.old as any).id });
            break;
        }
      } catch (error) {
        console.error('Error handling recycle bin event:', error);
        callbacks?.onError?.(error as Error);
      }
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

