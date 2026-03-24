import { Database } from './database.types';

export type PurchaseOrder = Database['public']['Tables']['purchase_orders']['Row'];
export type PurchaseOrderInsert = Database['public']['Tables']['purchase_orders']['Insert'];
export type PurchaseOrderUpdate = Database['public']['Tables']['purchase_orders']['Update'];

export type PurchaseOrderItem = Database['public']['Tables']['purchase_order_items']['Row'];
export type PurchaseOrderItemInsert = Database['public']['Tables']['purchase_order_items']['Insert'];
export type PurchaseOrderItemUpdate = Database['public']['Tables']['purchase_order_items']['Update'];

export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];

export type Product = Database['public']['Tables']['products']['Row'];
export type Supplier = Database['public']['Tables']['contacts']['Row'];

export interface PurchaseOrderWithDetails extends PurchaseOrder {
    supplier: Supplier | null;
    items: PurchaseOrderItemWithProduct[];
    creator: { email: string } | null;
    approver: { email: string } | null;
}

export interface PurchaseOrderItemWithProduct extends PurchaseOrderItem {
    product: Product | null;
}

export type POStatus = 'Draft' | 'Pending' | 'Posted' | 'Partial Delivery' | 'Cancelled';

export const PO_STATUS_COLORS: Record<string, string> = {
    Draft: 'bg-gray-100 text-gray-800',
    Pending: 'bg-yellow-100 text-yellow-800',
    Cancelled: 'bg-red-100 text-red-800',
    Posted: 'bg-green-100 text-green-800',
    'Partial Delivery': 'bg-amber-100 text-amber-800',
};
