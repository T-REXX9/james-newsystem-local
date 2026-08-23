import { Database } from './database.types';

export type ReceivingReport = Database['public']['Tables']['receiving_reports']['Row'];
export type ReceivingReportInsert = Database['public']['Tables']['receiving_reports']['Insert'];
export type ReceivingReportUpdate = Database['public']['Tables']['receiving_reports']['Update'];

export type ReceivingReportItem = Database['public']['Tables']['receiving_report_items']['Row'];
export type ReceivingReportItemInsert = Database['public']['Tables']['receiving_report_items']['Insert'];
export type ReceivingReportItemUpdate = Database['public']['Tables']['receiving_report_items']['Update'];

export type Product = Database['public']['Tables']['products']['Row'];
export type Supplier = Database['public']['Tables']['contacts']['Row'];

export interface ReceivingReportPurchaseOrderSummary {
    id: string;
    po_number: string;
    order_date: string;
    pr_reference: string;
    status: string;
    items: Array<{
        id: string;
        qty: number;
        eta_date: string | null;
    }>;
}

export interface ReceivingReportWithDetails extends ReceivingReport {
    /** Local API fields not present in the legacy Supabase generated row. */
    po_refno?: string;
    eta_date?: string | null;
    item_count?: number;
    total_qty?: number;
    po?: ReceivingReportPurchaseOrderSummary | null;
    items: ReceivingReportItemWithProduct[];
}

export interface ReceivingReportItemWithProduct extends ReceivingReportItem {
    product: Product | null;
    /** Local API fields used by the receiving workflow. */
    item_code?: string;
    part_no?: string;
    original_part_no?: string;
    qty_ordered?: number;
    po_item_id?: number;
    qty_already_received?: number;
    brand?: string;
}

export type RRStatus = 'Draft' | 'Posted' | 'Cancelled';

export const RR_STATUS_COLORS: Record<string, string> = {
    Draft: 'bg-gray-100 text-gray-800',
    Posted: 'bg-green-100 text-green-800',
    Cancelled: 'bg-red-100 text-red-800',
};
