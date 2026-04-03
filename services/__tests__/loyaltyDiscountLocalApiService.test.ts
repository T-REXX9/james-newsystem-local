import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    getAllRules,
    createRule,
    updateRule,
    deleteRule,
    updateRuleStatus,
    getLoyaltyDiscountStats,
    getCustomerActiveDiscount,
} from '../loyaltyDiscountLocalApiService';

const okResponse = (data: unknown) =>
    Promise.resolve({
        ok: true,
        json: async () => ({ data }),
    } as Response);

const errorResponse = (status: number, error: string) =>
    Promise.resolve({
        ok: false,
        status,
        json: async () => ({ error }),
    } as Response);

const sampleRule = {
    id: 'abc123',
    name: 'Gold Tier',
    description: 'Test',
    discount_type: 'purchase_threshold',
    min_purchase_amount: 30000,
    discount_percentage: 5,
    evaluation_period: 'calendar_month',
    is_active: true,
    priority: 10,
    created_by: 'user1',
    created_at: '2026-04-01T00:00:00+00:00',
    updated_at: '2026-04-01T00:00:00+00:00',
    is_deleted: false,
    deleted_at: null,
};

describe('loyaltyDiscountLocalApiService', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    // ────────────────────────────────────────────────────────────────────────
    // getAllRules
    // ────────────────────────────────────────────────────────────────────────

    it('getAllRules returns items from API', async () => {
        (global.fetch as any).mockImplementation(() =>
            okResponse({ items: [sampleRule] })
        );

        const result = await getAllRules(true);
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Gold Tier');

        const [url] = (global.fetch as any).mock.calls[0];
        expect(String(url)).toContain('/loyalty-discounts?');
        expect(String(url)).toContain('include_inactive=1');
    });

    it('getAllRules passes include_inactive=0 when false', async () => {
        (global.fetch as any).mockImplementation(() =>
            okResponse({ items: [] })
        );

        await getAllRules(false);

        const [url] = (global.fetch as any).mock.calls[0];
        expect(String(url)).toContain('include_inactive=0');
    });

    it('getAllRules returns empty array on missing data', async () => {
        (global.fetch as any).mockImplementation(() =>
            okResponse(null)
        );

        const result = await getAllRules();
        expect(result).toEqual([]);
    });

    // ────────────────────────────────────────────────────────────────────────
    // createRule
    // ────────────────────────────────────────────────────────────────────────

    it('createRule sends POST with correct body', async () => {
        (global.fetch as any).mockImplementation(() =>
            okResponse(sampleRule)
        );

        const result = await createRule({
            name: 'Gold Tier',
            min_purchase_amount: 30000,
            discount_percentage: 5,
        }, 'user1');

        expect(result.name).toBe('Gold Tier');

        const [url, init] = (global.fetch as any).mock.calls[0];
        expect(String(url)).toContain('/loyalty-discounts');
        expect(init.method).toBe('POST');
        const body = JSON.parse(init.body);
        expect(body.name).toBe('Gold Tier');
        expect(body.created_by).toBe('user1');
    });

    it('createRule sends customer-specific fields when provided', async () => {
        (global.fetch as any).mockImplementation(() =>
            okResponse({ ...sampleRule, discount_type: 'customer_specific', target_customer_ids: ['cust-1'] })
        );

        await createRule({
            name: 'VIP Discount',
            min_purchase_amount: 0,
            discount_percentage: 8,
            discount_type: 'customer_specific',
            target_customer_ids: ['cust-1'],
            target_customer_names: ['Alpha Corp'],
        }, 'user1');

        const [, init] = (global.fetch as any).mock.calls[0];
        const body = JSON.parse(init.body);
        expect(body.discount_type).toBe('customer_specific');
        expect(body.target_customer_ids).toEqual(['cust-1']);
        expect(body.target_customer_names).toEqual(['Alpha Corp']);
    });

    it('createRule throws on API error', async () => {
        (global.fetch as any).mockImplementation(() =>
            errorResponse(422, 'name is required')
        );

        await expect(createRule({ name: '', min_purchase_amount: 0, discount_percentage: 0 }, '')).rejects.toThrow('name is required');
    });

    // ────────────────────────────────────────────────────────────────────────
    // updateRule
    // ────────────────────────────────────────────────────────────────────────

    it('updateRule sends PATCH with correct body', async () => {
        (global.fetch as any).mockImplementation(() =>
            okResponse({ ...sampleRule, name: 'Updated' })
        );

        const result = await updateRule('abc123', { name: 'Updated' });
        expect(result.name).toBe('Updated');

        const [url, init] = (global.fetch as any).mock.calls[0];
        expect(String(url)).toContain('/loyalty-discounts/abc123');
        expect(init.method).toBe('PATCH');
    });

    it('updateRule sends date-range fields', async () => {
        (global.fetch as any).mockImplementation(() =>
            okResponse({ ...sampleRule, discount_type: 'date_range', start_date: '2026-04-03', end_date: '2026-04-30' })
        );

        await updateRule('abc123', {
            discount_type: 'date_range',
            start_date: '2026-04-03',
            end_date: '2026-04-30',
        });

        const [, init] = (global.fetch as any).mock.calls[0];
        const body = JSON.parse(init.body);
        expect(body.discount_type).toBe('date_range');
        expect(body.start_date).toBe('2026-04-03');
        expect(body.end_date).toBe('2026-04-30');
    });

    // ────────────────────────────────────────────────────────────────────────
    // deleteRule
    // ────────────────────────────────────────────────────────────────────────

    it('deleteRule sends DELETE', async () => {
        (global.fetch as any).mockImplementation(() =>
            okResponse({ deleted: true, rule_id: 'abc123' })
        );

        await deleteRule('abc123');

        const [url, init] = (global.fetch as any).mock.calls[0];
        expect(String(url)).toContain('/loyalty-discounts/abc123');
        expect(init.method).toBe('DELETE');
    });

    it('deleteRule throws on 404', async () => {
        (global.fetch as any).mockImplementation(() =>
            errorResponse(404, 'Loyalty discount rule not found')
        );

        await expect(deleteRule('nonexistent')).rejects.toThrow('not found');
    });

    // ────────────────────────────────────────────────────────────────────────
    // updateRuleStatus
    // ────────────────────────────────────────────────────────────────────────

    it('updateRuleStatus sends PATCH to status endpoint', async () => {
        (global.fetch as any).mockImplementation(() =>
            okResponse({ ...sampleRule, is_active: false })
        );

        const result = await updateRuleStatus('abc123', false);
        expect(result.is_active).toBe(false);

        const [url, init] = (global.fetch as any).mock.calls[0];
        expect(String(url)).toContain('/loyalty-discounts/abc123/status');
        expect(init.method).toBe('PATCH');
        const body = JSON.parse(init.body);
        expect(body.is_active).toBe(false);
    });

    // ────────────────────────────────────────────────────────────────────────
    // getLoyaltyDiscountStats
    // ────────────────────────────────────────────────────────────────────────

    it('getLoyaltyDiscountStats returns stats shape', async () => {
        (global.fetch as any).mockImplementation(() =>
            okResponse({
                total_active_rules: 2,
                clients_eligible_this_month: 5,
                total_discount_given_this_month: 0,
                top_qualifying_clients: [],
            })
        );

        const stats = await getLoyaltyDiscountStats();
        expect(stats.total_active_rules).toBe(2);
        expect(stats.total_discount_given_this_month).toBe(0);
    });

    it('getLoyaltyDiscountStats returns default on empty response', async () => {
        (global.fetch as any).mockImplementation(() =>
            okResponse(null)
        );

        const stats = await getLoyaltyDiscountStats();
        expect(stats.total_active_rules).toBe(0);
        expect(stats.top_qualifying_clients).toEqual([]);
    });

    // ────────────────────────────────────────────────────────────────────────
    // getCustomerActiveDiscount
    // ────────────────────────────────────────────────────────────────────────

    it('getCustomerActiveDiscount returns qualification result', async () => {
        (global.fetch as any).mockImplementation(() =>
            okResponse({
                qualifies: true,
                rule: sampleRule,
                current_spending: 35000,
            })
        );

        const result = await getCustomerActiveDiscount('cust-1');
        expect(result.qualifies).toBe(true);
        expect(result.current_spending).toBe(35000);

        const [url] = (global.fetch as any).mock.calls[0];
        expect(String(url)).toContain('/loyalty-discounts/customer/cust-1/active-discount');
    });
});
