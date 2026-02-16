import { supabase } from './supabaseService';
import {
    ProfitThresholdConfig,
    ProfitOverrideLog,
    AdminOverrideLog,
    LowProfitItem,
    ProfitCalculation,
    CreateProfitOverrideDTO,
    CreateAdminOverrideDTO,
    Product,
} from '../types';

// Cast supabase to allow querying new tables before types are regenerated
// TODO: Regenerate Supabase types after migration to remove this cast
const db = supabase as any;

// ============================================================================
// System Settings
// ============================================================================

/**
 * Get the current profit threshold configuration
 */
export async function getProfitThreshold(): Promise<ProfitThresholdConfig> {
    const { data, error } = await db
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'min_gross_profit_threshold')
        .single();

    if (error || !data) {
        // Return default values if setting doesn't exist
        return {
            percentage: 50,
            enforce_approval: true,
            allow_override: true,
        };
    }

    return data.setting_value as ProfitThresholdConfig;
}

/**
 * Update the profit threshold configuration
 */
export async function setProfitThreshold(
    config: ProfitThresholdConfig
): Promise<boolean> {
    const { error } = await db
        .from('system_settings')
        .update({ setting_value: config })
        .eq('setting_key', 'min_gross_profit_threshold');

    if (error) {
        console.error('Error updating profit threshold:', error);
        return false;
    }

    return true;
}

/**
 * Get a system setting by key
 */
export async function getSystemSetting<T>(key: string, defaultValue: T): Promise<T> {
    const { data, error } = await db
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', key)
        .single();

    if (error || !data) {
        return defaultValue;
    }

    return data.setting_value as T;
}

/**
 * Set a system setting
 */
export async function setSystemSetting(key: string, value: any): Promise<boolean> {
    const { error } = await db.rpc('set_system_setting', {
        p_key: key,
        p_value: value,
    });

    if (error) {
        console.error('Error setting system setting:', error);
        return false;
    }

    return true;
}

// ============================================================================
// Profit Calculation
// ============================================================================

/**
 * Calculate gross profit for an item
 */
export function calculateProfit(
    sellingPrice: number,
    cost: number,
    discount: number = 0,
    thresholdPercentage?: number
): ProfitCalculation {
    const netPrice = sellingPrice - discount;
    const profitAmount = netPrice - cost;
    const profitPercentage = netPrice > 0 ? (profitAmount / netPrice) * 100 : 0;

    const threshold = thresholdPercentage ?? 50; // Default 50% threshold
    const isBelowThreshold = profitPercentage < threshold;

    // Calculate suggested price to meet threshold
    let suggestedPrice: number | undefined;
    if (isBelowThreshold && cost > 0) {
        // Formula: suggested = cost / (1 - threshold/100)
        suggestedPrice = cost / (1 - threshold / 100);
    }

    return {
        selling_price: sellingPrice,
        cost,
        discount,
        net_price: netPrice,
        profit_amount: profitAmount,
        profit_percentage: Math.round(profitPercentage * 100) / 100,
        is_below_threshold: isBelowThreshold,
        suggested_price: suggestedPrice ? Math.ceil(suggestedPrice) : undefined,
    };
}

/**
 * Detect low-profit items in an order
 */
export async function detectLowProfitItems(
    items: Array<{
        product_id: string;
        quantity: number;
        unit_price: number;
        discount?: number;
    }>
): Promise<LowProfitItem[]> {
    // Get threshold config
    const config = await getProfitThreshold();
    const threshold = config.percentage;

    // Get product costs
    const productIds = items.map(item => item.product_id);
    const { data: products } = await db
        .from('products')
        .select('id, description, item_code, cost')
        .in('id', productIds);

    const productMap = new Map<string, Product>(
        (products || []).map((p: any) => [p.id, p as Product])
    );

    const lowProfitItems: LowProfitItem[] = [];

    for (const item of items) {
        const product = productMap.get(item.product_id);
        if (!product) continue;

        const cost = product.cost || 0;
        const discount = item.discount || 0;
        const calc = calculateProfit(item.unit_price, cost, discount, threshold);

        if (calc.is_below_threshold) {
            lowProfitItems.push({
                product_id: item.product_id,
                product_name: product.description || '',
                item_code: product.item_code || '',
                cost,
                selling_price: item.unit_price,
                discount,
                net_price: calc.net_price,
                profit_amount: calc.profit_amount,
                profit_percentage: calc.profit_percentage,
                threshold_percentage: threshold,
                below_threshold: true,
            });
        }
    }

    return lowProfitItems;
}

/**
 * Calculate suggested price to meet profit threshold
 */
export function suggestPrice(cost: number, targetProfitPct: number): number {
    if (cost <= 0 || targetProfitPct <= 0 || targetProfitPct >= 100) {
        return cost;
    }

    // Formula: price = cost / (1 - margin)
    const price = cost / (1 - targetProfitPct / 100);
    return Math.ceil(price);
}

// ============================================================================
// Override Logging
// ============================================================================

/**
 * Log a profit override
 */
export async function logProfitOverride(
    dto: CreateProfitOverrideDTO,
    approvedBy: string
): Promise<ProfitOverrideLog | null> {
    const { data, error } = await db
        .from('profit_override_logs')
        .insert({
            ...dto,
            approved_by: approvedBy,
        })
        .select()
        .single();

    if (error) {
        console.error('Error logging profit override:', error);
        return null;
    }

    return data as ProfitOverrideLog;
}

/**
 * Get profit override history
 */
export async function getProfitOverrideHistory(
    filters?: {
        order_id?: string;
        item_id?: string;
        limit?: number;
    }
): Promise<ProfitOverrideLog[]> {
    let query = db
        .from('profit_override_logs')
        .select('*, approver:profiles(id, full_name)')
        .order('created_at', { ascending: false });

    if (filters?.order_id) {
        query = query.eq('order_id', filters.order_id);
    }
    if (filters?.item_id) {
        query = query.eq('item_id', filters.item_id);
    }
    if (filters?.limit) {
        query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching profit override history:', error);
        return [];
    }

    return (data || []) as ProfitOverrideLog[];
}

/**
 * Log an admin override
 */
export async function logAdminOverride(
    dto: CreateAdminOverrideDTO,
    performedBy: string
): Promise<AdminOverrideLog | null> {
    const { data, error } = await db
        .from('admin_override_logs')
        .insert({
            ...dto,
            performed_by: performedBy,
        })
        .select()
        .single();

    if (error) {
        console.error('Error logging admin override:', error);
        return null;
    }

    return data as AdminOverrideLog;
}

/**
 * Get admin override history
 */
export async function getAdminOverrideHistory(
    filters?: {
        override_type?: string;
        entity_type?: string;
        entity_id?: string;
        limit?: number;
    }
): Promise<AdminOverrideLog[]> {
    let query = db
        .from('admin_override_logs')
        .select('*, performer:profiles(id, full_name)')
        .order('created_at', { ascending: false });

    if (filters?.override_type) {
        query = query.eq('override_type', filters.override_type);
    }
    if (filters?.entity_type) {
        query = query.eq('entity_type', filters.entity_type);
    }
    if (filters?.entity_id) {
        query = query.eq('entity_id', filters.entity_id);
    }
    if (filters?.limit) {
        query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching admin override history:', error);
        return [];
    }

    return (data || []) as AdminOverrideLog[];
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Check an entire order for low-profit items and return a summary
 */
export async function validateOrderProfits(
    items: Array<{
        product_id: string;
        quantity: number;
        unit_price: number;
        discount?: number;
    }>
): Promise<{
    hasLowProfitItems: boolean;
    lowProfitItems: LowProfitItem[];
    totalItemsCount: number;
    lowProfitCount: number;
    requiresApproval: boolean;
}> {
    const lowProfitItems = await detectLowProfitItems(items);
    const config = await getProfitThreshold();

    return {
        hasLowProfitItems: lowProfitItems.length > 0,
        lowProfitItems,
        totalItemsCount: items.length,
        lowProfitCount: lowProfitItems.length,
        requiresApproval: config.enforce_approval && lowProfitItems.length > 0,
    };
}

/**
 * Get profit statistics for a time period
 */
export async function getProfitOverrideStats(
    startDate?: Date,
    endDate?: Date
): Promise<{
    total_overrides: number;
    average_original_profit_pct: number;
    average_override_profit_pct: number;
    top_override_reasons: Array<{ reason: string; count: number }>;
}> {
    let query = db
        .from('profit_override_logs')
        .select('original_profit_pct, override_profit_pct, reason');

    if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
    }
    if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
        return {
            total_overrides: 0,
            average_original_profit_pct: 0,
            average_override_profit_pct: 0,
            top_override_reasons: [],
        };
    }

    const totalOverrides = data.length;
    const avgOriginal = data.reduce((sum: number, r: any) => sum + (r.original_profit_pct || 0), 0) / totalOverrides;
    const avgOverride = data.reduce((sum: number, r: any) => sum + (r.override_profit_pct || 0), 0) / totalOverrides;

    // Count reasons
    const reasonCounts = new Map<string, number>();
    for (const row of data) {
        const reason = row.reason || 'No reason provided';
        reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
    }

    const topReasons = Array.from(reasonCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([reason, count]) => ({ reason, count }));

    return {
        total_overrides: totalOverrides,
        average_original_profit_pct: Math.round(avgOriginal * 100) / 100,
        average_override_profit_pct: Math.round(avgOverride * 100) / 100,
        top_override_reasons: topReasons,
    };
}
