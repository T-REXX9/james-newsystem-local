import {
    LoyaltyDiscountRule,
    CreateLoyaltyDiscountRuleDTO,
    UpdateLoyaltyDiscountRuleDTO,
    LoyaltyDiscountStats,
} from '../types';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);

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

const requestJson = async (url: string, init?: RequestInit): Promise<any> => {
    const response = await fetch(url, init);
    if (!response.ok) {
        throw new Error(await parseApiErrorMessage(response));
    }
    return response.json();
};

// ============================================================================
// Rules CRUD
// ============================================================================

export const getAllRules = async (includeInactive = true): Promise<LoyaltyDiscountRule[]> => {
    const query = new URLSearchParams({
        main_id: String(API_MAIN_ID),
        include_inactive: includeInactive ? '1' : '0',
    });
    const payload = await requestJson(`${API_BASE_URL}/loyalty-discounts?${query.toString()}`);
    return payload?.data?.items || [];
};

export const createRule = async (
    dto: CreateLoyaltyDiscountRuleDTO,
    createdBy: string
): Promise<LoyaltyDiscountRule> => {
    const payload = await requestJson(`${API_BASE_URL}/loyalty-discounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            main_id: API_MAIN_ID,
            ...dto,
            created_by: createdBy,
        }),
    });
    return payload?.data;
};

export const updateRule = async (
    id: string,
    updates: UpdateLoyaltyDiscountRuleDTO
): Promise<LoyaltyDiscountRule> => {
    const payload = await requestJson(`${API_BASE_URL}/loyalty-discounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            main_id: API_MAIN_ID,
            ...updates,
        }),
    });
    return payload?.data;
};

export const deleteRule = async (id: string): Promise<void> => {
    const query = new URLSearchParams({ main_id: String(API_MAIN_ID) });
    await requestJson(`${API_BASE_URL}/loyalty-discounts/${id}?${query.toString()}`, {
        method: 'DELETE',
    });
};

export const updateRuleStatus = async (
    id: string,
    isActive: boolean
): Promise<LoyaltyDiscountRule> => {
    const payload = await requestJson(`${API_BASE_URL}/loyalty-discounts/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            main_id: API_MAIN_ID,
            is_active: isActive,
        }),
    });
    return payload?.data;
};

// ============================================================================
// Stats
// ============================================================================

export const getLoyaltyDiscountStats = async (): Promise<LoyaltyDiscountStats> => {
    const query = new URLSearchParams({ main_id: String(API_MAIN_ID) });
    const payload = await requestJson(`${API_BASE_URL}/loyalty-discounts/stats?${query.toString()}`);
    return payload?.data || {
        total_active_rules: 0,
        clients_eligible_this_month: 0,
        total_discount_given_this_month: 0,
        top_qualifying_clients: [],
    };
};

// ============================================================================
// Customer active discount (Phase 5)
// ============================================================================

export interface CustomerActiveDiscountResult {
    qualifies: boolean;
    rule: LoyaltyDiscountRule | null;
    current_spending: number;
}

export const getCustomerActiveDiscount = async (
    customerId: string
): Promise<CustomerActiveDiscountResult> => {
    const query = new URLSearchParams({ main_id: String(API_MAIN_ID) });
    const payload = await requestJson(
        `${API_BASE_URL}/loyalty-discounts/customer/${customerId}/active-discount?${query.toString()}`
    );
    return payload?.data || { qualifies: false, rule: null, current_spending: 0 };
};
