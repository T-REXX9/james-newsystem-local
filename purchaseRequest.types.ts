import { Database } from './database.types';

export type PurchaseRequest = Database['public']['Tables']['purchase_requests']['Row'];
export type PurchaseRequestItem = Database['public']['Tables']['purchase_request_items']['Row'];
export type SupplierItemCost = Database['public']['Tables']['supplier_item_costs']['Row'];
export type Product = Database['public']['Tables']['products']['Row'];
export type Contact = Database['public']['Tables']['contacts']['Row'];

export type PRStatus = 'Draft' | 'Pending' | 'Approved' | 'Submitted' | 'Unposted' | 'Cancelled';

export type PurchaseRequestRecommendation = 'Good' | 'Review Supplier';

export interface PurchaseRequestWithItems extends PurchaseRequest {
    items: PurchaseRequestItem[];
    item_count?: number;
    total_qty?: number;
    total_cost?: number;
    created_by_name?: string;
    cycle_status?: 'Pending' | 'PO Created' | 'Partially Fulfilled' | 'Completed';
    ordered_qty?: number;
    received_qty?: number;
    remaining_qty?: number;
    incomplete_delivery_reason?: string;
}

export interface CreatePRItemPayload {
    item_id?: string;
    item_code?: string;
    part_number?: string;
    original_part_no?: string;
    brand?: string;
    description?: string;
    quantity: number;
    unit?: string;
    unit_cost?: number;
    supplier_id?: string;
    supplier_name?: string;
    eta_date?: string;
    sr_cases?: number;
    ir_cases?: number;
    recommendation?: PurchaseRequestRecommendation;
}

export interface CreatePRPayload {
    pr_number: string;
    request_date: string;
    notes?: string;
    items: CreatePRItemPayload[];
    reference_no?: string;
    status?: 'Draft' | 'Pending';
}

export interface UpdatePRPayload {
    request_date?: string;
    notes?: string;
    status?: string;
    reference_no?: string;
}
