import { supabase } from './supabaseService';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface SalesInquiryCallbacks {
  onInsert?: (inquiry: any) => void;
  onUpdate?: (inquiry: any) => void;
  onDelete?: (payload: { id: string }) => void;
  onError?: (error: Error) => void;
}

export interface SalesInquiryItemCallbacks {
  onInsert?: (item: any) => void;
  onUpdate?: (item: any) => void;
  onDelete?: (payload: { id: string }) => void;
  onError?: (error: Error) => void;
}

export function subscribeToSalesInquiries(callbacks: SalesInquiryCallbacks): () => void {
  const channelName = `sales_inquiries-realtime-${Date.now()}`;
  const channel: RealtimeChannel = supabase.channel(channelName);

  channel
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'sales_inquiries',
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
          console.error('Error handling sales inquiry event:', error);
          callbacks.onError?.(error as Error);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToSalesInquiryItems(
  inquiryId: string | null,
  callbacks: SalesInquiryItemCallbacks
): () => void {
  const channelName = `sales_inquiry_items-${inquiryId || 'all'}-${Date.now()}`;
  const channel: RealtimeChannel = supabase.channel(channelName);

  const config: any = {
    event: '*',
    schema: 'public',
    table: 'sales_inquiry_items',
  };

  if (inquiryId) {
    config.filter = `sales_inquiry_id=eq.${inquiryId}`;
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
        console.error('Error handling sales inquiry item event:', error);
        callbacks.onError?.(error as Error);
      }
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

