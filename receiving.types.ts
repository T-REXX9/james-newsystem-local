import { Database } from './database.types';

export type ReceivingReport = Database['public']['Tables']['receiving_reports']['Row'];
export type ReceivingReportInsert = Database['public']['Tables']['receiving_reports']['Insert'];
export type ReceivingReportUpdate = Database['public']['Tables']['receiving_reports']['Update'];

export type ReceivingReportItem = Database['public']['Tables']['receiving_report_items']['Row'];
export type ReceivingReportItemInsert = Database['public']['Tables']['receiving_report_items']['Insert'];
export type ReceivingReportItemUpdate = Database['public']['Tables']['receiving_report_items']['Update'];

export type Product = Database['public']['Tables']['products']['Row'];
export type Supplier = Database['public']['Tables']['contacts']['Row'];

export interface ReceivingReportWithDetails extends ReceivingReport {
    items: ReceivingReportItemWithProduct[];
}

export interface ReceivingReportItemWithProduct extends ReceivingReportItem {
    product: Product | null;
}

export type RRStatus = 'Draft' | 'Posted' | 'Cancelled';

export const RR_STATUS_COLORS: Record<string, string> = {
    Draft: 'bg-gray-100 text-gray-800',
    Posted: 'bg-green-100 text-green-800',
    Cancelled: 'bg-red-100 text-red-800',
};
