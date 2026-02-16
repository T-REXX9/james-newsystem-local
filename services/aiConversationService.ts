import { supabase } from '../lib/supabaseClient';
import {
    AIConversation,
    AIConversationMessage,
    AIConversationFilters,
    AIConversationStatus,
    AIDashboardStats,
} from '../types';

/**
 * Fetch AI conversations with optional filters
 */
export async function fetchAIConversations(
    filters?: AIConversationFilters
): Promise<AIConversation[]> {
    let query = supabase
        .from('ai_conversations')
        .select(`
      *,
      contact:contacts(id, company, name, phone, mobile, status),
      assigned_agent:profiles!ai_conversations_assigned_agent_id_fkey(id, full_name, avatar_url)
    `)
        .order('started_at', { ascending: false });

    if (filters?.status) {
        query = query.eq('status', filters.status);
    }
    if (filters?.purpose) {
        query = query.eq('purpose', filters.purpose);
    }
    if (filters?.contact_id) {
        query = query.eq('contact_id', filters.contact_id);
    }
    if (filters?.date_from) {
        query = query.gte('started_at', filters.date_from);
    }
    if (filters?.date_to) {
        query = query.lte('started_at', filters.date_to);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching AI conversations:', error);
        throw error;
    }

    return (data || []) as unknown as AIConversation[];
}

/**
 * Fetch a single conversation with messages
 */
export async function fetchAIConversation(id: string): Promise<AIConversation | null> {
    const { data: conversation, error: convError } = await supabase
        .from('ai_conversations')
        .select(`
      *,
      contact:contacts(id, company, name, phone, mobile, status, city, province),
      assigned_agent:profiles!ai_conversations_assigned_agent_id_fkey(id, full_name, avatar_url)
    `)
        .eq('id', id)
        .single();

    if (convError) {
        console.error('Error fetching AI conversation:', convError);
        throw convError;
    }

    if (!conversation) return null;

    // Fetch messages for this conversation
    const { data: messages, error: msgError } = await supabase
        .from('ai_conversation_messages')
        .select('*')
        .eq('conversation_id', id)
        .order('timestamp', { ascending: true });

    if (msgError) {
        console.error('Error fetching conversation messages:', msgError);
        throw msgError;
    }

    return {
        ...(conversation as unknown as AIConversation),
        messages: (messages || []) as unknown as AIConversationMessage[],
    };
}

/**
 * Fetch messages for a conversation
 */
export async function fetchConversationMessages(
    conversationId: string
): Promise<AIConversationMessage[]> {
    const { data, error } = await supabase
        .from('ai_conversation_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('timestamp', { ascending: true });

    if (error) {
        console.error('Error fetching conversation messages:', error);
        throw error;
    }

    return (data || []) as unknown as AIConversationMessage[];
}

/**
 * Update conversation status
 */
export async function updateConversationStatus(
    id: string,
    status: AIConversationStatus,
    additionalUpdates?: {
        outcome?: string;
        sentiment?: string;
        summary?: string;
        ended_at?: string;
        assigned_agent_id?: string;
    }
): Promise<AIConversation> {
    const updates: Record<string, any> = { status };

    if (additionalUpdates) {
        Object.assign(updates, additionalUpdates);
    }

    // Calculate duration if ending the conversation
    if (status === 'completed' || status === 'escalated' || status === 'abandoned') {
        if (!updates.ended_at) {
            updates.ended_at = new Date().toISOString();
        }
    }

    const { data, error } = await supabase
        .from('ai_conversations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating conversation status:', error);
        throw error;
    }

    return data as unknown as AIConversation;
}

/**
 * Get dashboard statistics
 */
export async function fetchAIDashboardStats(): Promise<AIDashboardStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    // Fetch active conversations
    const { count: activeCount } = await supabase
        .from('ai_conversations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

    // Fetch today's conversations
    const { count: todayCount } = await supabase
        .from('ai_conversations')
        .select('*', { count: 'exact', head: true })
        .gte('started_at', todayIso);

    // Fetch escalated vs total for rate
    const { count: escalatedCount } = await supabase
        .from('ai_conversations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'escalated')
        .gte('started_at', todayIso);

    // Fetch sentiment breakdown (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const { data: sentimentData } = await supabase
        .from('ai_conversations')
        .select('sentiment')
        .gte('started_at', weekAgo.toISOString())
        .not('sentiment', 'is', null);

    const sentimentBreakdown = { positive: 0, neutral: 0, negative: 0 };
    ((sentimentData as any[]) || []).forEach(s => {
        if (s.sentiment && sentimentBreakdown.hasOwnProperty(s.sentiment)) {
            sentimentBreakdown[s.sentiment as keyof typeof sentimentBreakdown]++;
        }
    });

    // Fetch purpose breakdown (last 7 days)
    const { data: purposeData } = await supabase
        .from('ai_conversations')
        .select('purpose')
        .gte('started_at', weekAgo.toISOString());

    const purposeBreakdown: Record<string, number> = {
        lead_gen: 0,
        inquiry: 0,
        complaint: 0,
        delivery: 0,
        sales: 0,
    };
    ((purposeData as any[]) || []).forEach(p => {
        if (p.purpose && purposeBreakdown.hasOwnProperty(p.purpose)) {
            purposeBreakdown[p.purpose]++;
        }
    });

    const escalationRate = todayCount && todayCount > 0
        ? ((escalatedCount || 0) / todayCount) * 100
        : 0;

    return {
        active_conversations: activeCount || 0,
        today_conversations: todayCount || 0,
        escalation_rate: Math.round(escalationRate * 10) / 10,
        avg_response_time_seconds: 0, // Will be calculated when AI is integrated
        sentiment_breakdown: sentimentBreakdown,
        purpose_breakdown: purposeBreakdown as any,
    };
}

/**
 * Subscribe to conversation updates (real-time)
 */
export function subscribeToAIConversations(
    callback: (payload: any) => void
): () => void {
    const channel = supabase
        .channel('ai_conversations_changes')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'ai_conversations',
            },
            callback
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
}
