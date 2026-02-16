export interface Supplier {
    id: string;
    name: string;
    code: string | null;
    remarks: string | null;
    address: string | null;
    contact_person: string | null;
    tin: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface CustomerGroup {
    id: string;
    name: string;
    description: string | null;
    color: string | null;
    created_at?: string;
}

export interface ProductCategory {
    id: string;
    name: string;
    description: string | null;
    parent_id: string | null;
    created_at?: string;
    children?: ProductCategory[]; // For tree view
}

export interface Courier {
    id: string;
    name: string;
    contact_number: string | null;
    details: string | null;
    created_at?: string;
}

export interface RemarkTemplate {
    id: string;
    title: string;
    content: string;
    type: string | null; // e.g. 'invoice', 'purchase_order'
    created_at?: string;
}

export interface Team {
    id: string;
    name: string;
    description: string | null;
    created_at?: string;
}

export interface Approver {
    id: string;
    user_id: string;
    module: string;
    level: number;
    created_at?: string;
    // Joins
    profiles?: {
        full_name: string;
        email: string;
    };
}

export interface ContactPerson {
    id: string;
    contact_id: string;
    name: string;
    position: string | null;
    mobile_number: string | null;
    email: string | null;
    is_primary: boolean;
    created_at?: string;
}

export interface Customer {
    id: string;
    company: string;
    address: string | null;
    tin: string | null;
    priceGroup: string | null;
    customer_group_id: string | null;
    businessLine: string | null;
    terms: string | null;
    transactionType: string | null;
    vatType: string | null;
    creditLimit: number | null;
    status: string | null; // Active, Inactive, Prospect, Blacklisted
    city: string | null;
    province: string | null;
    area: string | null;
    salesman: string | null;
    // Joins
    customer_groups?: {
        name: string;
        color: string;
    };
    contact_persons?: ContactPerson[];
}
