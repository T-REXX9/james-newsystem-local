// services/inquiryAlertService.ts
import { supabase } from './supabaseService';

export interface InquiryAlert {
    item_code: string;
    part_no: string | null;
    description: string | null;
    inquiry_count: number;
    unique_customers: number;
    last_inquiry_date: string;
    total_inquiry_value: number;
    avg_inquiry_price: number;
}

export interface InquiryAlertWithDetails extends InquiryAlert {
    inquiries?: Array<{
        inquiry_no: string;
        contact_name: string;
        sales_date: string;
        sales_person: string;
        qty: number;
        unit_price: number;
        amount: number;
    }>;
}

/**
 * Fetches all current products with 2+ inquiries and 0 purchases in the last 30 days
 */
export async function getInquiryAlerts(): Promise<InquiryAlert[]> {
    const { data, error } = await (supabase as any)
        .from('product_inquiry_alerts')
        .select('*')
        .order('inquiry_count', { ascending: false });

    if (error) {
        console.error('Error fetching inquiry alerts:', error);
        throw error;
    }

    return data || [];
}

/**
 * Fetches detailed inquiry information for a specific product
 */
export async function getInquiryAlertDetails(itemCode: string): Promise<InquiryAlertWithDetails> {
    // First get the alert summary
    const { data: alertData, error: alertError } = await (supabase as any)
        .from('product_inquiry_alerts')
        .select('*')
        .eq('item_code', itemCode)
        .single();

    if (alertError) {
        console.error('Error fetching inquiry alert details:', alertError);
        throw alertError;
    }

    // Then get detailed inquiry information
    const { data: inquiryData, error: inquiryError } = await supabase
        .from('sales_inquiry_items')
        .select(`
      qty,
      unit_price,
      amount,
      sales_inquiries!inner (
        inquiry_no,
        sales_date,
        sales_person,
        contacts!inner (
          name
        )
      )
    `)
        .eq('item_code', itemCode)
        .gte('sales_inquiries.sales_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .is('sales_inquiries.deleted_at', null);

    if (inquiryError) {
        console.error('Error fetching inquiry details:', inquiryError);
        throw inquiryError;
    }

    // Transform the data
    const inquiries = inquiryData?.map((item: any) => ({
        inquiry_no: item.sales_inquiries.inquiry_no,
        contact_name: item.sales_inquiries.contacts?.name || 'Unknown',
        sales_date: item.sales_inquiries.sales_date,
        sales_person: item.sales_inquiries.sales_person,
        qty: item.qty,
        unit_price: item.unit_price,
        amount: item.amount,
    })) || [];

    return {
        ...alertData,
        inquiries,
    };
}

/**
 * Manually refreshes the materialized view
 */
export async function refreshInquiryAlerts(): Promise<void> {
    const { error } = await (supabase as any).rpc('refresh_inquiry_alerts_materialized_view');

    if (error) {
        console.error('Error refreshing inquiry alerts:', error);
        throw error;
    }
}

/**
 * Marks an inquiry alert as dismissed by marking the related notification as read
 */
export async function dismissInquiryAlert(itemCode: string, userId: string): Promise<void> {
    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('recipient_id', userId)
        .eq('type', 'warning')
        .eq('metadata->>alert_type', 'inquiry_threshold')
        .eq('metadata->>item_code', itemCode);

    if (error) {
        console.error('Error dismissing inquiry alert:', error);
        throw error;
    }
}

/**
 * Gets count of active inquiry alerts
 */
export async function getInquiryAlertCount(): Promise<number> {
    const { count, error } = await (supabase as any)
        .from('product_inquiry_alerts')
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error('Error fetching inquiry alert count:', error);
        throw error;
    }

    return count || 0;
}
