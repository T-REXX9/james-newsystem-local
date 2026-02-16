import { supabase } from '../lib/supabaseClient';
import { SupplierReturn, CreateReturnDTO, RRItemForReturn } from '../returnToSupplier.types';
import { ENTITY_TYPES, logCreate, logDelete, logStatusChange } from './activityLogService';

export const returnToSupplierService = {
    // 1. Fetch all returns
    getAllReturns: async (): Promise<SupplierReturn[]> => {
        const { data, error } = await supabase
            .from('supplier_returns')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    // 2. Fetch specific return by ID
    getReturnById: async (id: string): Promise<SupplierReturn | null> => {
        const { data, error } = await supabase
            .from('supplier_returns')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    },

    // 3. Fetch return items
    getReturnItems: async (returnId: string) => {
        const { data, error } = await supabase
            .from('supplier_return_items')
            .select('*')
            .eq('return_id', returnId);

        if (error) throw error;
        return data || [];
    },

    // 4. Create new return
    createReturn: async (returnData: CreateReturnDTO) => {
        const { data: authData } = await supabase.auth.getUser();

        const { data: returnRecord, error } = await supabase.rpc('create_supplier_return_with_items', {
            p_return_date: returnData.return_date,
            p_return_type: returnData.return_type,
            p_rr_id: returnData.rr_id,
            p_rr_no: returnData.rr_no,
            p_supplier_id: returnData.supplier_id,
            p_supplier_name: returnData.supplier_name,
            p_po_no: returnData.po_no || null,
            p_remarks: returnData.remarks || null,
            p_created_by: authData.user?.id || null,
            p_items: returnData.items
        });

        if (error) throw error;
        if (!returnRecord) throw new Error('Failed to create return');

        if (returnRecord) {
            try {
                await logCreate(ENTITY_TYPES.RETURN_TO_SUPPLIER, returnRecord.id, {
                    return_no: returnRecord.return_no,
                    supplier_id: returnRecord.supplier_id,
                    grand_total: returnRecord.grand_total,
                });
            } catch (logError) {
                console.error('Failed to log activity:', logError);
            }
        }

        return returnRecord;
    },

    // 5. Finalize Return
    finalizeReturn: async (returnId: string) => {
        const { data: existing } = await supabase
            .from('supplier_returns')
            .select('status')
            .eq('id', returnId)
            .single();
        const { error } = await supabase.rpc('finalize_supplier_return', { p_return_id: returnId });
        if (error) throw error;
        try {
            await logStatusChange(
                ENTITY_TYPES.RETURN_TO_SUPPLIER,
                returnId,
                existing?.status || 'PENDING',
                'FINALIZED'
            );
        } catch (logError) {
            console.error('Failed to log activity:', logError);
        }
    },

    // 6. Delete Return (only if Pending)
    deleteReturn: async (id: string) => {
        const { data: existing } = await supabase
            .from('supplier_returns')
            .select('return_no')
            .eq('id', id)
            .single();
        const { error } = await supabase
            .from('supplier_returns')
            .delete()
            .eq('id', id)
            .eq('status', 'Pending'); // Safety check

        if (error) throw error;
        try {
            await logDelete(ENTITY_TYPES.RETURN_TO_SUPPLIER, id, {
                return_no: existing?.return_no ?? null,
            });
        } catch (logError) {
            console.error('Failed to log activity:', logError);
        }
    },

    // 7. Get Available Items for RR
    // This is complex. We need items from RR and subtract already returned quantities.
    getRRItemsForReturn: async (rrId: string): Promise<RRItemForReturn[]> => {
        // A. Get RR Items
        const { data: rrItems, error: rrError } = await supabase
            .from('receiving_report_items')
            .select('*')
            .eq('rr_id', rrId);

        if (rrError) throw rrError;

        // B. Get all returned items linked to this RR (via supplier_returns -> supplier_return_items)
        // We can join or just fetch all returns for this RR.

        // First get all return IDs for this RR
        const { data: returns } = await supabase
            .from('supplier_returns')
            .select('id')
            .eq('rr_id', rrId);

        const returnIds = returns?.map(r => r.id) || [];

        let returnedItemsMap: Record<string, number> = {};

        if (returnIds.length > 0) {
            const { data: returnedItems } = await supabase
                .from('supplier_return_items')
                .select('rr_item_id, qty_returned')
                .in('return_id', returnIds);

            returnedItems?.forEach(item => {
                if (item.rr_item_id) {
                    returnedItemsMap[item.rr_item_id] = (returnedItemsMap[item.rr_item_id] || 0) + (item.qty_returned || 0);
                }
            });
        }

        // C. Map results
        return rrItems.map((item: any) => ({
            id: item.id,
            item_id: item.item_id,
            item_code: item.item_code,
            part_number: item.part_no || item.part_number || '',
            description: item.description,
            quantity_received: item.qty_received || item.quantity_received || 0, // Handle potential column name diffs
            unit_cost: item.unit_cost,
            qty_returned_already: returnedItemsMap[item.id] || 0
        }));
    },

    // 8. Search RRs
    searchRRs: async (query: string) => {
        const { data, error } = await supabase
            .from('receiving_reports')
            .select('*')
            .ilike('rr_no', `%${query}%`)
            .eq('status', 'Posted') // Only from posted RRs
            .limit(10);

        if (error) throw error;
        return data || [];
    }
};
