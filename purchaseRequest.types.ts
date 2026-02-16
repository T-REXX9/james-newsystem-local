import { Database } from './database.types';

export type PurchaseRequest = Database['public']['Tables']['purchase_requests']['Row'];
export type PurchaseRequestItem = Database['public']['Tables']['purchase_request_items']['Row'];
export type SupplierItemCost = Database['public']['Tables']['supplier_item_costs']['Row'];
export type Product = Database['public']['Tables']['products']['Row'];
export type Contact = Database['public']['Tables']['contacts']['Row'];

export type PRStatus = 'Draft' | 'Pending' | 'Approved' | 'Submitted' | 'Cancelled';

export interface PurchaseRequestWithItems extends PurchaseRequest {
    items: PurchaseRequestItem[];
}

export interface CreatePRItemPayload {
    item_id?: string;
    item_code?: string;
    part_number?: string;
    description?: string;
    quantity: number;
    unit_cost?: number;
    supplier_id?: string;
    supplier_name?: string;
    eta_date?: string;
}

export interface CreatePRPayload {
    pr_number: string;
    request_date: string;
    notes?: string;
    items: CreatePRItemPayload[];
    reference_no?: string;
}

export interface UpdatePRPayload {
    request_date?: string;
    notes?: string;
    status?: string;
    reference_no?: string;
}
