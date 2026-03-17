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
    id: number;
    name: string;
}

export interface RemarkTemplate {
    id: number;
    name: string;
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

export interface SpecialPriceRecord {
    refno: string;
    item_session: string;
    item_code: string;
    part_no: string;
    description: string;
    type: string;
    amount: number;
}

export interface SpecialPriceCustomer {
    patient_refno: string;
    company: string;
    patient_code: string;
}

export interface SpecialPriceArea {
    area_code: string;
    area_name: string;
}

export interface SpecialPriceCategory {
    category_id: string;
    name: string;
}

export interface SpecialPriceDetail extends SpecialPriceRecord {
    customers: SpecialPriceCustomer[];
    areas: SpecialPriceArea[];
    categories: SpecialPriceCategory[];
}

export interface SpecialPriceProduct {
    lsession: string;
    litemcode: string;
    lpartno: string;
    ldescription: string;
}

export interface SpecialPriceCustomerPicker {
    lsessionid: string;
    lcompany: string;
    lpatient_code: string;
}

export interface SpecialPriceAreaPicker {
    code: string;
    name: string;
}

export interface SpecialPriceCategoryPicker {
    id: string;
    name: string;
}
