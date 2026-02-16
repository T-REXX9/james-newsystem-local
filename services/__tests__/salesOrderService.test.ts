import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { RecycleBinItemType, SalesOrderStatus } from '../../types';

// Mock the supabase client
const mockSupabase = {
    auth: {
        getUser: vi.fn(),
    },
    from: vi.fn(),
};

vi.mock('../../lib/supabaseClient', () => ({
    supabase: mockSupabase,
}));

describe('salesOrderService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('deleteSalesOrder', () => {
        it('successfully deletes an order and moves it to recycle bin', async () => {
            const orderId = 'test-order-id';
            const userId = 'test-user-id';

            const mockOrder = {
                id: orderId,
                order_no: 'ORD-001',
                contact_id: 'contact-123',
                items: [],
                status: SalesOrderStatus.PENDING,
                created_at: '2024-01-01',
                // add other required fields if strictly needed by types, but partial might work for runtime mock
            };

            // Mock auth user
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: { id: userId } },
                error: null,
            });

            // Chain mocks for supabase.from(...)
            const mockSelect = vi.fn();
            const mockEq = vi.fn();
            const mockSingle = vi.fn();
            const mockInsert = vi.fn();
            const mockUpdate = vi.fn();
            const mockDelete = vi.fn();

            // Setup the chain behavior
            mockSupabase.from.mockImplementation((table) => {
                if (table === 'sales_orders') {
                    return {
                        select: () => ({
                            eq: (field: string, val: any) => {
                                if (field === 'id') return {
                                    eq: () => ({ single: mockSingle }) // handle .eq('id').eq('is_deleted') chain
                                };
                                return { single: mockSingle };
                            }
                        }),
                        update: (payload: any) => ({
                            eq: mockEq
                        })
                    };
                }
                if (table === 'sales_order_items') {
                    return {
                        select: () => ({
                            eq: vi.fn().mockResolvedValue({ data: [], error: null })
                        })
                    };
                }
                if (table === 'recycle_bin_items') {
                    return {
                        insert: mockInsert
                    };
                }
                return { select: mockSelect };
            });

            // Setup specific return values
            // 1. getSalesOrder -> returns order data
            mockSingle.mockResolvedValue({ data: mockOrder, error: null });

            // 2. recycle bin insert -> success
            mockInsert.mockResolvedValue({ error: null });

            // 3. update is_deleted -> success
            mockEq.mockResolvedValue({ error: null });

            const { deleteSalesOrder } = await import('../salesOrderService');
            const result = await deleteSalesOrder(orderId);

            expect(result).toBe(true);

            // Verify recycle bin insert called with correct data structure
            expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
                item_id: orderId,
                item_type: RecycleBinItemType.ORDER,
                deleted_by: userId,
                restore_token: expect.stringMatching(/^restore_test-order-id_\d+$/),
                expires_at: expect.any(String),
                permanent_delete_at: expect.any(String),
            }));
        });
    });
});
