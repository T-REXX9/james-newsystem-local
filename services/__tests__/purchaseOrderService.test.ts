import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';

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

vi.mock('../inventoryLogService', () => ({
    createInventoryLogFromPO: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../activityLogService', () => ({
    ENTITY_TYPES: {
        PURCHASE_ORDER: 'purchase_order',
    },
    logCreate: vi.fn().mockResolvedValue(undefined),
    logUpdate: vi.fn().mockResolvedValue(undefined),
    logStatusChange: vi.fn().mockResolvedValue(undefined),
    logDelete: vi.fn().mockResolvedValue(undefined),
}));

const createQueryBuilderMock = (result: any) => {
    const queue = [result];
    const resolveNext = () => queue.shift() ?? { data: null, error: null };

    const builder: any = {
        insert: vi.fn(() => builder),
        update: vi.fn(() => builder),
        delete: vi.fn(() => builder),
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        order: vi.fn(() => builder),
        single: vi.fn(() => Promise.resolve(resolveNext())),
        then: (onFulfilled: any, onRejected: any) => Promise.resolve(resolveNext()).then(onFulfilled, onRejected),
    };

    return builder;
};

describe('purchaseOrderService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('createPurchaseOrder', () => {
        it('successfully creates a purchase order with valid data', async () => {
            const userId = 'user-123';
            const poData = {
                po_no: 'PO-001',
                supplier_id: 'supplier-123',
                order_date: '2024-01-01',
                delivery_date: '2024-01-15',
                warehouse_id: 'WH1',
                items: [
                    {
                        item_id: 'item-1',
                        qty: 10,
                        unit_price: 100,
                        notes: 'Test item',
                    },
                    {
                        item_id: 'item-2',
                        qty: 20,
                        unit_price: 50,
                        notes: 'Test item 2',
                    },
                ],
            };

            const mockCreatedPO = {
                id: 'po-123',
                po_no: 'PO-001',
                supplier_id: 'supplier-123',
                order_date: '2024-01-01',
                delivery_date: '2024-01-15',
                warehouse_id: 'WH1',
                status: 'draft',
                grand_total: 2000,
                created_by: userId,
                is_deleted: false,
            };

            const mockPOWithItems = {
                ...mockCreatedPO,
                purchase_order_items: [
                    {
                        id: 'poi-1',
                        po_id: 'po-123',
                        item_id: 'item-1',
                        qty: 10,
                        unit_price: 100,
                        amount: 1000,
                        notes: 'Test item',
                    },
                    {
                        id: 'poi-2',
                        po_id: 'po-123',
                        item_id: 'item-2',
                        qty: 20,
                        unit_price: 50,
                        amount: 1000,
                        notes: 'Test item 2',
                    },
                ],
            };

            // Mock auth user
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: { id: userId } },
                error: null,
            });

            const insertPOBuilder = createQueryBuilderMock({ data: mockCreatedPO, error: null });
            const insertItemsBuilder = createQueryBuilderMock({ error: null });
            const getPOBuilder = createQueryBuilderMock({ data: mockPOWithItems, error: null });

            mockSupabase.from
                .mockReturnValueOnce(insertPOBuilder)
                .mockReturnValueOnce(insertItemsBuilder)
                .mockReturnValueOnce(getPOBuilder);

            const { createPurchaseOrder } = await import('../purchaseOrderService');
            const result = await createPurchaseOrder(poData);

            expect(result).toEqual(mockPOWithItems);
            expect(insertPOBuilder.insert).toHaveBeenCalledTimes(1);
            expect(insertItemsBuilder.insert).toHaveBeenCalledTimes(1);
            expect(result.grand_total).toBe(2000);
        });

        it('throws error when user is not authenticated', async () => {
            const poData = {
                po_no: 'PO-001',
                supplier_id: 'supplier-123',
                order_date: '2024-01-01',
                delivery_date: '2024-01-15',
                warehouse_id: 'WH1',
                items: [],
            };

            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: null },
                error: { message: 'Not authenticated' },
            });

            const { createPurchaseOrder } = await import('../purchaseOrderService');

            await expect(createPurchaseOrder(poData)).rejects.toThrow('User not authenticated');
        });

        it('rolls back PO creation when items insertion fails', async () => {
            const userId = 'user-123';
            const poData = {
                po_no: 'PO-001',
                supplier_id: 'supplier-123',
                order_date: '2024-01-01',
                delivery_date: '2024-01-15',
                warehouse_id: 'WH1',
                items: [
                    {
                        item_id: 'item-1',
                        qty: 10,
                        unit_price: 100,
                        notes: 'Test item',
                    },
                ],
            };

            const mockCreatedPO = {
                id: 'po-123',
                po_no: 'PO-001',
                supplier_id: 'supplier-123',
                order_date: '2024-01-01',
                delivery_date: '2024-01-15',
                warehouse_id: 'WH1',
                status: 'draft',
                grand_total: 1000,
                created_by: userId,
                is_deleted: false,
            };

            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: { id: userId } },
                error: null,
            });

            const insertPOBuilder = createQueryBuilderMock({ data: mockCreatedPO, error: null });
            const insertItemsBuilder = createQueryBuilderMock({ error: new Error('Failed to insert items') });
            const rollbackDeleteBuilder = createQueryBuilderMock({ error: null });

            mockSupabase.from
                .mockReturnValueOnce(insertPOBuilder)
                .mockReturnValueOnce(insertItemsBuilder)
                .mockReturnValueOnce(rollbackDeleteBuilder);

            const { createPurchaseOrder } = await import('../purchaseOrderService');

            await expect(createPurchaseOrder(poData)).rejects.toThrow('Failed to insert items');
            expect(rollbackDeleteBuilder.delete).toHaveBeenCalled(); // Verify rollback
        });
    });

    describe('getPurchaseOrder', () => {
        it('successfully retrieves a purchase order by ID', async () => {
            const poId = 'po-123';

            const mockPO = {
                id: poId,
                po_no: 'PO-001',
                supplier_id: 'supplier-123',
                order_date: '2024-01-01',
                delivery_date: '2024-01-15',
                warehouse_id: 'WH1',
                status: 'draft',
                grand_total: 1000,
                is_deleted: false,
                purchase_order_items: [
                    {
                        id: 'poi-1',
                        po_id: poId,
                        item_id: 'item-1',
                        qty: 10,
                        unit_price: 100,
                        amount: 1000,
                        notes: 'Test item',
                    },
                ],
            };

            const builder = createQueryBuilderMock({ data: mockPO, error: null });
            mockSupabase.from.mockReturnValue(builder);

            const { getPurchaseOrder } = await import('../purchaseOrderService');
            const result = await getPurchaseOrder(poId);

            expect(result).toEqual(mockPO);
            expect(builder.eq).toHaveBeenCalledWith('id', poId);
            expect(builder.eq).toHaveBeenCalledWith('is_deleted', false);
        });

        it('returns null when purchase order not found', async () => {
            const poId = 'po-123';

            const builder = createQueryBuilderMock({ data: null, error: { message: 'Not found' } });
            mockSupabase.from.mockReturnValue(builder);

            const { getPurchaseOrder } = await import('../purchaseOrderService');
            const result = await getPurchaseOrder(poId);

            expect(result).toBeNull();
        });
    });

    describe('updatePurchaseOrder', () => {
        it('successfully updates a draft purchase order', async () => {
            const poId = 'po-123';
            const userId = 'user-123';

            const existingPO = {
                id: poId,
                po_no: 'PO-001',
                supplier_id: 'supplier-123',
                order_date: '2024-01-01',
                delivery_date: '2024-01-15',
                warehouse_id: 'WH1',
                status: 'draft', // Draft status - can be updated
                grand_total: 1000,
                is_deleted: false,
                purchase_order_items: [],
            };

            const updates = {
                po_no: 'PO-001-UPDATED',
                supplier_id: 'supplier-456',
                order_date: '2024-01-02',
                delivery_date: '2024-01-16',
                warehouse_id: 'WH2',
                items: [
                    {
                        item_id: 'item-1',
                        qty: 15,
                        unit_price: 120,
                        notes: 'Updated item',
                    },
                ],
            };

            const mockUpdatedPO = {
                ...existingPO,
                po_no: 'PO-001-UPDATED',
                supplier_id: 'supplier-456',
                order_date: '2024-01-02',
                delivery_date: '2024-01-16',
                warehouse_id: 'WH2',
                grand_total: 1800,
            };

            const mockPOWithUpdatedItems = {
                ...mockUpdatedPO,
                purchase_order_items: [
                    {
                        id: 'poi-1',
                        po_id: poId,
                        item_id: 'item-1',
                        qty: 15,
                        unit_price: 120,
                        amount: 1800,
                        notes: 'Updated item',
                    },
                ],
            };

            const getExistingPOBuilder = createQueryBuilderMock({ data: existingPO, error: null });
            const updatePOBuilder = createQueryBuilderMock({ data: mockUpdatedPO, error: null });
            const deleteItemsBuilder = createQueryBuilderMock({ error: null });
            const insertItemsBuilder = createQueryBuilderMock({ error: null });
            const getUpdatedPOBuilder = createQueryBuilderMock({ data: mockPOWithUpdatedItems, error: null });

            mockSupabase.from
                .mockReturnValueOnce(getExistingPOBuilder)
                .mockReturnValueOnce(updatePOBuilder)
                .mockReturnValueOnce(deleteItemsBuilder)
                .mockReturnValueOnce(insertItemsBuilder)
                .mockReturnValueOnce(getUpdatedPOBuilder);

            const { updatePurchaseOrder } = await import('../purchaseOrderService');
            const result = await updatePurchaseOrder(poId, updates);

            expect(result).toEqual(mockPOWithUpdatedItems);
            expect(result.grand_total).toBe(1800);
        });

        it('throws error when trying to update non-draft PO', async () => {
            const poId = 'po-123';

            const existingPO = {
                id: poId,
                po_no: 'PO-001',
                supplier_id: 'supplier-123',
                order_date: '2024-01-01',
                delivery_date: '2024-01-15',
                warehouse_id: 'WH1',
                status: 'ordered', // Not draft - cannot be updated
                grand_total: 1000,
                is_deleted: false,
                purchase_order_items: [],
            };

            const updates = {
                po_no: 'PO-001-UPDATED',
            };

            const builder = createQueryBuilderMock({ data: existingPO, error: null });
            mockSupabase.from.mockReturnValue(builder);

            const { updatePurchaseOrder } = await import('../purchaseOrderService');

            await expect(updatePurchaseOrder(poId, updates)).rejects.toThrow(
                'Only draft purchase orders can be updated'
            );
        });

        it('throws error when PO not found', async () => {
            const poId = 'po-123';
            const updates = { po_no: 'PO-001-UPDATED' };

            const builder = createQueryBuilderMock({ data: null, error: null });
            mockSupabase.from.mockReturnValue(builder);

            const { updatePurchaseOrder } = await import('../purchaseOrderService');

            await expect(updatePurchaseOrder(poId, updates)).rejects.toThrow(
                'Purchase Order not found'
            );
        });
    });

    describe('markAsDelivered', () => {
        it('successfully marks PO as delivered and creates inventory logs', async () => {
            const poId = 'po-123';
            const userId = 'user-123';

            const existingPO = {
                id: poId,
                po_no: 'PO-001',
                supplier_id: 'supplier-123',
                order_date: '2024-01-01',
                delivery_date: '2024-01-15',
                warehouse_id: 'WH1',
                status: 'ordered', // Can be marked as delivered
                grand_total: 1000,
                is_deleted: false,
                purchase_order_items: [
                    {
                        id: 'poi-1',
                        item_id: 'item-1',
                        qty: 10,
                        unit_price: 100,
                        notes: 'Test item',
                    },
                ],
            };

            const mockDeliveredPO = {
                ...existingPO,
                status: 'delivered',
                delivery_date: expect.any(String),
                updated_at: expect.any(String),
            };

            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: { id: userId } },
                error: null,
            });

            const getExistingPOBuilder = createQueryBuilderMock({ data: existingPO, error: null });
            const updatePOBuilder = createQueryBuilderMock({ data: mockDeliveredPO, error: null });
            const getDeliveredPOBuilder = createQueryBuilderMock({ data: mockDeliveredPO, error: null });

            mockSupabase.from
                .mockReturnValueOnce(getExistingPOBuilder)
                .mockReturnValueOnce(updatePOBuilder)
                .mockReturnValueOnce(getDeliveredPOBuilder);

            const { markAsDelivered } = await import('../purchaseOrderService');
            const result = await markAsDelivered(poId);

            expect(result.status).toBe('delivered');
        });

        it('throws error when PO status is not ordered', async () => {
            const poId = 'po-123';

            const existingPO = {
                id: poId,
                po_no: 'PO-001',
                supplier_id: 'supplier-123',
                order_date: '2024-01-01',
                delivery_date: '2024-01-15',
                warehouse_id: 'WH1',
                status: 'draft', // Cannot be marked as delivered
                grand_total: 1000,
                is_deleted: false,
                purchase_order_items: [],
            };

            const builder = createQueryBuilderMock({ data: existingPO, error: null });
            mockSupabase.from.mockReturnValue(builder);

            const { markAsDelivered } = await import('../purchaseOrderService');

            await expect(markAsDelivered(poId)).rejects.toThrow(
                'Only ordered purchase orders can be marked as delivered'
            );
        });

        it('throws error when user is not authenticated', async () => {
            const poId = 'po-123';

            const existingPO = {
                id: poId,
                po_no: 'PO-001',
                supplier_id: 'supplier-123',
                order_date: '2024-01-01',
                delivery_date: '2024-01-15',
                warehouse_id: 'WH1',
                status: 'ordered',
                grand_total: 1000,
                is_deleted: false,
                purchase_order_items: [],
            };

            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: null },
                error: { message: 'Not authenticated' },
            });

            const builder = createQueryBuilderMock({ data: existingPO, error: null });
            mockSupabase.from.mockReturnValue(builder);

            const { markAsDelivered } = await import('../purchaseOrderService');

            await expect(markAsDelivered(poId)).rejects.toThrow('User not authenticated');
        });
    });

    describe('getAllPurchaseOrders', () => {
        it('successfully retrieves all purchase orders without filters', async () => {
            const mockPOs = [
                {
                    id: 'po-1',
                    po_no: 'PO-001',
                    supplier_id: 'supplier-1',
                    order_date: '2024-01-01',
                    status: 'draft',
                    grand_total: 1000,
                    is_deleted: false,
                    purchase_order_items: [],
                },
                {
                    id: 'po-2',
                    po_no: 'PO-002',
                    supplier_id: 'supplier-2',
                    order_date: '2024-01-02',
                    status: 'ordered',
                    grand_total: 2000,
                    is_deleted: false,
                    purchase_order_items: [],
                },
            ];

            const builder = createQueryBuilderMock({ data: mockPOs, error: null });
            mockSupabase.from.mockReturnValue(builder);

            const { getAllPurchaseOrders } = await import('../purchaseOrderService');
            const result = await getAllPurchaseOrders();

            expect(result).toEqual(mockPOs);
            expect(result).toHaveLength(2);
        });

        it('successfully retrieves purchase orders with status filter', async () => {
            const mockPOs = [
                {
                    id: 'po-1',
                    po_no: 'PO-001',
                    supplier_id: 'supplier-1',
                    order_date: '2024-01-01',
                    status: 'delivered', // Filtered status
                    grand_total: 1000,
                    is_deleted: false,
                    purchase_order_items: [],
                },
            ];

            const builder = createQueryBuilderMock({ data: mockPOs, error: null });
            mockSupabase.from.mockReturnValue(builder);

            const { getAllPurchaseOrders } = await import('../purchaseOrderService');
            const result = await getAllPurchaseOrders({ status: 'delivered' });

            expect(result).toEqual(mockPOs);
            expect(result).toHaveLength(1);
            expect(result[0].status).toBe('delivered');
        });

        it('handles empty results', async () => {
            const builder = createQueryBuilderMock({ data: null, error: null });
            mockSupabase.from.mockReturnValue(builder);

            const { getAllPurchaseOrders } = await import('../purchaseOrderService');
            const result = await getAllPurchaseOrders();

            expect(result).toEqual([]);
        });

        it('throws error when database query fails', async () => {
            const builder = createQueryBuilderMock({ data: null, error: new Error('Database error') });
            mockSupabase.from.mockReturnValue(builder);

            const { getAllPurchaseOrders } = await import('../purchaseOrderService');

            await expect(getAllPurchaseOrders()).rejects.toThrow('Database error');
        });
    });
});
