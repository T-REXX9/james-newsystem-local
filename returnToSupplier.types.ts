/*
* Return to Supplier Types
*/

export interface SupplierReturn {
    id: string;
    return_no: string;
    reference_no?: string; // Optional, might be same as return_no or internal ref
    return_type: 'purchase' | 'other';
    return_date: string; // ISO date string
    rr_id?: string;
    rr_no?: string;
    supplier_id: string;
    supplier_name: string;
    po_no?: string;
    status: 'Pending' | 'Posted' | 'Cancelled';
    grand_total: number;
    remarks?: string;
    created_by: string;
    posted_by?: string;
    posted_at?: string;
    created_at: string;
    updated_at?: string;
}

export interface SupplierReturnItem {
    id: string;
    return_id: string;
    rr_item_id?: string;
    item_id: string;
    item_code: string;
    part_no: string;
    description: string;
    qty_returned: number;
    unit_cost: number;
    total_amount: number;
    return_reason: string;
    remarks?: string;
    created_at: string;
}

export interface CreateReturnItemDTO {
    rr_item_id?: string;
    item_id: string;
    item_code: string;
    part_no: string;
    description: string;
    qty_returned: number;
    unit_cost: number;
    total_amount: number;
    return_reason: string;
    remarks?: string;
}

export interface CreateReturnDTO {
    return_date: string;
    return_type: 'purchase';
    rr_id: string;
    rr_no: string;
    supplier_id: string;
    supplier_name: string;
    po_no?: string;
    remarks?: string;
    items: CreateReturnItemDTO[];
}

export interface RRItemForReturn {
    id: string; // receiving_report_items id
    item_id: string;
    item_code: string;
    part_number: string;
    description?: string;
    quantity_received: number;
    unit_cost: number;
    qty_returned_already: number; // Calculated field
}
