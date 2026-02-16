import { supabase } from './supabaseService';
import {
    AICampaignOutreach,
    AICampaignFeedback,
    AIMessageTemplate,
    CreateAICampaignOutreachDTO,
    AICampaignStats,
    AIOutreachOutcome,
    AIMessageLanguage,
    AISentiment,
} from '../types';

// Cast supabase to allow querying new tables before types are regenerated
// TODO: Regenerate Supabase types after migration to remove this cast
const db = supabase as any;

// ============================================================================
// Message Templates
// ============================================================================

/**
 * Get all active message templates
 */
export async function getMessageTemplates(
    language?: AIMessageLanguage
): Promise<AIMessageTemplate[]> {
    let query = db
        .from('ai_message_templates')
        .select('*')
        .eq('is_active', true)
        .order('template_type');

    if (language) {
        query = query.eq('language', language);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching message templates:', error);
        return [];
    }

    return (data || []) as AIMessageTemplate[];
}

/**
 * Get a template by ID
 */
export async function getTemplate(id: string): Promise<AIMessageTemplate | null> {
    const { data, error } = await db
        .from('ai_message_templates')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching template:', error);
        return null;
    }

    return data as AIMessageTemplate;
}

/**
 * Render a message template with variables
 */
export function renderTemplate(
    template: string,
    variables: Record<string, string>
): string {
    let rendered = template;
    for (const [key, value] of Object.entries(variables)) {
        rendered = rendered.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    return rendered;
}

/**
 * Create a new message template
 */
export async function createTemplate(
    template: Omit<AIMessageTemplate, 'id' | 'created_at' | 'updated_at'>,
    createdBy: string
): Promise<AIMessageTemplate | null> {
    const { data, error } = await db
        .from('ai_message_templates')
        .insert({
            ...template,
            created_by: createdBy,
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating template:', error);
        return null;
    }

    return data as AIMessageTemplate;
}

/**
 * Update a message template
 */
export async function updateTemplate(
    id: string,
    updates: Partial<Omit<AIMessageTemplate, 'id' | 'created_at' | 'created_by'>>
): Promise<AIMessageTemplate | null> {
    const { data, error } = await db
        .from('ai_message_templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating template:', error);
        return null;
    }

    return data as AIMessageTemplate;
}

/**
 * Delete a message template (soft delete by setting is_active to false)
 */
export async function deleteTemplate(id: string): Promise<boolean> {
    const { error } = await db
        .from('ai_message_templates')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting template:', error);
        return false;
    }

    return true;
}

// Alias exports for naming consistency
export const createMessageTemplate = createTemplate;
export const updateMessageTemplate = updateTemplate;
export const deleteMessageTemplate = deleteTemplate;

// ============================================================================
// Campaign Outreach
// ============================================================================

/**
 * Create outreach for a campaign to multiple clients
 */
export async function createCampaignOutreach(
    dto: CreateAICampaignOutreachDTO,
    createdBy: string
): Promise<AICampaignOutreach[]> {
    // Build message content
    let messageContent = dto.custom_message || '';

    if (dto.message_template_id && !dto.custom_message) {
        const template = await getTemplate(dto.message_template_id);
        if (template) {
            messageContent = template.content;
        }
    }

    // Create outreach records for each client
    const outreachRecords = dto.client_ids.map(client_id => ({
        campaign_id: dto.campaign_id,
        client_id,
        outreach_type: dto.outreach_type,
        language: dto.language,
        message_content: messageContent,
        scheduled_at: dto.scheduled_at || new Date().toISOString(),
        status: 'pending',
        created_by: createdBy,
    }));

    const { data, error } = await db
        .from('ai_campaign_outreach')
        .insert(outreachRecords)
        .select();

    if (error) {
        console.error('Error creating campaign outreach:', error);
        return [];
    }

    return (data || []) as AICampaignOutreach[];
}

/**
 * Get outreach records for a campaign
 */
export async function getCampaignOutreach(
    campaignId: string,
    filters?: {
        status?: string;
        outcome?: string;
        limit?: number;
    }
): Promise<AICampaignOutreach[]> {
    let query = db
        .from('ai_campaign_outreach')
        .select('*, client:contacts(id, company, phone)')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false });

    if (filters?.status) {
        query = query.eq('status', filters.status);
    }
    if (filters?.outcome) {
        query = query.eq('outcome', filters.outcome);
    }
    if (filters?.limit) {
        query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching campaign outreach:', error);
        return [];
    }

    return (data || []) as AICampaignOutreach[];
}

/**
 * Update outreach status
 */
export async function updateOutreachStatus(
    outreachId: string,
    status: string,
    updates?: {
        sent_at?: string;
        error_message?: string;
        retry_count?: number;
    }
): Promise<boolean> {
    const { error } = await db
        .from('ai_campaign_outreach')
        .update({
            status,
            ...updates,
        })
        .eq('id', outreachId);

    if (error) {
        console.error('Error updating outreach status:', error);
        return false;
    }

    return true;
}

/**
 * Record outreach response
 */
export async function recordOutreachResponse(
    outreachId: string,
    response: {
        response_content: string;
        outcome: AIOutreachOutcome;
        conversation_id?: string;
    }
): Promise<boolean> {
    const { error } = await db
        .from('ai_campaign_outreach')
        .update({
            status: 'responded',
            response_received: true,
            response_content: response.response_content,
            outcome: response.outcome,
            conversation_id: response.conversation_id,
        })
        .eq('id', outreachId);

    if (error) {
        console.error('Error recording outreach response:', error);
        return false;
    }

    return true;
}

/**
 * Get pending outreach scheduled for now or earlier
 */
export async function getPendingOutreach(limit = 50): Promise<AICampaignOutreach[]> {
    const { data, error } = await db
        .from('ai_campaign_outreach')
        .select('*, client:contacts(id, company, phone), campaign:promotions(id, campaign_title)')
        .eq('status', 'pending')
        .lte('scheduled_at', new Date().toISOString())
        .order('scheduled_at')
        .limit(limit);

    if (error) {
        console.error('Error fetching pending outreach:', error);
        return [];
    }

    return (data || []) as AICampaignOutreach[];
}

// ============================================================================
// Campaign Feedback
// ============================================================================

/**
 * Log feedback from campaign interaction
 */
export async function logCampaignFeedback(
    feedback: Omit<AICampaignFeedback, 'id' | 'created_at'>
): Promise<AICampaignFeedback | null> {
    const { data, error } = await db
        .from('ai_campaign_feedback')
        .insert(feedback)
        .select()
        .single();

    if (error) {
        console.error('Error logging campaign feedback:', error);
        return null;
    }

    return data as AICampaignFeedback;
}

/**
 * Get feedback for a campaign
 */
export async function getCampaignFeedback(
    campaignId: string,
    filters?: {
        feedback_type?: string;
        sentiment?: AISentiment;
        limit?: number;
    }
): Promise<AICampaignFeedback[]> {
    let query = db
        .from('ai_campaign_feedback')
        .select('*, client:contacts(id, company)')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false });

    if (filters?.feedback_type) {
        query = query.eq('feedback_type', filters.feedback_type);
    }
    if (filters?.sentiment) {
        query = query.eq('sentiment', filters.sentiment);
    }
    if (filters?.limit) {
        query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching campaign feedback:', error);
        return [];
    }

    return (data || []) as AICampaignFeedback[];
}

/**
 * Analyze feedback to extract common objections and interests
 */
export async function analyzeCampaignFeedback(
    campaignId: string
): Promise<{
    total_feedback: number;
    sentiment_distribution: Record<AISentiment, number>;
    feedback_type_distribution: Record<string, number>;
    common_tags: Array<{ tag: string; count: number }>;
}> {
    const { data, error } = await db
        .from('ai_campaign_feedback')
        .select('feedback_type, sentiment, tags')
        .eq('campaign_id', campaignId);

    if (error || !data || data.length === 0) {
        return {
            total_feedback: 0,
            sentiment_distribution: { positive: 0, neutral: 0, negative: 0 },
            feedback_type_distribution: {},
            common_tags: [],
        };
    }

    const sentimentDist: Record<AISentiment, number> = {
        positive: 0,
        neutral: 0,
        negative: 0,
    };
    const typeDist: Record<string, number> = {};
    const tagCounts = new Map<string, number>();

    for (const row of data) {
        if (row.sentiment) {
            sentimentDist[row.sentiment as AISentiment]++;
        }
        typeDist[row.feedback_type] = (typeDist[row.feedback_type] || 0) + 1;
        if (row.tags && Array.isArray(row.tags)) {
            for (const tag of row.tags) {
                tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
            }
        }
    }

    const commonTags = Array.from(tagCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag, count]) => ({ tag, count }));

    return {
        total_feedback: data.length,
        sentiment_distribution: sentimentDist,
        feedback_type_distribution: typeDist,
        common_tags: commonTags,
    };
}

// ============================================================================
// Campaign Statistics
// ============================================================================

/**
 * Get comprehensive statistics for a campaign's AI outreach
 */
export async function getCampaignStats(campaignId: string): Promise<AICampaignStats> {
    const { data: outreachData, error: outreachError } = await db
        .from('ai_campaign_outreach')
        .select('status, outcome')
        .eq('campaign_id', campaignId);

    if (outreachError || !outreachData) {
        return {
            total_outreach: 0,
            pending_count: 0,
            sent_count: 0,
            delivered_count: 0,
            responded_count: 0,
            failed_count: 0,
            conversion_rate: 0,
            response_rate: 0,
            sentiment_breakdown: { positive: 0, neutral: 0, negative: 0 },
            outcome_breakdown: {} as Record<AIOutreachOutcome, number>,
        };
    }

    const stats = {
        total_outreach: outreachData.length,
        pending_count: 0,
        sent_count: 0,
        delivered_count: 0,
        responded_count: 0,
        failed_count: 0,
    };

    const outcomeBreakdown: Record<AIOutreachOutcome, number> = {
        interested: 0,
        not_interested: 0,
        no_response: 0,
        converted: 0,
        escalated: 0,
    };

    for (const row of outreachData) {
        switch (row.status) {
            case 'pending': stats.pending_count++; break;
            case 'sent': stats.sent_count++; break;
            case 'delivered': stats.delivered_count++; break;
            case 'responded': stats.responded_count++; break;
            case 'failed': stats.failed_count++; break;
        }
        if (row.outcome && outcomeBreakdown[row.outcome as AIOutreachOutcome] !== undefined) {
            outcomeBreakdown[row.outcome as AIOutreachOutcome]++;
        }
    }

    // Get sentiment from feedback
    const { data: feedbackData } = await db
        .from('ai_campaign_feedback')
        .select('sentiment')
        .eq('campaign_id', campaignId);

    const sentimentBreakdown = { positive: 0, neutral: 0, negative: 0 };
    if (feedbackData) {
        for (const row of feedbackData) {
            if (row.sentiment && sentimentBreakdown[row.sentiment as AISentiment] !== undefined) {
                sentimentBreakdown[row.sentiment as AISentiment]++;
            }
        }
    }

    // Calculate rates
    const deliveredTotal = stats.delivered_count + stats.responded_count;
    const responseRate = deliveredTotal > 0 ? (stats.responded_count / deliveredTotal) * 100 : 0;
    const conversionRate = stats.responded_count > 0
        ? (outcomeBreakdown.converted / stats.responded_count) * 100
        : 0;

    return {
        ...stats,
        conversion_rate: Math.round(conversionRate * 100) / 100,
        response_rate: Math.round(responseRate * 100) / 100,
        sentiment_breakdown: sentimentBreakdown,
        outcome_breakdown: outcomeBreakdown,
    };
}

// ============================================================================
// AI Agent Operations
// ============================================================================

/**
 * Generate a personalized message for a client based on template and context
 */
export async function generatePersonalizedMessage(
    clientId: string,
    campaignId: string,
    language: AIMessageLanguage,
    templateType: string = 'promo_intro'
): Promise<string | null> {
    // Get client info
    const { data: client } = await supabase
        .from('contacts')
        .select('company, name')
        .eq('id', clientId)
        .single();

    if (!client) return null;

    // Get campaign info
    const { data: campaign } = await db
        .from('promotions')
        .select('campaign_title, discount_type, discount_value')
        .eq('id', campaignId)
        .single();

    if (!campaign) return null;

    // Get template
    const templates = await getMessageTemplates(language);
    const template = templates.find(t => t.template_type === templateType);

    if (!template) return null;

    // Render with variables
    const message = renderTemplate(template.content, {
        client_name: client.name || client.company || 'Customer',
        agent_name: 'Sales Team',
        product_name: campaign.campaign_title,
        discount_percentage: String(campaign.discount_value || 0),
    });

    return message;
}

/**
 * Simulate sending an SMS (placeholder for actual SMS integration)
 */
export async function sendSMS(
    phoneNumber: string,
    message: string,
    outreachId: string
): Promise<{ success: boolean; message_id?: string; error?: string }> {
    // TODO: Integrate with actual SMS provider (e.g., Twilio, Semaphore)
    // This is a placeholder implementation

    console.log(`[AI Sales Agent] Sending SMS to ${phoneNumber}: ${message.slice(0, 50)}...`);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Update outreach status
    await updateOutreachStatus(outreachId, 'sent', {
        sent_at: new Date().toISOString(),
    });

    // For now, return success
    return {
        success: true,
        message_id: `sms_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    };
}

/**
 * Process pending outreach queue
 */
export async function processOutreachQueue(): Promise<{
    processed: number;
    successful: number;
    failed: number;
}> {
    const pending = await getPendingOutreach(20);

    let successful = 0;
    let failed = 0;

    for (const outreach of pending) {
        if (outreach.outreach_type === 'sms' && outreach.client?.phone) {
            const result = await sendSMS(
                outreach.client.phone,
                outreach.message_content || '',
                outreach.id
            );

            if (result.success) {
                successful++;
            } else {
                failed++;
                await updateOutreachStatus(outreach.id, 'failed', {
                    error_message: result.error,
                    retry_count: (outreach.retry_count || 0) + 1,
                });
            }
        }
    }

    return {
        processed: pending.length,
        successful,
        failed,
    };
}
