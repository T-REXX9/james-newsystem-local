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
    pr_refno?: string;
    order_date: string;
    pr_reference: string;
    status: string;
    items: Array<{
        id: string;
        qty: number;
        quantity_received?: number;
        eta_date: string | null;
    }>;
}

export interface ReceivingReportWithDetails extends ReceivingReport {
    /** Local API fields not present in the legacy Supabase generated row. */
    po_refno?: string;
    eta_date?: string | null;
    item_count?: number;
    total_qty?: number;
    ordered_qty?: number;
    received_qty?: number;
    remaining_qty?: number;
    cycle_status?: 'Complete Delivery' | 'Incomplete Delivery' | 'Returned to Supplier';
    incomplete_delivery_reason?: string;
    return_records?: Array<{ id: string; return_no: string; status?: string }>;
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

/** Reasons required when posting a receiving report with qty received < PO qty. */
export const INCOMPLETE_DELIVERY_REASONS = [
    'Partial delivery — remaining quantity to follow',
    'Factory out of stock — unable to complete the full delivery',
    'Missing item',
    'Defective item — return to supplier',
] as const;

export type IncompleteDeliveryReason = (typeof INCOMPLETE_DELIVERY_REASONS)[number];

/** Partial delivery keeps remaining PO quantity open; other reasons close it. */
export const PARTIAL_DELIVERY_REASON: IncompleteDeliveryReason = INCOMPLETE_DELIVERY_REASONS[0];

export const remainingQuantityAfterReceipt = (
    report: Pick<ReceivingReportWithDetails, 'items' | 'po'>
): number => {
    const items = report.items || [];
    const remainingFromRrLines = items.reduce((sum, item) => {
        const ordered = Number(item.qty_ordered || 0);
        const received = Number(item.qty_received || 0);
        return sum + Math.max(0, ordered - received);
    }, 0);

    const poItems = report.po?.items || [];
    if (poItems.length === 0) return remainingFromRrLines;

    const remainingFromPo = poItems.reduce((sum, poItem) => {
        const ordered = Number(poItem.qty || 0);
        const previouslyReceived = Number(poItem.quantity_received || 0);
        const thisReceipt = items
            .filter((line) => String(line.po_item_id || '') === String(poItem.id))
            .reduce((lineSum, line) => lineSum + Number(line.qty_received || 0), 0);
        return sum + Math.max(0, ordered - previouslyReceived - thisReceipt);
    }, 0);

    return Math.max(remainingFromRrLines, remainingFromPo);
};

export const shouldCloseRemainingPoQty = (reason: string): boolean => {
    const trimmed = reason.trim();
    return trimmed !== '' && trimmed !== PARTIAL_DELIVERY_REASON;
};

export const RR_STATUS_COLORS: Record<string, string> = {
    Draft: 'bg-gray-100 text-gray-800',
    Unposted: 'bg-amber-100 text-amber-800',
    Posted: 'bg-green-100 text-green-800',
    Cancelled: 'bg-red-100 text-red-800',
};
