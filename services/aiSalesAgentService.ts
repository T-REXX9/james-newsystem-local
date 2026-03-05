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

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';

const buildApiUrl = (path: string): string =>
    `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

// ============================================================================
// Message Templates
// ============================================================================

/**
 * Get all active message templates
 */
export async function getMessageTemplates(
    language?: AIMessageLanguage
): Promise<AIMessageTemplate[]> {
    try {
        const params = new URLSearchParams({
            page: '1',
            per_page: '100',
        });

        if (language) {
            params.append('language', language);
        }

        const response = await fetch(buildApiUrl(`/message-templates?${params}`));
        if (!response.ok) {
            console.error('Error fetching message templates:', response.statusText);
            return [];
        }

        const result = await response.json();
        return (result.data || []) as AIMessageTemplate[];
    } catch (error) {
        console.error('Error fetching message templates:', error);
        return [];
    }
}

/**
 * Get a template by ID
 */
export async function getTemplate(id: string): Promise<AIMessageTemplate | null> {
    try {
        const response = await fetch(buildApiUrl(`/message-templates/${encodeURIComponent(id)}`));

        if (response.status === 404) {
            return null;
        }

        if (!response.ok) {
            console.error('Error fetching template:', response.statusText);
            return null;
        }

        const result = await response.json();
        return (result.data || null) as AIMessageTemplate | null;
    } catch (error) {
        console.error('Error fetching template:', error);
        return null;
    }
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
    try {
        const response = await fetch(buildApiUrl('/message-templates'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...template,
                created_by: createdBy,
            }),
        });

        if (!response.ok) {
            console.error('Error creating template:', response.statusText);
            return null;
        }

        const result = await response.json();
        return (result.data || null) as AIMessageTemplate | null;
    } catch (error) {
        console.error('Error creating template:', error);
        return null;
    }
}

/**
 * Update a message template
 */
export async function updateTemplate(
    id: string,
    updates: Partial<Omit<AIMessageTemplate, 'id' | 'created_at' | 'created_by'>>
): Promise<AIMessageTemplate | null> {
    try {
        const response = await fetch(buildApiUrl(`/message-templates/${encodeURIComponent(id)}`), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
        });

        if (response.status === 404) {
            return null;
        }

        if (!response.ok) {
            console.error('Error updating template:', response.statusText);
            return null;
        }

        const result = await response.json();
        return (result.data || null) as AIMessageTemplate | null;
    } catch (error) {
        console.error('Error updating template:', error);
        return null;
    }
}

/**
 * Delete a message template (soft delete by setting is_active to false)
 */
export async function deleteTemplate(id: string): Promise<boolean> {
    try {
        const response = await fetch(buildApiUrl(`/message-templates/${encodeURIComponent(id)}`), {
            method: 'DELETE',
        });

        if (response.status === 404) {
            return false;
        }

        return response.ok;
    } catch (error) {
        console.error('Error deleting template:', error);
        return false;
    }
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
    try {
        // Build message content
        let messageContent = dto.custom_message || '';

        if (dto.message_template_id && !dto.custom_message) {
            const template = await getTemplate(dto.message_template_id);
            if (template) {
                messageContent = template.content;
            }
        }

        // Create outreach records for each client
        const records = dto.client_ids.map(client_id => ({
            campaign_id: dto.campaign_id,
            client_id,
            outreach_type: dto.outreach_type,
            language: dto.language,
            message_content: messageContent,
            scheduled_at: dto.scheduled_at || new Date().toISOString(),
            status: 'pending',
            created_by: createdBy,
        }));

        const response = await fetch(buildApiUrl(`/campaigns/${encodeURIComponent(dto.campaign_id)}/outreach`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ records }),
        });

        if (!response.ok) {
            console.error('Error creating campaign outreach:', response.statusText);
            return [];
        }

        const result = await response.json();
        return (result.records || []) as AICampaignOutreach[];
    } catch (error) {
        console.error('Error creating campaign outreach:', error);
        return [];
    }
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
    try {
        const params = new URLSearchParams({
            page: '1',
            per_page: String(filters?.limit || 50),
        });

        if (filters?.status) {
            params.append('status', filters.status);
        }
        if (filters?.outcome) {
            params.append('outcome', filters.outcome);
        }

        const response = await fetch(
            buildApiUrl(`/campaigns/${encodeURIComponent(campaignId)}/outreach?${params}`)
        );

        if (!response.ok) {
            console.error('Error fetching campaign outreach:', response.statusText);
            return [];
        }

        const result = await response.json();
        return (result.data || []) as AICampaignOutreach[];
    } catch (error) {
        console.error('Error fetching campaign outreach:', error);
        return [];
    }
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
    try {
        const response = await fetch(buildApiUrl(`/outreach/${encodeURIComponent(outreachId)}`), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status,
                ...updates,
            }),
        });

        return response.ok;
    } catch (error) {
        console.error('Error updating outreach status:', error);
        return false;
    }
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
    try {
        const fetchResponse = await fetch(buildApiUrl(`/outreach/${encodeURIComponent(outreachId)}/response`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(response),
        });

        return fetchResponse.ok;
    } catch (error) {
        console.error('Error recording outreach response:', error);
        return false;
    }
}

/**
 * Get pending outreach scheduled for now or earlier
 */
export async function getPendingOutreach(limit = 50): Promise<AICampaignOutreach[]> {
    try {
        const response = await fetch(buildApiUrl(`/outreach/pending?limit=${limit}`));

        if (!response.ok) {
            console.error('Error fetching pending outreach:', response.statusText);
            return [];
        }

        const result = await response.json();
        return (result.data || []) as AICampaignOutreach[];
    } catch (error) {
        console.error('Error fetching pending outreach:', error);
        return [];
    }
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
    try {
        const campaignId = feedback.campaign_id;
        const response = await fetch(buildApiUrl(`/campaigns/${encodeURIComponent(campaignId)}/feedback`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(feedback),
        });

        if (!response.ok) {
            console.error('Error logging campaign feedback:', response.statusText);
            return null;
        }

        const result = await response.json();
        return (result.data || null) as AICampaignFeedback | null;
    } catch (error) {
        console.error('Error logging campaign feedback:', error);
        return null;
    }
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
    try {
        const params = new URLSearchParams({
            page: '1',
            per_page: String(filters?.limit || 50),
        });

        if (filters?.feedback_type) {
            params.append('feedback_type', filters.feedback_type);
        }
        if (filters?.sentiment) {
            params.append('sentiment', filters.sentiment);
        }

        const response = await fetch(
            buildApiUrl(`/campaigns/${encodeURIComponent(campaignId)}/feedback?${params}`)
        );

        if (!response.ok) {
            console.error('Error fetching campaign feedback:', response.statusText);
            return [];
        }

        const result = await response.json();
        return (result.data || []) as AICampaignFeedback[];
    } catch (error) {
        console.error('Error fetching campaign feedback:', error);
        return [];
    }
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
    try {
        const response = await fetch(buildApiUrl(`/campaigns/${encodeURIComponent(campaignId)}/feedback/analysis`));

        if (!response.ok) {
            console.error('Error analyzing campaign feedback:', response.statusText);
            return {
                total_feedback: 0,
                sentiment_distribution: { positive: 0, neutral: 0, negative: 0 },
                feedback_type_distribution: {},
                common_tags: [],
            };
        }

        return await response.json();
    } catch (error) {
        console.error('Error analyzing campaign feedback:', error);
        return {
            total_feedback: 0,
            sentiment_distribution: { positive: 0, neutral: 0, negative: 0 },
            feedback_type_distribution: {},
            common_tags: [],
        };
    }
}

// ============================================================================
// Campaign Statistics
// ============================================================================

/**
 * Get comprehensive statistics for a campaign's AI outreach
 */
export async function getCampaignStats(campaignId: string): Promise<AICampaignStats> {
    try {
        const response = await fetch(buildApiUrl(`/campaigns/${encodeURIComponent(campaignId)}/stats`));

        if (!response.ok) {
            console.error('Error fetching campaign stats:', response.statusText);
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

        return await response.json() as AICampaignStats;
    } catch (error) {
        console.error('Error fetching campaign stats:', error);
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
}

// ============================================================================
// AI Agent Operations
// ============================================================================

/**
 * Generate a personalized message for a client based on template and context
 * Note: This now requires fetching client and campaign data separately
 */
export async function generatePersonalizedMessage(
    clientId: string,
    campaignId: string,
    language: AIMessageLanguage,
    templateType: string = 'promo_intro'
): Promise<string | null> {
    try {
        // Get template
        const templates = await getMessageTemplates(language);
        const template = templates.find(t => t.template_type === templateType);

        if (!template) return null;

        // For now, render with placeholder values
        // TODO: Fetch client and campaign data from respective APIs if needed
        const message = renderTemplate(template.content, {
            client_name: 'Customer',
            agent_name: 'Sales Team',
            product_name: 'Product',
            discount_percentage: '0',
        });

        return message;
    } catch (error) {
        console.error('Error generating personalized message:', error);
        return null;
    }
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
    try {
        const response = await fetch(buildApiUrl('/outreach/queue/process'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ limit: 20 }),
        });

        if (!response.ok) {
            console.error('Error processing outreach queue:', response.statusText);
            return {
                processed: 0,
                successful: 0,
                failed: 0,
            };
        }

        return await response.json();
    } catch (error) {
        console.error('Error processing outreach queue:', error);
        return {
            processed: 0,
            successful: 0,
            failed: 0,
        };
    }
}
