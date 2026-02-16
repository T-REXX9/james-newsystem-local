// @ts-nocheck
import { supabase } from '../lib/supabaseClient';
import {
    ReceivingReport,
    ReceivingReportInsert,
    ReceivingReportUpdate,
    ReceivingReportItem,
    ReceivingReportItemInsert,
    ReceivingReportItemUpdate,
    ReceivingReportWithDetails,
    Product,
    Supplier
} from '../receiving.types';
import { sanitizeObject, SanitizationConfig } from '../utils/dataSanitization';
import { parseSupabaseError } from '../utils/errorHandler';
import { ENTITY_TYPES, logCreate, logDelete, logStatusChange, logUpdate } from './activityLogService';

const receivingReportSanitizationConfig: SanitizationConfig<ReceivingReportInsert> = {
    rr_no: { type: 'string', placeholder: 'n/a', required: true },
    receive_date: { type: 'string', placeholder: 'n/a', required: true },
    supplier_id: { type: 'string', placeholder: 'n/a', required: true },
    supplier_name: { type: 'string', placeholder: 'n/a' },
    po_no: { type: 'string', placeholder: 'n/a' },
    remarks: { type: 'string', placeholder: 'n/a' },
    warehouse_id: { type: 'string', placeholder: 'n/a' },
    grand_total: { type: 'number', placeholder: 0 },
    status: { type: 'string', placeholder: 'Draft' },
};

const receivingReportItemSanitizationConfig: SanitizationConfig<ReceivingReportItemInsert> = {
    item_id: { type: 'string', placeholder: 'n/a', required: true },
    item_code: { type: 'string', placeholder: 'n/a' },
    part_no: { type: 'string', placeholder: 'n/a' },
    description: { type: 'string', placeholder: 'n/a' },
    qty_received: { type: 'number', placeholder: 0 },
    unit_cost: { type: 'number', placeholder: 0 },
    total_amount: { type: 'number', placeholder: 0 },
};

export const receivingService = {
    // --- Receiving Reports ---

    async getReceivingReports(filters?: { month?: number; year?: number; status?: string; search?: string }): Promise<ReceivingReportWithDetails[]> {
        let query = supabase
            .from('receiving_reports')
            .select('*, supplier_name, received_by');

        if (filters?.year) {
            const startDate = `${filters.year}-${String(filters.month || 1).padStart(2, '0')}-01`;
            const endDate = filters.month
                ? new Date(filters.year, filters.month, 0).toISOString().split('T')[0]
                : `${filters.year}-12-31`;

            if (filters.month) {
                query = query.gte('receive_date', startDate).lte('receive_date', endDate);
            } else {
                query = query.gte('receive_date', `${filters.year}-01-01`).lte('receive_date', `${filters.year}-12-31`);
            }
        }

        if (filters?.status) {
            query = query.eq('status', filters.status);
        }

        if (filters?.search) {
            query = query.or(`rr_no.ilike.%${filters.search}%,supplier_name.ilike.%${filters.search}%`);
        }

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        return data as unknown as ReceivingReportWithDetails[];
    },

    async getReceivingReportById(id: string): Promise<ReceivingReportWithDetails> {
        const { data, error } = await supabase
            .from('receiving_reports')
            .select(`
                *,
                items:receiving_report_items(
                    *,
                    product:products(*)
                )
            `)
            .eq('id', id)
            .single();

        if (error) throw error;
        return data as unknown as ReceivingReportWithDetails;
    },

    async createReceivingReport(rr: ReceivingReportInsert): Promise<ReceivingReport> {
        try {
            const sanitizedReport = sanitizeObject(rr, receivingReportSanitizationConfig);
            // Double check duplicate
            const isDuplicate = await this.checkDuplicateRR(sanitizedReport.rr_no);
            if (isDuplicate) {
                throw new Error(`RR Number ${sanitizedReport.rr_no} already exists.`);
            }

            const { data, error } = await supabase
                .from('receiving_reports')
                .insert(sanitizedReport)
                .select()
                .single();
            if (error) throw error;
            try {
                await logCreate(ENTITY_TYPES.RECEIVING_STOCK, data.id, {
                    rr_no: data.rr_no,
                    supplier_id: data.supplier_id,
                    grand_total: data.grand_total,
                });
            } catch (logError) {
                console.error('Failed to log activity:', logError);
            }
            return data as unknown as ReceivingReport;
        } catch (err) {
            console.error('Error creating receiving report:', err);
            throw new Error(parseSupabaseError(err, 'receiving report'));
        }
    },

    async createReceivingReportWithItems(
        rr: Omit<ReceivingReportInsert, 'rr_no' | 'grand_total' | 'status'> & {
            rr_no?: string | null;
            status?: string | null;
        },
        items: Omit<ReceivingReportItemInsert, 'rr_id'>[]
    ): Promise<ReceivingReport> {
        try {
            const sanitizedReport = sanitizeObject(rr as ReceivingReportInsert, receivingReportSanitizationConfig, {
                enforceRequired: false,
                onlyProvided: true,
            });
            const sanitizedItems = items.map((item) =>
                sanitizeObject(item as ReceivingReportItemInsert, receivingReportItemSanitizationConfig, {
                    enforceRequired: false,
                    onlyProvided: true,
                })
            );

            const { data, error } = await supabase.rpc('create_receiving_report_with_items', {
                p_rr_no: sanitizedReport.rr_no || null,
                p_receive_date: sanitizedReport.receive_date,
                p_supplier_id: sanitizedReport.supplier_id,
                p_supplier_name: sanitizedReport.supplier_name || null,
                p_po_no: sanitizedReport.po_no || null,
                p_remarks: sanitizedReport.remarks || null,
                p_warehouse_id: sanitizedReport.warehouse_id,
                p_status: sanitizedReport.status || 'Draft',
                p_items: sanitizedItems,
            });

            if (error) throw error;
            if (!data) throw new Error('Failed to create receiving report');

            const created = data as unknown as ReceivingReport;
            try {
                await logCreate(ENTITY_TYPES.RECEIVING_STOCK, created.id, {
                    rr_no: created.rr_no,
                    supplier_id: created.supplier_id,
                    grand_total: created.grand_total,
                });
            } catch (logError) {
                console.error('Failed to log activity:', logError);
            }

            return created;
        } catch (err) {
            console.error('Error creating receiving report with items:', err);
            throw new Error(parseSupabaseError(err, 'receiving report'));
        }
    },

    async updateReceivingReport(id: string, updates: ReceivingReportUpdate): Promise<ReceivingReport> {
        try {
            const sanitizedUpdates = sanitizeObject(
                updates as ReceivingReportInsert,
                receivingReportSanitizationConfig,
                { enforceRequired: false, onlyProvided: true }
            );
            const { data, error } = await supabase
                .from('receiving_reports')
                .update(sanitizedUpdates)
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            try {
                await logUpdate(ENTITY_TYPES.RECEIVING_STOCK, id, {
                    updated_fields: Object.keys(sanitizedUpdates),
                });
            } catch (logError) {
                console.error('Failed to log activity:', logError);
            }
            return data as unknown as ReceivingReport;
        } catch (err) {
            console.error('Error updating receiving report:', err);
            throw new Error(parseSupabaseError(err, 'receiving report'));
        }
    },

    async deleteReceivingReport(id: string): Promise<void> {
        const { data: existing } = await supabase
            .from('receiving_reports')
            .select('rr_no')
            .eq('id', id)
            .single();
        const { error } = await supabase
            .from('receiving_reports')
            .delete()
            .eq('id', id);
        if (error) throw error;
        try {
            await logDelete(ENTITY_TYPES.RECEIVING_STOCK, id, {
                rr_no: existing?.rr_no ?? null,
            });
        } catch (logError) {
            console.error('Failed to log activity:', logError);
        }
    },

    async finalizeReceivingReport(id: string): Promise<void> {
        const { data: existing } = await supabase
            .from('receiving_reports')
            .select('status')
            .eq('id', id)
            .single();
        const { error } = await supabase.rpc('finalize_receiving_report', { p_rr_id: id });
        if (error) throw error;
        try {
            await logStatusChange(
                ENTITY_TYPES.RECEIVING_STOCK,
                id,
                existing?.status || 'DRAFT',
                'FINALIZED'
            );
        } catch (logError) {
            console.error('Failed to log activity:', logError);
        }
    },

    // --- Receiving Report Items ---

    async addReceivingReportItem(item: ReceivingReportItemInsert): Promise<ReceivingReportItem> {
        try {
            const sanitizedItem = sanitizeObject(item, receivingReportItemSanitizationConfig);
            const { data, error } = await supabase
                .from('receiving_report_items')
                .insert(sanitizedItem)
                .select()
                .single();
            if (error) throw error;
            return data as unknown as ReceivingReportItem;
        } catch (err) {
            console.error('Error adding receiving report item:', err);
            throw new Error(parseSupabaseError(err, 'receiving report item'));
        }
    },

    async updateReceivingReportItem(id: string, updates: ReceivingReportItemUpdate): Promise<ReceivingReportItem> {
        try {
            const sanitizedUpdates = sanitizeObject(
                updates as ReceivingReportItemInsert,
                receivingReportItemSanitizationConfig,
                { enforceRequired: false, onlyProvided: true }
            );
            const { data, error } = await supabase
                .from('receiving_report_items')
                .update(sanitizedUpdates)
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            return data as unknown as ReceivingReportItem;
        } catch (err) {
            console.error('Error updating receiving report item:', err);
            throw new Error(parseSupabaseError(err, 'receiving report item'));
        }
    },

    async deleteReceivingReportItem(id: string): Promise<void> {
        const { error } = await supabase
            .from('receiving_report_items')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    // --- Helpers ---

    async checkDuplicateRR(rrNo: string): Promise<boolean> {
        const { count, error } = await supabase
            .from('receiving_reports')
            .select('*', { count: 'exact', head: true })
            .eq('rr_no', rrNo);

        if (error) throw error;
        return (count || 0) > 0;
    },

    async generateRRNumber(): Promise<string> {
        const { data, error } = await supabase.rpc('generate_receiving_report_no');
        if (error) throw error;
        return data as string;
    },

    async getSuppliers(): Promise<Supplier[]> {
        const { data, error } = await supabase
            .from('contacts')
            .select('*')
            // Using logic from PurchaseOrderService or just all contacts for flexibility if type isn't clear
            // Instructions say "Supplier Selection: Dropdown to select the supplier"
            // I will fetch all for now, or filter if I find a better way.
            .order('company', { ascending: true });

        if (error) throw error;
        return data as unknown as Supplier[];
    },

    async getProducts(): Promise<Product[]> {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('part_no', { ascending: true });
        if (error) throw error;
        return data as unknown as Product[];
    }
};
