import { supabase } from './supabaseService';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface InvoiceCallbacks {
  onInsert?: (invoice: any) => void;
  onUpdate?: (invoice: any) => void;
  onDelete?: (payload: { id: string }) => void;
  onError?: (error: Error) => void;
}

export interface InvoiceItemCallbacks {
  onInsert?: (item: any) => void;
  onUpdate?: (item: any) => void;
  onDelete?: (payload: { id: string }) => void;
  onError?: (error: Error) => void;
}

export function subscribeToInvoices(callbacks: InvoiceCallbacks): () => void {
  const channelName = `invoices-realtime-${Date.now()}`;
  const channel: RealtimeChannel = supabase.channel(channelName);

  channel
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'invoices',
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
          console.error('Error handling invoice event:', error);
          callbacks.onError?.(error as Error);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToInvoiceItems(
  invoiceId: string | null,
  callbacks: InvoiceItemCallbacks
): () => void {
  const channelName = `invoice_items-${invoiceId || 'all'}-${Date.now()}`;
  const channel: RealtimeChannel = supabase.channel(channelName);

  const config: any = {
    event: '*',
    schema: 'public',
    table: 'invoice_items',
  };

  if (invoiceId) {
    config.filter = `invoice_id=eq.${invoiceId}`;
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
        console.error('Error handling invoice item event:', error);
        callbacks.onError?.(error as Error);
      }
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

