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

const createFromMock = (responses: Record<string, any[]>) => {
    const queues: Record<string, any[]> = Object.fromEntries(
        Object.entries(responses).map(([table, items]) => [table, [...items]])
    );

    const buildersByTable: Record<string, any[]> = {};

    const fromFn = (table: string) => {
        const queue = (queues[table] ??= []);
        const resolveNext = () => queue.shift() ?? { data: null, error: null };

        const builder: any = {
            insert: vi.fn(() => builder),
            update: vi.fn(() => builder),
            delete: vi.fn(() => builder),
            select: vi.fn(() => builder),
            eq: vi.fn(() => builder),
            order: vi.fn(() => builder),
            gte: vi.fn(() => builder),
            lte: vi.fn(() => builder),
            single: vi.fn(() => Promise.resolve(resolveNext())),
            then: (onFulfilled: any, onRejected: any) => Promise.resolve(resolveNext()).then(onFulfilled, onRejected),
        };

        (buildersByTable[table] ??= []).push(builder);
        return builder;
    };

    return { fromFn, buildersByTable };
};

describe('inventoryLogService', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-123' } },
            error: null,
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('createInventoryLogFromPO', () => {
        it('successfully creates inventory logs from delivered PO', async () => {
            const poId = 'po-123';
            const userId = 'user-123';

            const mockPO = {
                id: poId,
                po_no: 'PO-001',
                supplier_id: 'supplier-123',
                status: 'delivered',
                order_date: '2024-01-01',
                delivery_date: '2024-01-15',
                warehouse_id: 'WH1',
                purchase_order_items: [
                    {
                        id: 'poi-1',
                        item_id: 'item-1',
                        qty: 10,
                        unit_price: 100,
                        notes: 'Test item',
                    },
                    {
                        id: 'poi-2',
                        item_id: 'item-2',
                        qty: 20,
                        unit_price: 50,
                        notes: 'Test item 2',
                    },
                ],
            };

            const mockSupplier = {
                id: 'supplier-123',
                company: 'Test Supplier Inc.',
            };

            const { fromFn, buildersByTable } = createFromMock({
                purchase_orders: [{ data: mockPO, error: null }],
                contacts: [{ data: mockSupplier, error: null }],
                inventory_logs: [
                    { data: { id: 'log-1', item_id: 'item-1' }, error: null },
                    { data: { id: 'log-2', item_id: 'item-2' }, error: null },
                ],
            });

            mockSupabase.from.mockImplementation(fromFn);

            const { createInventoryLogFromPO } = await import('../inventoryLogService');
            const result = await createInventoryLogFromPO(poId, userId);

            expect(result).toHaveLength(2);
            const totalInsertCalls = (buildersByTable.inventory_logs || []).reduce(
                (sum, b) => sum + b.insert.mock.calls.length,
                0
            );
            expect(totalInsertCalls).toBe(2);
        });

        it('throws error when PO status is not delivered', async () => {
            const poId = 'po-123';
            const userId = 'user-123';

            const mockPO = {
                id: poId,
                po_no: 'PO-001',
                supplier_id: 'supplier-123',
                status: 'draft', // Invalid status
                order_date: '2024-01-01',
                warehouse_id: 'WH1',
                purchase_order_items: [],
            };

            const mockSingle = vi.fn();
            mockSupabase.from.mockImplementation((table) => {
                if (table === 'purchase_orders') {
                    return {
                        select: () => ({
                            eq: () => ({ single: mockSingle }),
                        }),
                    };
                }
                return { select: vi.fn() };
            });

            mockSingle.mockResolvedValue({ data: mockPO, error: null });

            const { createInventoryLogFromPO } = await import('../inventoryLogService');

            await expect(createInventoryLogFromPO(poId, userId)).rejects.toThrow(
                'Purchase Order must be delivered to create inventory logs'
            );
        });

        it('throws error when PO not found', async () => {
            const poId = 'po-123';
            const userId = 'user-123';

            const mockSingle = vi.fn();
            mockSupabase.from.mockImplementation((table) => {
                if (table === 'purchase_orders') {
                    return {
                        select: () => ({
                            eq: () => ({ single: mockSingle }),
                        }),
                    };
                }
                return { select: vi.fn() };
            });

            mockSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } });

            const { createInventoryLogFromPO } = await import('../inventoryLogService');

            await expect(createInventoryLogFromPO(poId, userId)).rejects.toThrow(
                'Purchase Order not found'
            );
        });
    });

    describe('createInventoryLogFromInvoice', () => {
        it('successfully creates inventory logs from sent invoice', async () => {
            const invoiceId = 'invoice-123';
            const userId = 'user-123';

            const mockInvoice = {
                id: invoiceId,
                invoice_no: 'INV-001',
                contact_id: 'customer-123',
                warehouse_id: 'WH2',
                status: 'sent',
                sales_date: '2024-01-01',
                invoice_items: [
                    {
                        id: 'ii-1',
                        item_id: 'item-1',
                        qty: 5,
                        unit_price: 200,
                    },
                ],
            };

            const mockCustomer = {
                id: 'customer-123',
                company: 'Test Customer Corp.',
            };

            const { fromFn, buildersByTable } = createFromMock({
                invoices: [{ data: mockInvoice, error: null }],
                contacts: [{ data: mockCustomer, error: null }],
                inventory_logs: [{ data: { id: 'log-1', item_id: 'item-1' }, error: null }],
            });

            mockSupabase.from.mockImplementation(fromFn);

            const { createInventoryLogFromInvoice } = await import('../inventoryLogService');
            const result = await createInventoryLogFromInvoice(invoiceId, userId);

            expect(result).toHaveLength(1);
            const insertBuilder = (buildersByTable.inventory_logs || [])[0];
            expect(insertBuilder.insert).toHaveBeenCalledWith(
                expect.objectContaining({
                    warehouse_id: 'WH2',
                    qty_in: 0,
                    qty_out: 5,
                    status_indicator: '-',
                })
            );
        });

        it('successfully creates inventory logs from paid invoice', async () => {
            const invoiceId = 'invoice-123';
            const userId = 'user-123';

            const mockInvoice = {
                id: invoiceId,
                invoice_no: 'INV-001',
                contact_id: 'customer-123',
                warehouse_id: 'WH2',
                status: 'paid', // Valid status
                sales_date: '2024-01-01',
                invoice_items: [
                    {
                        id: 'ii-1',
                        item_id: 'item-1',
                        qty: 3,
                        unit_price: 150,
                    },
                ],
            };

            const mockCustomer = {
                id: 'customer-123',
                company: 'Test Customer Corp.',
            };

            const { fromFn, buildersByTable } = createFromMock({
                invoices: [{ data: mockInvoice, error: null }],
                contacts: [{ data: mockCustomer, error: null }],
                inventory_logs: [{ data: { id: 'log-1', item_id: 'item-1' }, error: null }],
            });

            mockSupabase.from.mockImplementation(fromFn);

            const { createInventoryLogFromInvoice } = await import('../inventoryLogService');
            const result = await createInventoryLogFromInvoice(invoiceId, userId);

            expect(result).toHaveLength(1);
            const insertBuilder = (buildersByTable.inventory_logs || [])[0];
            expect(insertBuilder.insert).toHaveBeenCalledTimes(1);
            expect(insertBuilder.insert).toHaveBeenCalledWith(
                expect.objectContaining({
                    transaction_type: 'Invoice',
                    warehouse_id: 'WH2',
                    qty_in: 0,
                    qty_out: 3,
                    status_indicator: '-',
                })
            );
        });

        it('throws error when invoice status is invalid', async () => {
            const invoiceId = 'invoice-123';
            const userId = 'user-123';

            const mockInvoice = {
                id: invoiceId,
                invoice_no: 'INV-001',
                contact_id: 'customer-123',
                status: 'draft', // Invalid status
                sales_date: '2024-01-01',
                invoice_items: [],
            };

            const mockSingle = vi.fn();
            mockSupabase.from.mockImplementation((table) => {
                if (table === 'invoices') {
                    return {
                        select: () => ({
                            eq: () => ({ single: mockSingle }),
                        }),
                    };
                }
                return { select: vi.fn() };
            });

            mockSingle.mockResolvedValue({ data: mockInvoice, error: null });

            const { createInventoryLogFromInvoice } = await import('../inventoryLogService');

            await expect(createInventoryLogFromInvoice(invoiceId, userId)).rejects.toThrow(
                'Invoice must be sent or paid to create inventory logs'
            );
        });

        it('throws error when invoice warehouse cannot be resolved', async () => {
            const invoiceId = 'invoice-123';
            const userId = 'user-123';

            const mockInvoice = {
                id: invoiceId,
                invoice_no: 'INV-001',
                contact_id: 'customer-123',
                status: 'sent',
                sales_date: '2024-01-01',
                invoice_items: [
                    {
                        id: 'ii-1',
                        item_id: 'item-1',
                        qty: 5,
                        unit_price: 200,
                    },
                ],
            };

            const mockCustomer = {
                id: 'customer-123',
                company: 'Test Customer Corp.',
            };

            const { fromFn } = createFromMock({
                invoices: [{ data: mockInvoice, error: null }],
                contacts: [{ data: mockCustomer, error: null }],
            });

            mockSupabase.from.mockImplementation(fromFn);

            const { createInventoryLogFromInvoice } = await import('../inventoryLogService');

            await expect(createInventoryLogFromInvoice(invoiceId, userId)).rejects.toThrow(
                'Missing warehouse_id for invoice INV-001 item item-1'
            );
        });
    });

    describe('createInventoryLogFromOrderSlip', () => {
        it('successfully creates inventory logs from finalized order slip', async () => {
            const slipId = 'slip-123';
            const userId = 'user-123';

            const mockSlip = {
                id: slipId,
                slip_no: 'OS-001',
                contact_id: 'customer-123',
                warehouse_id: 'WH3',
                status: 'finalized',
                sales_date: '2024-01-01',
                order_slip_items: [
                    {
                        id: 'osi-1',
                        item_id: 'item-1',
                        qty: 8,
                        unit_price: 75,
                    },
                ],
            };

            const mockCustomer = {
                id: 'customer-123',
                company: 'Test Customer Corp.',
            };

            const { fromFn, buildersByTable } = createFromMock({
                order_slips: [{ data: mockSlip, error: null }],
                contacts: [{ data: mockCustomer, error: null }],
                inventory_logs: [{ data: { id: 'log-1', item_id: 'item-1' }, error: null }],
            });

            mockSupabase.from.mockImplementation(fromFn);

            const { createInventoryLogFromOrderSlip } = await import('../inventoryLogService');
            const result = await createInventoryLogFromOrderSlip(slipId, userId);

            expect(result).toHaveLength(1);
            const insertBuilder = (buildersByTable.inventory_logs || [])[0];
            expect(insertBuilder.insert).toHaveBeenCalledWith(
                expect.objectContaining({
                    transaction_type: 'Order Slip',
                    warehouse_id: 'WH3',
                    qty_in: 0,
                    qty_out: 8,
                    status_indicator: '-',
                })
            );
        });

        it('throws error when order slip status is not finalized', async () => {
            const slipId = 'slip-123';
            const userId = 'user-123';

            const mockSlip = {
                id: slipId,
                slip_no: 'OS-001',
                contact_id: 'customer-123',
                status: 'draft', // Invalid status
                sales_date: '2024-01-01',
                order_slip_items: [],
            };

            const mockSingle = vi.fn();
            mockSupabase.from.mockImplementation((table) => {
                if (table === 'order_slips') {
                    return {
                        select: () => ({
                            eq: () => ({ single: mockSingle }),
                        }),
                    };
                }
                return { select: vi.fn() };
            });

            mockSingle.mockResolvedValue({ data: mockSlip, error: null });

            const { createInventoryLogFromOrderSlip } = await import('../inventoryLogService');

            await expect(createInventoryLogFromOrderSlip(slipId, userId)).rejects.toThrow(
                'Order Slip must be finalized to create inventory logs'
            );
        });
    });

    describe('createInventoryLogFromStockAdjustment', () => {
        it('successfully creates inventory logs for positive differences', async () => {
            const adjustmentId = 'adj-123';
            const userId = 'user-123';

            const mockAdjustment = {
                id: adjustmentId,
                adjustment_no: 'SA-001',
                warehouse_id: 'WH1',
                status: 'finalized',
                adjustment_date: '2024-01-01',
                adjustment_type: 'Physical Count',
                notes: 'Annual count',
                stock_adjustment_items: [
                    {
                        id: 'sai-1',
                        item_id: 'item-1',
                        system_qty: 10,
                        physical_qty: 15,
                        difference: 5, // Positive difference
                        reason: 'Found extra items',
                    },
                ],
            };

            const { fromFn, buildersByTable } = createFromMock({
                stock_adjustments: [{ data: mockAdjustment, error: null }],
                inventory_logs: [{ data: { id: 'log-1', item_id: 'item-1' }, error: null }],
            });

            mockSupabase.from.mockImplementation(fromFn);

            const { createInventoryLogFromStockAdjustment } = await import('../inventoryLogService');
            const result = await createInventoryLogFromStockAdjustment(adjustmentId, userId);

            expect(result).toHaveLength(1);
            const insertBuilder = (buildersByTable.inventory_logs || [])[0];
            expect(insertBuilder.insert).toHaveBeenCalledWith(
                expect.objectContaining({
                    qty_in: 5,
                    qty_out: 0,
                    status_indicator: '+',
                    unit_price: 0,
                })
            );
        });

        it('successfully creates inventory logs for negative differences', async () => {
            const adjustmentId = 'adj-123';
            const userId = 'user-123';

            const mockAdjustment = {
                id: adjustmentId,
                adjustment_no: 'SA-001',
                warehouse_id: 'WH1',
                status: 'finalized',
                adjustment_date: '2024-01-01',
                adjustment_type: 'Damage',
                notes: 'Damaged items',
                stock_adjustment_items: [
                    {
                        id: 'sai-1',
                        item_id: 'item-1',
                        system_qty: 20,
                        physical_qty: 15,
                        difference: -5, // Negative difference
                        reason: 'Damaged items removed',
                    },
                ],
            };

            const { fromFn, buildersByTable } = createFromMock({
                stock_adjustments: [{ data: mockAdjustment, error: null }],
                inventory_logs: [{ data: { id: 'log-1', item_id: 'item-1' }, error: null }],
            });

            mockSupabase.from.mockImplementation(fromFn);

            const { createInventoryLogFromStockAdjustment } = await import('../inventoryLogService');
            const result = await createInventoryLogFromStockAdjustment(adjustmentId, userId);

            expect(result).toHaveLength(1);
            const insertBuilder = (buildersByTable.inventory_logs || [])[0];
            expect(insertBuilder.insert).toHaveBeenCalledWith(
                expect.objectContaining({
                    qty_in: 0,
                    qty_out: 5,
                    status_indicator: '-',
                    unit_price: 0,
                })
            );
        });

        it('skips items with zero difference', async () => {
            const adjustmentId = 'adj-123';
            const userId = 'user-123';

            const mockAdjustment = {
                id: adjustmentId,
                adjustment_no: 'SA-001',
                warehouse_id: 'WH1',
                status: 'finalized',
                adjustment_date: '2024-01-01',
                adjustment_type: 'Physical Count',
                notes: 'Annual count',
                stock_adjustment_items: [
                    {
                        id: 'sai-1',
                        item_id: 'item-1',
                        system_qty: 10,
                        physical_qty: 10,
                        difference: 0, // No difference - should be skipped
                        reason: 'No change',
                    },
                ],
            };

            const mockSingle = vi.fn();
            const mockInsert = vi.fn();

            mockSupabase.from.mockImplementation((table) => {
                if (table === 'stock_adjustments') {
                    return {
                        select: () => ({
                            eq: () => ({ single: mockSingle }),
                        }),
                    };
                }
                if (table === 'inventory_logs') {
                    return {
                        insert: mockInsert,
                    };
                }
                return { select: vi.fn() };
            });

            mockSingle.mockResolvedValue({ data: mockAdjustment, error: null });

            const { createInventoryLogFromStockAdjustment } = await import('../inventoryLogService');
            const result = await createInventoryLogFromStockAdjustment(adjustmentId, userId);

            expect(result).toHaveLength(0);
            expect(mockInsert).not.toHaveBeenCalled();
        });

        it('throws error when adjustment status is not finalized', async () => {
            const adjustmentId = 'adj-123';
            const userId = 'user-123';

            const mockAdjustment = {
                id: adjustmentId,
                adjustment_no: 'SA-001',
                warehouse_id: 'WH1',
                status: 'draft', // Invalid status
                adjustment_date: '2024-01-01',
                stock_adjustment_items: [],
            };

            const mockSingle = vi.fn();
            mockSupabase.from.mockImplementation((table) => {
                if (table === 'stock_adjustments') {
                    return {
                        select: () => ({
                            eq: () => ({ single: mockSingle }),
                        }),
                    };
                }
                return { select: vi.fn() };
            });

            mockSingle.mockResolvedValue({ data: mockAdjustment, error: null });

            const { createInventoryLogFromStockAdjustment } = await import('../inventoryLogService');

            await expect(createInventoryLogFromStockAdjustment(adjustmentId, userId)).rejects.toThrow(
                'Stock Adjustment must be finalized to create inventory logs'
            );
        });
    });

    describe('createInventoryLogFromReturn', () => {
        it('successfully creates inventory logs from processed return', async () => {
            const returnId = 'ret-123';
            const userId = 'user-123';

            const mockReturn = {
                id: returnId,
                contact_id: 'customer-123',
                warehouse_id: 'WH4',
                status: 'processed',
                returnDate: '2024-01-01',
                reason: 'Defective product',
                products: [
                    {
                        name: 'Product A',
                        quantity: 2,
                        originalPrice: 100,
                        refundAmount: 200,
                    },
                ],
            };

            const mockCustomer = {
                id: 'customer-123',
                company: 'Test Customer Corp.',
            };

            const mockProduct = {
                id: 'product-1',
                description: 'Product A',
            };

            const { fromFn, buildersByTable } = createFromMock({
                sales_returns: [{ data: mockReturn, error: null }],
                contacts: [{ data: mockCustomer, error: null }],
                products: [{ data: mockProduct, error: null }],
                inventory_logs: [{ data: { id: 'log-1', item_id: 'product-1' }, error: null }],
            });

            mockSupabase.from.mockImplementation(fromFn);

            const { createInventoryLogFromReturn } = await import('../inventoryLogService');
            const result = await createInventoryLogFromReturn(returnId, userId);

            expect(result).toHaveLength(1);
            const insertBuilder = (buildersByTable.inventory_logs || [])[0];
            expect(insertBuilder.insert).toHaveBeenCalledWith(
                expect.objectContaining({
                    transaction_type: 'Credit Memo',
                    warehouse_id: 'WH4',
                    qty_in: 2,
                    qty_out: 0,
                    status_indicator: '+',
                    unit_price: 100,
                })
            );
        });

        it('throws error when return status is not processed', async () => {
            const returnId = 'ret-123';
            const userId = 'user-123';

            const mockReturn = {
                id: returnId,
                contact_id: 'customer-123',
                status: 'pending', // Invalid status
                returnDate: '2024-01-01',
                products: [],
            };

            const mockSingle = vi.fn();
            mockSupabase.from.mockImplementation((table) => {
                if (table === 'sales_returns') {
                    return {
                        select: () => ({
                            eq: () => ({ single: mockSingle }),
                        }),
                    };
                }
                return { select: vi.fn() };
            });

            mockSingle.mockResolvedValue({ data: mockReturn, error: null });

            const { createInventoryLogFromReturn } = await import('../inventoryLogService');

            await expect(createInventoryLogFromReturn(returnId, userId)).rejects.toThrow(
                'Sales Return must be processed to create inventory logs'
            );
        });
    });

    describe('concurrent transaction scenarios', () => {
        it('handles concurrent inventory log creation', async () => {
            const poId = 'po-123';
            const userId = 'user-123';

            const mockPO = {
                id: poId,
                po_no: 'PO-001',
                supplier_id: 'supplier-123',
                status: 'delivered',
                order_date: '2024-01-01',
                delivery_date: '2024-01-15',
                warehouse_id: 'WH1',
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

            const mockSupplier = {
                id: 'supplier-123',
                company: 'Test Supplier Inc.',
            };

            const { fromFn, buildersByTable } = createFromMock({
                purchase_orders: [
                    { data: mockPO, error: null },
                    { data: mockPO, error: null },
                ],
                contacts: [
                    { data: mockSupplier, error: null },
                    { data: mockSupplier, error: null },
                ],
                inventory_logs: [
                    { data: { id: 'log-1', item_id: 'item-1' }, error: null },
                    { data: { id: 'log-2', item_id: 'item-1' }, error: null },
                ],
            });

            mockSupabase.from.mockImplementation(fromFn);

            const { createInventoryLogFromPO } = await import('../inventoryLogService');

            // Create concurrent calls
            const [result1, result2] = await Promise.all([
                createInventoryLogFromPO(poId, userId),
                createInventoryLogFromPO(poId, userId),
            ]);

            expect(result1).toHaveLength(1);
            expect(result2).toHaveLength(1);
            const totalInsertCalls = (buildersByTable.inventory_logs || []).reduce(
                (sum, b) => sum + b.insert.mock.calls.length,
                0
            );
            expect(totalInsertCalls).toBe(2);
        });
    });
});
