// @ts-nocheck
import { supabase } from '../lib/supabaseClient';
import { Database } from '../database.types';
import {
    PurchaseOrder,
    PurchaseOrderInsert,
    PurchaseOrderUpdate,
    PurchaseOrderItem,
    PurchaseOrderItemInsert,
    PurchaseOrderItemUpdate,
    PurchaseOrderWithDetails,
    Product,
    Supplier
} from '../purchaseOrderTypes';
import { sanitizeObject, SanitizationConfig } from '../utils/dataSanitization';
import { parseSupabaseError } from '../utils/errorHandler';
import {
    ENTITY_TYPES,
    logCreate,
    logDelete,
    logStatusChange,
    logUpdate
} from './activityLogService';

// Suppressing strict type checks for Supabase query chains due to complexity/depth limits
const purchaseOrderSanitizationConfig: SanitizationConfig<PurchaseOrderInsert> = {
    po_number: { type: 'string', placeholder: 'n/a', required: true },
    order_date: { type: 'string', placeholder: 'n/a', required: true },
    supplier_id: { type: 'string', placeholder: 'n/a', required: true },
    warehouse_id: { type: 'string', placeholder: 'n/a' },
    remarks: { type: 'string', placeholder: 'n/a' },
    pr_reference: { type: 'string', placeholder: 'n/a' },
    status: { type: 'string', placeholder: 'Draft' },
    grand_total: { type: 'number', placeholder: 0 },
};

const purchaseOrderItemSanitizationConfig: SanitizationConfig<PurchaseOrderItemInsert> = {
    item_id: { type: 'string', placeholder: 'n/a', required: true },
    description: { type: 'string', placeholder: 'n/a' },
    qty: { type: 'number', placeholder: 0 },
    unit_price: { type: 'number', placeholder: 0 },
    amount: { type: 'number', placeholder: 0 },
    remark: { type: 'string', placeholder: 'n/a' },
};

export const purchaseOrderService = {
    // --- Purchase Orders ---

    async getPurchaseOrders(filters?: { month?: number; year?: number; status?: string }): Promise<PurchaseOrderWithDetails[]> {
        let query = supabase
            .from('purchase_orders')
            .select('*, supplier:contacts(*)');

        if (filters?.year) {
            const startDate = `${filters.year}-${String(filters.month || 1).padStart(2, '0')}-01`;
            // Calculate end date properly for filtering
            const endDate = filters.month
                ? new Date(filters.year, filters.month, 0).toISOString().split('T')[0] // Last day of month
                : `${filters.year}-12-31`;

            if (filters.month) {
                query = query.gte('order_date', startDate).lte('order_date', endDate);
            } else {
                query = query.gte('order_date', `${filters.year}-01-01`).lte('order_date', `${filters.year}-12-31`);
            }
        }

        if (filters?.status) {
            query = query.eq('status', filters.status);
        }

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        return data as unknown as PurchaseOrderWithDetails[];
    },

    async getPurchaseOrderById(id: string): Promise<PurchaseOrderWithDetails> {
        const { data, error } = await supabase
            .from('purchase_orders')
            .select(`
        *,
        supplier:contacts(*),
        items:purchase_order_items(
          *,
          product:products(*)
        )
      `)
            .eq('id', id)
            .single();

        if (error) throw error;
        return data as unknown as PurchaseOrderWithDetails;
    },

    async createPurchaseOrder(po: PurchaseOrderInsert): Promise<PurchaseOrder> {
        try {
            const sanitizedPO = sanitizeObject(po, purchaseOrderSanitizationConfig);
            const { data, error } = await supabase
                .from('purchase_orders')
                .insert(sanitizedPO)
                .select()
                .single();
            if (error) throw error;
            try {
                await logCreate(ENTITY_TYPES.PURCHASE_ORDER, data.id, {
                    po_number: data.po_number,
                    supplier_id: data.supplier_id,
                    grand_total: data.grand_total,
                });
            } catch (logError) {
                console.error('Failed to log activity:', logError);
            }
            return data as unknown as PurchaseOrder;
        } catch (err) {
            console.error('Error creating purchase order:', err);
            throw new Error(parseSupabaseError(err, 'purchase order'));
        }
    },

    async updatePurchaseOrder(id: string, updates: PurchaseOrderUpdate): Promise<PurchaseOrder> {
        try {
            const sanitizedUpdates = sanitizeObject(
                updates as PurchaseOrderInsert,
                purchaseOrderSanitizationConfig,
                { enforceRequired: false, onlyProvided: true }
            );
            const { data, error } = await supabase
                .from('purchase_orders')
                .update(sanitizedUpdates)
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            try {
                await logUpdate(ENTITY_TYPES.PURCHASE_ORDER, id, {
                    updated_fields: Object.keys(sanitizedUpdates),
                });
            } catch (logError) {
                console.error('Failed to log activity:', logError);
            }
            return data as unknown as PurchaseOrder;
        } catch (err) {
            console.error('Error updating purchase order:', err);
            throw new Error(parseSupabaseError(err, 'purchase order'));
        }
    },

    async deletePurchaseOrder(id: string): Promise<void> {
        const { data: existing } = await supabase
            .from('purchase_orders')
            .select('po_number')
            .eq('id', id)
            .single();
        const { error } = await supabase
            .from('purchase_orders')
            .delete()
            .eq('id', id);
        if (error) throw error;
        try {
            await logDelete(ENTITY_TYPES.PURCHASE_ORDER, id, {
                po_number: existing?.po_number ?? null,
            });
        } catch (logError) {
            console.error('Failed to log activity:', logError);
        }
    },

    // --- Purchase Order Items ---

    async getPurchaseOrderItems(poId: string): Promise<PurchaseOrderItem[]> {
        const { data, error } = await supabase
            .from('purchase_order_items')
            .select('*, product:products(*)')
            .eq('po_id', poId);
        if (error) throw error;
        return data as unknown as PurchaseOrderItem[];
    },

    async addPurchaseOrderItem(item: PurchaseOrderItemInsert): Promise<PurchaseOrderItem> {
        try {
            const sanitizedItem = sanitizeObject(item, purchaseOrderItemSanitizationConfig);
            const { data, error } = await supabase
                .from('purchase_order_items')
                .insert(sanitizedItem)
                .select()
                .single();
            if (error) throw error;
            return data as unknown as PurchaseOrderItem;
        } catch (err) {
            console.error('Error adding purchase order item:', err);
            throw new Error(parseSupabaseError(err, 'purchase order item'));
        }
    },

    async updatePurchaseOrderItem(id: string, updates: PurchaseOrderItemUpdate): Promise<PurchaseOrderItem> {
        try {
            const sanitizedUpdates = sanitizeObject(
                updates as PurchaseOrderItemInsert,
                purchaseOrderItemSanitizationConfig,
                { enforceRequired: false, onlyProvided: true }
            );
            const { data, error } = await supabase
                .from('purchase_order_items')
                .update(sanitizedUpdates)
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            return data as unknown as PurchaseOrderItem;
        } catch (err) {
            console.error('Error updating purchase order item:', err);
            throw new Error(parseSupabaseError(err, 'purchase order item'));
        }
    },

    async deletePurchaseOrderItem(id: string): Promise<void> {
        const { error } = await supabase
            .from('purchase_order_items')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    // --- Suppliers ---

    async getSuppliers(): Promise<Supplier[]> {
        const { data, error } = await supabase
            .from('contacts')
            .select('*')
            // Assuming 'PO' identifies suppliers based on user input, 
            // or we just fetch all and filter in UI, or fetch specific types.
            // Based on discovery: transactionType='PO' might be the key.
            .ilike('transactionType', '%PO%')
            .order('company', { ascending: true });

        if (error) throw error;
        return data as unknown as Supplier[];
    },

    // --- Products ---

    async getProducts(): Promise<Product[]> {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('part_no', { ascending: true });
        if (error) throw error;
        return data as unknown as Product[];
    },

    // --- Utils ---

    async generatePONumber(): Promise<string> {
        const year = new Date().getFullYear().toString().slice(-2);
        // Simple count query - in production consider a dedicated sequence or more robust locking
        const { count, error } = await supabase
            .from('purchase_orders')
            .select('*', { count: 'exact', head: true })
            .ilike('po_number', `PO-${year}%`);

        if (error) throw error;

        const sequence = String((count || 0) + 1).padStart(2, '0');
        return `PO-${year}${sequence}`;
    }
};

const calculateGrandTotal = (items: Array<{ qty: number; unit_price: number }>) =>
    items.reduce((sum, item) => sum + (item.qty || 0) * (item.unit_price || 0), 0);

export const getPurchaseOrder = async (id: string): Promise<PurchaseOrderWithDetails | null> => {
    const { data, error } = await supabase
        .from('purchase_orders')
        .select('*, purchase_order_items(*)')
        .eq('id', id)
        .eq('is_deleted', false)
        .single();

    if (error) {
        if (!data) return null;
        throw error;
    }

    return data as unknown as PurchaseOrderWithDetails;
};

export const getAllPurchaseOrders = async (filters?: { status?: string }): Promise<PurchaseOrderWithDetails[]> => {
    let query = supabase
        .from('purchase_orders')
        .select('*, purchase_order_items(*)')
        .eq('is_deleted', false);

    if (filters?.status) {
        query = query.eq('status', filters.status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return (data as unknown as PurchaseOrderWithDetails[]) || [];
};

export const createPurchaseOrder = async (data: PurchaseOrderInsert & { items?: PurchaseOrderItemInsert[] }) => {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData?.user;

    if (authError || !user) {
        throw new Error('User not authenticated');
    }

    const { items = [], ...poData } = data as any;
    const { data: created, error } = await supabase
        .from('purchase_orders')
        .insert({
            ...poData,
            created_by: user.id,
            is_deleted: false,
            grand_total: calculateGrandTotal(items),
        })
        .select()
        .single();

    if (error) throw error;

    if (items.length > 0) {
        const itemsPayload = items.map((item: any) => ({
            ...item,
            po_id: created.id,
            amount: (item.qty || 0) * (item.unit_price || 0),
        }));
        const { error: itemsError } = await supabase
            .from('purchase_order_items')
            .insert(itemsPayload);

        if (itemsError) {
            await supabase.from('purchase_orders').delete().eq('id', created.id);
            throw itemsError;
        }
    }

    try {
        await logCreate(ENTITY_TYPES.PURCHASE_ORDER, created.id, {
            po_number: created.po_number,
            supplier_id: created.supplier_id,
            grand_total: created.grand_total,
        });
    } catch (logError) {
        console.error('Failed to log activity:', logError);
    }

    return await getPurchaseOrder(created.id);
};

export const updatePurchaseOrder = async (
    id: string,
    updates: PurchaseOrderUpdate & { items?: PurchaseOrderItemInsert[] }
) => {
    const existing = await getPurchaseOrder(id);
    if (!existing) {
        throw new Error('Purchase Order not found');
    }

    if (existing.status !== 'draft') {
        throw new Error('Only draft purchase orders can be updated');
    }

    const { items = [], ...poUpdates } = updates as any;

    const { data: updated, error: updateError } = await supabase
        .from('purchase_orders')
        .update({
            ...poUpdates,
            grand_total: items.length > 0 ? calculateGrandTotal(items) : existing.grand_total,
        })
        .eq('id', id)
        .select()
        .single();

    if (updateError) throw updateError;

    if (items.length > 0) {
        const { error: deleteError } = await supabase
            .from('purchase_order_items')
            .delete()
            .eq('po_id', id);
        if (deleteError) throw deleteError;

        const itemsPayload = items.map((item: any) => ({
            ...item,
            po_id: id,
            amount: (item.qty || 0) * (item.unit_price || 0),
        }));

        const { error: itemsError } = await supabase
            .from('purchase_order_items')
            .insert(itemsPayload);
        if (itemsError) throw itemsError;
    }

    try {
        const updatedFields = [
            ...Object.keys(poUpdates),
            ...(items.length > 0 ? ['items'] : []),
        ];
        await logUpdate(ENTITY_TYPES.PURCHASE_ORDER, id, { updated_fields: updatedFields });
    } catch (logError) {
        console.error('Failed to log activity:', logError);
    }

    return updated ? await getPurchaseOrder(id) : null;
};

export const markAsDelivered = async (id: string) => {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData?.user;
    if (authError || !user) {
        throw new Error('User not authenticated');
    }

    const existing = await getPurchaseOrder(id);
    if (!existing) {
        throw new Error('Purchase Order not found');
    }

    if (existing.status !== 'ordered') {
        throw new Error('Only ordered purchase orders can be marked as delivered');
    }

    const now = new Date().toISOString();
    const deliveryDate = now.split('T')[0];

    const { error: updateError } = await supabase
        .from('purchase_orders')
        .update({
            status: 'delivered',
            delivery_date: deliveryDate,
            updated_at: now,
        })
        .eq('id', id)
        .select()
        .single();

    if (updateError) throw updateError;

    const { createInventoryLogFromPO } = await import('./inventoryLogService');
    await createInventoryLogFromPO(id, user.id);

    try {
        await logStatusChange(
            ENTITY_TYPES.PURCHASE_ORDER,
            id,
            existing.status || 'ordered',
            'delivered'
        );
    } catch (logError) {
        console.error('Failed to log activity:', logError);
    }

    return await getPurchaseOrder(id);
};
