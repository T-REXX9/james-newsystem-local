import { supabase } from '../lib/supabaseClient';
import {
    AIEscalation,
    AIEscalationWithDetails,
    AIEscalationPriority,
    AIEscalationStatus,
} from '../types';

/**
 * Fetch pending escalations (for escalation queue)
 */
export async function fetchPendingEscalations(): Promise<AIEscalationWithDetails[]> {
    const { data, error } = await supabase
        .from('ai_escalations')
        .select(`
      *,
      conversation:ai_conversations(
        *,
        contact:contacts(id, company, name, phone, mobile, city)
      ),
      assigned_agent:profiles!ai_escalations_assigned_to_fkey(id, full_name, avatar_url)
    `)
        .in('status', ['pending', 'in_progress'])
        .order('priority', { ascending: true }) // urgent first
        .order('created_at', { ascending: true }); // oldest first within priority

    if (error) {
        console.error('Error fetching pending escalations:', error);
        throw error;
    }

    // Sort by priority weight
    const priorityWeight: Record<AIEscalationPriority, number> = {
        urgent: 0,
        high: 1,
        normal: 2,
        low: 3,
    };

    return ((data || []) as unknown as AIEscalationWithDetails[]).sort((a, b) => {
        const weightA = priorityWeight[a.priority as AIEscalationPriority] ?? 2;
        const weightB = priorityWeight[b.priority as AIEscalationPriority] ?? 2;
        if (weightA !== weightB) return weightA - weightB;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
}

/**
 * Fetch all escalations with optional status filter
 */
export async function fetchEscalations(
    status?: AIEscalationStatus
): Promise<AIEscalationWithDetails[]> {
    let query = supabase
        .from('ai_escalations')
        .select(`
      *,
      conversation:ai_conversations(
        *,
        contact:contacts(id, company, name, phone, mobile)
      ),
      assigned_agent:profiles!ai_escalations_assigned_to_fkey(id, full_name, avatar_url)
    `)
        .order('created_at', { ascending: false });

    if (status) {
        query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching escalations:', error);
        throw error;
    }

    return (data || []) as unknown as AIEscalationWithDetails[];
}

/**
 * Assign an escalation to an agent
 */
export async function assignEscalation(
    escalationId: string,
    agentId: string
): Promise<AIEscalation> {
    const { data, error } = await supabase
        .from('ai_escalations')
        .update({
            assigned_to: agentId,
            status: 'in_progress',
        })
        .eq('id', escalationId)
        .select()
        .single();

    if (error) {
        console.error('Error assigning escalation:', error);
        throw error;
    }

    // Also update the conversation's assigned_agent_id
    const { data: escalation } = await supabase
        .from('ai_escalations')
        .select('conversation_id')
        .eq('id', escalationId)
        .single();

    if (escalation?.conversation_id) {
        await supabase
            .from('ai_conversations')
            .update({ assigned_agent_id: agentId })
            .eq('id', escalation.conversation_id);
    }

    return data as unknown as AIEscalation;
}

/**
 * Resolve an escalation
 */
export async function resolveEscalation(
    escalationId: string,
    resolutionNotes?: string
): Promise<AIEscalation> {
    const { data, error } = await supabase
        .from('ai_escalations')
        .update({
            status: 'resolved',
            resolved_at: new Date().toISOString(),
            resolution_notes: resolutionNotes || null,
        })
        .eq('id', escalationId)
        .select()
        .single();

    if (error) {
        console.error('Error resolving escalation:', error);
        throw error;
    }

    return data as unknown as AIEscalation;
}

/**
 * Create an escalation (for AI to call when handoff needed)
 */
export async function createEscalation(
    conversationId: string,
    reason: string,
    priority: AIEscalationPriority = 'normal'
): Promise<AIEscalation> {
    const { data, error } = await supabase
        .from('ai_escalations')
        .insert([{
            conversation_id: conversationId,
            reason,
            priority,
            status: 'pending',
        }])
        .select()
        .single();

    if (error) {
        console.error('Error creating escalation:', error);
        throw error;
    }

    // Update conversation status to escalated
    await supabase
        .from('ai_conversations')
        .update({ status: 'escalated' })
        .eq('id', conversationId);

    return data as unknown as AIEscalation;
}

/**
 * Get escalation queue count
 */
export async function getEscalationQueueCount(): Promise<number> {
    const { count, error } = await supabase
        .from('ai_escalations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

    if (error) {
        console.error('Error getting escalation queue count:', error);
        throw error;
    }

    return count || 0;
}

/**
 * Subscribe to escalation updates (real-time)
 */
export function subscribeToEscalations(
    callback: (payload: any) => void
): () => void {
    const channel = supabase
        .channel('ai_escalations_changes')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'ai_escalations',
            },
            callback
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
}
