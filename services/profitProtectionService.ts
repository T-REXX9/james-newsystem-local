import {
    ProfitThresholdConfig,
    ProfitOverrideLog,
    AdminOverrideLog,
    LowProfitItem,
    ProfitCalculation,
    CreateProfitOverrideDTO,
    CreateAdminOverrideDTO,
} from '../types';
import { getLocalAuthSession } from './localAuthService';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

const DEFAULT_THRESHOLD_CONFIG: ProfitThresholdConfig = {
    percentage: 50,
    enforce_approval: true,
    allow_override: true,
};

const parseApiErrorMessage = async (response: Response): Promise<string> => {
    try {
        const payload = await response.json();
        if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error.trim();
        if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message.trim();
    } catch {
        // ignore parse errors
    }
    return `API request failed (${response.status})`;
};

const requestApi = async (url: string, init?: RequestInit): Promise<any> => {
    const response = await fetch(url, init);
    if (!response.ok) {
        throw new Error(await parseApiErrorMessage(response));
    }
    const payload = await response.json();
    if (!payload?.ok) {
        throw new Error(payload?.error || 'API request failed');
    }
    return payload?.data;
};

const toNumber = (value: unknown, fallback = 0): number => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const toBool = (value: unknown, fallback = false): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (!normalized) return fallback;
        return ['1', 'true', 'yes', 'on'].includes(normalized);
    }
    return fallback;
};

const clampThreshold = (value: number): number => Math.max(10, Math.min(90, Math.round(value)));

const resolveMainId = (): number => {
    const session = getLocalAuthSession();
    const fromSession = Number(
        session?.context?.main_userid ||
        session?.context?.user?.main_userid ||
        (session?.context as any)?.user?.main_id ||
        API_MAIN_ID ||
        1
    );
    return Number.isFinite(fromSession) && fromSession > 0 ? fromSession : 1;
};

const resolveUserId = (): number => {
    const session = getLocalAuthSession();
    const userId = Number(session?.context?.user?.id || 0);
    return Number.isFinite(userId) && userId > 0 ? userId : 1;
};

const normalizeThresholdConfig = (raw: any): ProfitThresholdConfig => ({
    percentage: clampThreshold(toNumber(raw?.percentage, DEFAULT_THRESHOLD_CONFIG.percentage)),
    enforce_approval: toBool(raw?.enforce_approval, DEFAULT_THRESHOLD_CONFIG.enforce_approval),
    allow_override: toBool(raw?.allow_override, DEFAULT_THRESHOLD_CONFIG.allow_override),
});

// ============================================================================
// System Settings
// ============================================================================

/**
 * Get the current profit threshold configuration
 */
export async function getProfitThreshold(): Promise<ProfitThresholdConfig> {
    const query = new URLSearchParams({ main_id: String(resolveMainId()) });
    try {
        const data = await requestApi(`${API_BASE_URL}/profit-protection/threshold?${query.toString()}`);
        return normalizeThresholdConfig(data);
    } catch {
        return DEFAULT_THRESHOLD_CONFIG;
    }
}

/**
 * Update the profit threshold configuration
 */
export async function setProfitThreshold(
    config: ProfitThresholdConfig
): Promise<boolean> {
    const payload = {
        main_id: resolveMainId(),
        user_id: resolveUserId(),
        percentage: clampThreshold(toNumber(config?.percentage, DEFAULT_THRESHOLD_CONFIG.percentage)),
        enforce_approval: Boolean(config?.enforce_approval),
        allow_override: Boolean(config?.allow_override),
    };

    try {
        await requestApi(`${API_BASE_URL}/profit-protection/threshold`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        return true;
    } catch (error) {
        console.error('Error updating profit threshold:', error);
        return false;
    }
}

/**
 * Get a system setting by key
 * Note: Local API currently supports only `min_gross_profit_threshold` for this service.
 */
export async function getSystemSetting<T>(key: string, defaultValue: T): Promise<T> {
    if (key === 'min_gross_profit_threshold') {
        return await getProfitThreshold() as T;
    }
    return defaultValue;
}

/**
 * Set a system setting
 * Note: Local API currently supports only `min_gross_profit_threshold` for this service.
 */
export async function setSystemSetting(key: string, value: any): Promise<boolean> {
    if (key === 'min_gross_profit_threshold') {
        return await setProfitThreshold(normalizeThresholdConfig(value));
    }
    return false;
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

    const threshold = thresholdPercentage ?? 50;
    const isBelowThreshold = profitPercentage < threshold;

    let suggestedPrice: number | undefined;
    if (isBelowThreshold && cost > 0) {
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
    if (!Array.isArray(items) || items.length === 0) {
        return [];
    }

    try {
        const data = await requestApi(`${API_BASE_URL}/profit-protection/validate-items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                main_id: resolveMainId(),
                items,
            }),
        });
        return Array.isArray(data?.low_profit_items) ? data.low_profit_items as LowProfitItem[] : [];
    } catch (error) {
        console.error('Error detecting low-profit items:', error);
        return [];
    }
}

/**
 * Calculate suggested price to meet profit threshold
 */
export function suggestPrice(cost: number, targetProfitPct: number): number {
    if (cost <= 0 || targetProfitPct <= 0 || targetProfitPct >= 100) {
        return cost;
    }

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
    try {
        const data = await requestApi(`${API_BASE_URL}/profit-protection/overrides`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                main_id: resolveMainId(),
                approved_by: approvedBy,
                ...dto,
            }),
        });
        return (data || null) as ProfitOverrideLog | null;
    } catch (error) {
        console.error('Error logging profit override:', error);
        return null;
    }
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
    const query = new URLSearchParams({
        main_id: String(resolveMainId()),
        limit: String(Math.max(1, Math.min(500, Number(filters?.limit || 100)))),
    });
    if (filters?.order_id) query.set('order_id', filters.order_id);
    if (filters?.item_id) query.set('item_id', filters.item_id);

    try {
        const data = await requestApi(`${API_BASE_URL}/profit-protection/overrides?${query.toString()}`);
        return Array.isArray(data) ? data as ProfitOverrideLog[] : [];
    } catch (error) {
        console.error('Error fetching profit override history:', error);
        return [];
    }
}

/**
 * Log an admin override
 */
export async function logAdminOverride(
    dto: CreateAdminOverrideDTO,
    performedBy: string
): Promise<AdminOverrideLog | null> {
    try {
        const data = await requestApi(`${API_BASE_URL}/profit-protection/admin-overrides`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                main_id: resolveMainId(),
                performed_by: performedBy,
                ...dto,
            }),
        });
        return (data || null) as AdminOverrideLog | null;
    } catch (error) {
        console.error('Error logging admin override:', error);
        return null;
    }
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
    const query = new URLSearchParams({
        main_id: String(resolveMainId()),
        limit: String(Math.max(1, Math.min(500, Number(filters?.limit || 100)))),
    });
    if (filters?.override_type) query.set('override_type', filters.override_type);
    if (filters?.entity_type) query.set('entity_type', filters.entity_type);
    if (filters?.entity_id) query.set('entity_id', filters.entity_id);

    try {
        const data = await requestApi(`${API_BASE_URL}/profit-protection/admin-overrides?${query.toString()}`);
        return Array.isArray(data) ? data as AdminOverrideLog[] : [];
    } catch (error) {
        console.error('Error fetching admin override history:', error);
        return [];
    }
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
    try {
        const data = await requestApi(`${API_BASE_URL}/profit-protection/validate-items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                main_id: resolveMainId(),
                items,
            }),
        });

        const lowProfitItems = Array.isArray(data?.low_profit_items) ? data.low_profit_items as LowProfitItem[] : [];
        return {
            hasLowProfitItems: Boolean(data?.has_low_profit_items ?? (lowProfitItems.length > 0)),
            lowProfitItems,
            totalItemsCount: toNumber(data?.total_items_count, items.length),
            lowProfitCount: toNumber(data?.low_profit_count, lowProfitItems.length),
            requiresApproval: Boolean(data?.requires_approval),
        };
    } catch (error) {
        console.error('Error validating order profits:', error);
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
    const query = new URLSearchParams({
        main_id: String(resolveMainId()),
    });
    if (startDate) query.set('start_date', startDate.toISOString());
    if (endDate) query.set('end_date', endDate.toISOString());

    try {
        const data = await requestApi(`${API_BASE_URL}/profit-protection/override-stats?${query.toString()}`);
        return {
            total_overrides: toNumber(data?.total_overrides, 0),
            average_original_profit_pct: toNumber(data?.average_original_profit_pct, 0),
            average_override_profit_pct: toNumber(data?.average_override_profit_pct, 0),
            top_override_reasons: Array.isArray(data?.top_override_reasons) ? data.top_override_reasons : [],
        };
    } catch {
        return {
            total_overrides: 0,
            average_original_profit_pct: 0,
            average_override_profit_pct: 0,
            top_override_reasons: [],
        };
    }
}
