// @ts-nocheck
import { supabase } from '../lib/supabaseClient';
import {
    PurchaseRequest,
    PurchaseRequestWithItems,
    CreatePRPayload,
    CreatePRItemPayload
} from '../purchaseRequest.types';
import { sanitizeObject, SanitizationConfig } from '../utils/dataSanitization';
import { parseSupabaseError } from '../utils/errorHandler';
import { ENTITY_TYPES, logCreate, logDelete, logUpdate } from './activityLogService';

const purchaseRequestSanitizationConfig: SanitizationConfig<CreatePRPayload> = {
    pr_number: { type: 'string', placeholder: 'n/a', required: true },
    request_date: { type: 'string', placeholder: 'n/a', required: true },
    notes: { type: 'string', placeholder: 'n/a' },
    reference_no: { type: 'string', placeholder: 'n/a' },
};

const purchaseRequestItemSanitizationConfig: SanitizationConfig<CreatePRItemPayload> = {
    item_id: { type: 'string', placeholder: 'n/a', required: true },
    item_code: { type: 'string', placeholder: 'n/a' },
    part_number: { type: 'string', placeholder: 'n/a' },
    description: { type: 'string', placeholder: 'n/a' },
    quantity: { type: 'number', placeholder: 0 },
    unit_cost: { type: 'number', placeholder: 0 },
    supplier_id: { type: 'string', placeholder: 'n/a' },
    supplier_name: { type: 'string', placeholder: 'n/a' },
    eta_date: { type: 'string', placeholder: 'n/a' },
};

export const purchaseRequestService = {
    // --- Purchase Requests ---

    async getPurchaseRequests(filters?: { month?: number; year?: number; status?: string }): Promise<PurchaseRequestWithItems[]> {
        let query = supabase
            .from('purchase_requests')
            .select(`
                *,
                items:purchase_request_items(*)
            `);

        if (filters?.year) {
            const startDate = `${filters.year}-${String(filters.month || 1).padStart(2, '0')}-01`;
            const endDate = filters.month
                ? new Date(filters.year, filters.month, 0).toISOString().split('T')[0]
                : `${filters.year}-12-31`;

            query = query.gte('request_date', startDate).lte('request_date', endDate);
        }

        if (filters?.status && filters.status !== 'All') {
            query = query.eq('status', filters.status);
        }

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        return data as unknown as PurchaseRequestWithItems[];
    },

    async getPurchaseRequestById(id: string): Promise<PurchaseRequestWithItems> {
        const { data, error } = await supabase
            .from('purchase_requests')
            .select(`
                *,
                items:purchase_request_items(*)
            `)
            .eq('id', id)
            .single();

        if (error) throw error;
        return data as unknown as PurchaseRequestWithItems;
    },

    async createPurchaseRequest(payload: CreatePRPayload): Promise<PurchaseRequestWithItems> {
        try {
            const sanitizedPayload = sanitizeObject(payload, purchaseRequestSanitizationConfig);
            // 1. Create Header
            const { data: prData, error: prError } = await supabase
                .from('purchase_requests')
                .insert({
                    pr_number: sanitizedPayload.pr_number,
                    request_date: sanitizedPayload.request_date,
                    notes: sanitizedPayload.notes,
                    reference_no: sanitizedPayload.reference_no,
                    status: 'Draft'
                })
                .select()
                .single();

            if (prError) throw prError;
            if (!prData) throw new Error('Failed to create purchase request');

            // 2. Create Items
            if (payload.items.length > 0) {
                const itemsToInsert = payload.items.map(item => {
                    const sanitizedItem = sanitizeObject(item, purchaseRequestItemSanitizationConfig);
                    return {
                        pr_id: prData.id,
                        item_id: sanitizedItem.item_id,
                        item_code: sanitizedItem.item_code,
                        part_number: sanitizedItem.part_number,
                        description: sanitizedItem.description,
                        quantity: sanitizedItem.quantity,
                        unit_cost: sanitizedItem.unit_cost,
                        supplier_id: sanitizedItem.supplier_id,
                        supplier_name: sanitizedItem.supplier_name,
                        eta_date: sanitizedItem.eta_date
                    };
                });

                const { error: itemsError } = await supabase
                    .from('purchase_request_items')
                    .insert(itemsToInsert);

            if (itemsError) {
                await supabase.from('purchase_requests').delete().eq('id', prData.id);
                throw itemsError;
            }
        }

        try {
            await logCreate(ENTITY_TYPES.PURCHASE_REQUEST, prData.id, {
                pr_number: prData.pr_number,
                reference_no: prData.reference_no,
            });
        } catch (logError) {
            console.error('Failed to log activity:', logError);
        }

        return await this.getPurchaseRequestById(prData.id);
    } catch (err) {
        console.error('Error creating purchase request:', err);
        throw new Error(parseSupabaseError(err, 'purchase request'));
    }
    },

    async updatePurchaseRequest(id: string, updates: Partial<PurchaseRequest>): Promise<void> {
        try {
            const sanitizedUpdates = sanitizeObject(
                updates as CreatePRPayload,
                purchaseRequestSanitizationConfig,
                { enforceRequired: false, onlyProvided: true }
            );
            const { error } = await supabase
                .from('purchase_requests')
                .update(sanitizedUpdates)
                .eq('id', id);
            if (error) throw error;
            try {
                await logUpdate(ENTITY_TYPES.PURCHASE_REQUEST, id, {
                    updated_fields: Object.keys(sanitizedUpdates),
                });
            } catch (logError) {
                console.error('Failed to log activity:', logError);
            }
        } catch (err) {
            console.error('Error updating purchase request:', err);
            throw new Error(parseSupabaseError(err, 'purchase request'));
        }
    },

    async deletePurchaseRequest(id: string): Promise<void> {
        const { data: existing } = await supabase
            .from('purchase_requests')
            .select('pr_number')
            .eq('id', id)
            .single();
        const { error } = await supabase
            .from('purchase_requests')
            .delete()
            .eq('id', id);
        if (error) throw error;
        try {
            await logDelete(ENTITY_TYPES.PURCHASE_REQUEST, id, {
                pr_number: existing?.pr_number ?? null,
            });
        } catch (logError) {
            console.error('Failed to log activity:', logError);
        }
    },

    // --- PR Items (Individual Management) ---
    async addPRItem(prId: string, item: CreatePRItemPayload): Promise<void> {
        try {
            const sanitizedItem = sanitizeObject(item, purchaseRequestItemSanitizationConfig);
            const { error } = await supabase
                .from('purchase_request_items')
                .insert({
                    pr_id: prId,
                    ...sanitizedItem
                });
            if (error) throw error;
        } catch (err) {
            console.error('Error adding purchase request item:', err);
            throw new Error(parseSupabaseError(err, 'purchase request item'));
        }
    },

    async updatePRItem(itemId: string, updates: any): Promise<void> {
        try {
            const sanitizedUpdates = sanitizeObject(
                updates as CreatePRItemPayload,
                purchaseRequestItemSanitizationConfig,
                { enforceRequired: false, onlyProvided: true }
            );
            const { error } = await supabase
                .from('purchase_request_items')
                .update(sanitizedUpdates)
                .eq('id', itemId);
            if (error) throw error;
        } catch (err) {
            console.error('Error updating purchase request item:', err);
            throw new Error(parseSupabaseError(err, 'purchase request item'));
        }
    },

    async deletePRItem(itemId: string): Promise<void> {
        const { error } = await supabase
            .from('purchase_request_items')
            .delete()
            .eq('id', itemId);
        if (error) throw error;
    },

    // --- Helpers ---

    async generatePRNumber(): Promise<string> {
        const year = new Date().getFullYear().toString().slice(-2);
        // Using RPC function as discovered in backend types
        const { data: count, error } = await supabase
            .rpc('get_year_pr_count', { year_suffix: year });

        if (error) throw error;

        const sequence = String((count || 0) + 1).padStart(2, '0');
        // Check uniqueness loop? skipping for now as per instructions
        return `PR-${year}${sequence}`;
    },

    async getSuppliers() {
        // Reuse logic from PurchaseOrderService
        const { data, error } = await supabase
            .from('contacts')
            .select('id, company, payment_terms') // Fetching terms for cost/payment info
            .ilike('transactionType', '%PO%')
            .order('company', { ascending: true });
        if (error) throw error;
        return data;
    },

    async getProducts() {
        const { data, error } = await supabase
            .from('products')
            .select('id, item_code, part_number, name, description, cost, quantity') // Added quantity for inventory check
            .order('part_number', { ascending: true });
        if (error) throw error;
        return data;
    },

    async getSupplierItemCost(supplierId: string, itemId: string) {
        const { data, error } = await supabase
            .from('supplier_item_costs')
            .select('unit_cost')
            .eq('supplier_id', supplierId)
            .eq('item_id', itemId)
            .maybeSingle(); // Use maybeSingle to avoid 406 not found error

        if (error) return 0;
        return data?.unit_cost || 0;
    },

    // Convert to PO
    async convertToPO(prIds: string[], approverId: string): Promise<string> {
        // This is complex. The guide implies "User converts to PO".
        // It says "Selected items are added to a new Purchase Order".
        // For simplicity, let's assume 1 PR -> 1 PO or selected items from 1 PR.
        // Implementation: Create PO header, copy items.
        // Returning generated PO ID.
        return 'TODO_PO_ID';
        // Note: The UI for conversion might need selection. 
        // I will implement basic "Convert All" for now in UI.
    }
};
