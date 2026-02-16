import { supabase } from './supabaseService';
import { RealtimeChannel } from '@supabase/supabase-js';
import { PipelineDeal } from '../types';

export interface DealCallbacks {
  onInsert?: (deal: PipelineDeal) => void;
  onUpdate?: (deal: PipelineDeal) => void;
  onDelete?: (payload: { id: string }) => void;
  onError?: (error: Error) => void;
}

export function subscribeToDeals(callbacks: DealCallbacks): () => void {
  const channelName = `deals-realtime-${Date.now()}`;
  const channel: RealtimeChannel = supabase.channel(channelName);

  channel
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'deals',
      },
      (payload) => {
        try {
          switch (payload.eventType) {
            case 'INSERT':
              callbacks.onInsert?.(payload.new as PipelineDeal);
              break;
            case 'UPDATE':
              callbacks.onUpdate?.(payload.new as PipelineDeal);
              break;
            case 'DELETE':
              callbacks.onDelete?.({ id: (payload.old as any).id });
              break;
          }
        } catch (error) {
          console.error('Error handling deal event:', error);
          callbacks.onError?.(error as Error);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToDealsByStage(
  stageId: string,
  callbacks: DealCallbacks
): () => void {
  const channelName = `deals-stage-${stageId}-${Date.now()}`;
  const channel: RealtimeChannel = supabase.channel(channelName);

  channel
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'deals',
        filter: `stageId=eq.${stageId}`,
      },
      (payload) => {
        try {
          switch (payload.eventType) {
            case 'INSERT':
              callbacks.onInsert?.(payload.new as PipelineDeal);
              break;
            case 'UPDATE':
              callbacks.onUpdate?.(payload.new as PipelineDeal);
              break;
            case 'DELETE':
              callbacks.onDelete?.({ id: (payload.old as any).id });
              break;
          }
        } catch (error) {
          console.error('Error handling deal stage event:', error);
          callbacks.onError?.(error as Error);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
