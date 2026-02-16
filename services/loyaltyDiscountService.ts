import { supabase } from './supabaseService';
import {
    LoyaltyDiscountRule,
    ClientMonthlyPurchase,
    ClientDiscountEligibility,
    DiscountUsageLog,
    CreateLoyaltyDiscountRuleDTO,
    UpdateLoyaltyDiscountRuleDTO,
    LoyaltyDiscountStats,
    ClientActiveDiscount,
} from '../types';

// Cast supabase to allow querying new tables before types are regenerated
// TODO: Regenerate Supabase types after migration to remove this cast
const db = supabase as any;

// ============================================================================
// Loyalty Discount Rules CRUD
// ============================================================================

/**
 * Create a new loyalty discount rule
 */
export async function createRule(
    dto: CreateLoyaltyDiscountRuleDTO,
    createdBy: string
): Promise<LoyaltyDiscountRule | null> {
    const { data, error } = await db
        .from('loyalty_discount_rules')
        .insert({
            name: dto.name,
            description: dto.description,
            min_purchase_amount: dto.min_purchase_amount,
            discount_percentage: dto.discount_percentage,
            evaluation_period: dto.evaluation_period || 'calendar_month',
            priority: dto.priority || 0,
            created_by: createdBy,
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating loyalty discount rule:', error);
        return null;
    }

    return data as LoyaltyDiscountRule;
}

/**
 * Get all loyalty discount rules
 */
export async function getAllRules(
    includeInactive = false
): Promise<LoyaltyDiscountRule[]> {
    let query = db
        .from('loyalty_discount_rules')
        .select('*')
        .eq('is_deleted', false)
        .order('priority', { ascending: false });

    if (!includeInactive) {
        query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching loyalty discount rules:', error);
        return [];
    }

    return (data || []) as LoyaltyDiscountRule[];
}

/**
 * Get a single rule by ID
 */
export async function getRule(id: string): Promise<LoyaltyDiscountRule | null> {
    const { data, error } = await db
        .from('loyalty_discount_rules')
        .select('*')
        .eq('id', id)
        .eq('is_deleted', false)
        .single();

    if (error) {
        console.error('Error fetching loyalty discount rule:', error);
        return null;
    }

    return data as LoyaltyDiscountRule;
}

/**
 * Update a loyalty discount rule
 */
export async function updateRule(
    id: string,
    updates: UpdateLoyaltyDiscountRuleDTO
): Promise<LoyaltyDiscountRule | null> {
    const { data, error } = await db
        .from('loyalty_discount_rules')
        .update(updates)
        .eq('id', id)
        .eq('is_deleted', false)
        .select()
        .single();

    if (error) {
        console.error('Error updating loyalty discount rule:', error);
        return null;
    }

    return data as LoyaltyDiscountRule;
}

/**
 * Soft delete a loyalty discount rule
 */
export async function deleteRule(id: string): Promise<boolean> {
    const { error } = await db
        .from('loyalty_discount_rules')
        .update({
            is_deleted: true,
            deleted_at: new Date().toISOString(),
            is_active: false,
        })
        .eq('id', id);

    if (error) {
        console.error('Error deleting loyalty discount rule:', error);
        return false;
    }

    return true;
}

// ============================================================================
// Client Monthly Purchase Tracking
// ============================================================================

/**
 * Get a client's monthly purchase total for a specific month
 */
export async function getClientMonthlyPurchase(
    clientId: string,
    yearMonth: string
): Promise<ClientMonthlyPurchase | null> {
    const { data, error } = await db
        .from('client_monthly_purchases')
        .select('*')
        .eq('client_id', clientId)
        .eq('year_month', yearMonth)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error('Error fetching client monthly purchase:', error);
        return null;
    }

    return data as ClientMonthlyPurchase | null;
}

/**
 * Get a client's purchase history for the last N months
 */
export async function getClientPurchaseHistory(
    clientId: string,
    months = 6
): Promise<ClientMonthlyPurchase[]> {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    const startMonth = startDate.toISOString().slice(0, 7); // 'YYYY-MM'

    const { data, error } = await db
        .from('client_monthly_purchases')
        .select('*')
        .eq('client_id', clientId)
        .gte('year_month', startMonth)
        .order('year_month', { ascending: false });

    if (error) {
        console.error('Error fetching client purchase history:', error);
        return [];
    }

    return (data || []) as ClientMonthlyPurchase[];
}

/**
 * Update client monthly purchase (called when an order is finalized)
 */
export async function recordClientPurchase(
    clientId: string,
    amount: number,
    orderDate: Date = new Date()
): Promise<boolean> {
    const { error } = await db.rpc('update_client_monthly_purchase', {
        p_client_id: clientId,
        p_amount: amount,
        p_order_date: orderDate.toISOString(),
    });

    if (error) {
        console.error('Error recording client purchase:', error);
        return false;
    }

    return true;
}

/**
 * Get top clients by monthly spending
 */
export async function getTopClientsBySpending(
    yearMonth: string,
    limit = 10
): Promise<ClientMonthlyPurchase[]> {
    const { data, error } = await db
        .from('client_monthly_purchases')
        .select('*, client:contacts(id, company)')
        .eq('year_month', yearMonth)
        .order('total_amount', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error fetching top clients:', error);
        return [];
    }

    return (data || []) as ClientMonthlyPurchase[];
}

// ============================================================================
// Discount Eligibility
// ============================================================================

/**
 * Get a client's active discount (if any)
 */
export async function getClientActiveDiscount(
    clientId: string
): Promise<ClientActiveDiscount | null> {
    const { data, error } = await db.rpc('get_client_active_discount', {
        p_client_id: clientId,
    });

    if (error) {
        console.error('Error getting client active discount:', error);
        return null;
    }

    if (!data || (Array.isArray(data) && data.length === 0)) {
        return null;
    }

    return Array.isArray(data) ? data[0] as ClientActiveDiscount : data as ClientActiveDiscount;
}

/**
 * Get all eligible clients for the current month
 */
export async function getEligibleClientsThisMonth(): Promise<ClientDiscountEligibility[]> {
    const currentMonth = new Date().toISOString().slice(0, 7);

    const { data, error } = await db
        .from('client_discount_eligibility')
        .select(`
            *,
            client:contacts(id, company),
            rule:loyalty_discount_rules(id, name, min_purchase_amount)
        `)
        .eq('eligible_month', currentMonth)
        .in('status', ['eligible', 'partially_used'])
        .order('discount_percentage', { ascending: false });

    if (error) {
        console.error('Error fetching eligible clients:', error);
        return [];
    }

    return (data || []) as ClientDiscountEligibility[];
}

/**
 * Get a client's discount eligibility history
 */
export async function getClientEligibilityHistory(
    clientId: string,
    limit = 12
): Promise<ClientDiscountEligibility[]> {
    const { data, error } = await db
        .from('client_discount_eligibility')
        .select('*, rule:loyalty_discount_rules(id, name)')
        .eq('client_id', clientId)
        .order('eligible_month', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error fetching client eligibility history:', error);
        return [];
    }

    return (data || []) as ClientDiscountEligibility[];
}

/**
 * Run the monthly eligibility evaluation
 */
export async function runMonthlyEvaluation(): Promise<boolean> {
    const { error } = await db.rpc('evaluate_monthly_discount_eligibility');

    if (error) {
        console.error('Error running monthly evaluation:', error);
        return false;
    }

    return true;
}

// ============================================================================
// Discount Usage
// ============================================================================

/**
 * Apply discount to an order and log usage
 */
export async function applyDiscount(
    eligibilityId: string,
    orderId: string | null,
    invoiceId: string | null,
    orderAmount: number,
    discountAmount: number,
    appliedBy: string,
    notes?: string
): Promise<DiscountUsageLog | null> {
    // Insert usage log
    const { data: usageLog, error: usageError } = await db
        .from('discount_usage_log')
        .insert({
            eligibility_id: eligibilityId,
            order_id: orderId,
            invoice_id: invoiceId,
            order_amount: orderAmount,
            discount_amount: discountAmount,
            applied_by: appliedBy,
            notes,
        })
        .select()
        .single();

    if (usageError) {
        console.error('Error logging discount usage:', usageError);
        return null;
    }

    // Update eligibility status
    const { data: eligibility } = await db
        .from('client_discount_eligibility')
        .select('total_discount_applied, usage_count')
        .eq('id', eligibilityId)
        .single();

    if (eligibility) {
        const newTotal = (eligibility.total_discount_applied || 0) + discountAmount;
        const newCount = (eligibility.usage_count || 0) + 1;

        await db
            .from('client_discount_eligibility')
            .update({
                total_discount_applied: newTotal,
                usage_count: newCount,
                status: 'partially_used',
            })
            .eq('id', eligibilityId);
    }

    return usageLog as DiscountUsageLog;
}

/**
 * Get discount usage log for a client
 */
export async function getClientDiscountUsage(
    clientId: string,
    limit = 20
): Promise<DiscountUsageLog[]> {
    const { data, error } = await db
        .from('discount_usage_log')
        .select(`
            *,
            eligibility:client_discount_eligibility!inner(
                id, client_id, discount_percentage, eligible_month
            )
        `)
        .eq('eligibility.client_id', clientId)
        .order('applied_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error fetching client discount usage:', error);
        return [];
    }

    return (data || []) as DiscountUsageLog[];
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Get loyalty discount statistics
 */
export async function getLoyaltyDiscountStats(): Promise<LoyaltyDiscountStats> {
    const currentMonth = new Date().toISOString().slice(0, 7);

    // Get active rules count
    const { count: activeRulesCount } = await db
        .from('loyalty_discount_rules')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .eq('is_deleted', false);

    // Get eligible clients count this month
    const { count: eligibleClientsCount } = await db
        .from('client_discount_eligibility')
        .select('*', { count: 'exact', head: true })
        .eq('eligible_month', currentMonth)
        .in('status', ['eligible', 'partially_used']);

    // Get total discount given this month
    const { data: usageData } = await db
        .from('discount_usage_log')
        .select('discount_amount, eligibility:client_discount_eligibility!inner(eligible_month)')
        .eq('eligibility.eligible_month', currentMonth);

    const totalDiscountThisMonth = (usageData || []).reduce(
        (sum: number, row: any) => sum + (row.discount_amount || 0),
        0
    );

    // Get top qualifying clients
    const { data: topClients } = await db
        .from('client_discount_eligibility')
        .select('client_id, discount_percentage, qualifying_amount, client:contacts(company)')
        .eq('eligible_month', currentMonth)
        .in('status', ['eligible', 'partially_used'])
        .order('qualifying_amount', { ascending: false })
        .limit(5);

    return {
        total_active_rules: activeRulesCount || 0,
        clients_eligible_this_month: eligibleClientsCount || 0,
        total_discount_given_this_month: totalDiscountThisMonth,
        top_qualifying_clients: (topClients || []).map((c: any) => ({
            client_id: c.client_id,
            client_name: c.client?.company || 'Unknown',
            qualifying_amount: c.qualifying_amount,
            discount_percentage: c.discount_percentage,
        })),
    };
}

/**
 * Check if a client qualifies for any discount rules based on current month spending
 */
export async function checkClientQualification(
    clientId: string
): Promise<{ qualifies: boolean; rule?: LoyaltyDiscountRule; currentSpending: number }> {
    const currentMonth = new Date().toISOString().slice(0, 7);

    // Get current month spending
    const monthlyPurchase = await getClientMonthlyPurchase(clientId, currentMonth);
    const currentSpending = monthlyPurchase?.total_amount || 0;

    // Get active rules
    const rules = await getAllRules();

    // Find the best matching rule (highest priority that client qualifies for)
    for (const rule of rules) {
        if (currentSpending >= rule.min_purchase_amount) {
            return { qualifies: true, rule, currentSpending };
        }
    }

    return { qualifies: false, currentSpending };
}
