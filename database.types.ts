export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    graphql_public: {
        Tables: {
            [_ in never]: never
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            graphql: {
                Args: {
                    operationName?: string
                    query?: string
                    variables?: Json
                    extensions?: Json
                }
                Returns: Json
            }
        }
        Enums: {
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
    public: {
        Tables: {
            agent_customer_breakdown: {
                Row: {
                    active_count: number
                    agent_id: string
                    created_at: string
                    date: string
                    id: string
                    inactive_count: number
                    prospective_count: number
                    updated_at: string
                }
                Insert: {
                    active_count?: number
                    agent_id: string
                    created_at?: string
                    date: string
                    id?: string
                    inactive_count?: number
                    prospective_count?: number
                    updated_at?: string
                }
                Update: {
                    active_count?: number
                    agent_id?: string
                    created_at?: string
                    date?: string
                    id?: string
                    inactive_count?: number
                    prospective_count?: number
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "agent_customer_breakdown_agent_id_fkey"
                        columns: ["agent_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            agent_sales_summary: {
                Row: {
                    agent_id: string
                    created_at: string
                    date: string
                    id: string
                    sales_count: number
                    total_sales: number
                    updated_at: string
                }
                Insert: {
                    agent_id: string
                    created_at?: string
                    date: string
                    id?: string
                    sales_count?: number
                    total_sales?: number
                    updated_at?: string
                }
                Update: {
                    agent_id?: string
                    created_at?: string
                    date?: string
                    id?: string
                    sales_count?: number
                    total_sales?: number
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "agent_sales_summary_agent_id_fkey"
                        columns: ["agent_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            branch_inventory_transfer_items: {
                Row: {
                    branches: string | null
                    created_at: string
                    description: string | null
                    id: string
                    item_code: string | null
                    item_id: string | null
                    part_number: string | null
                    qty_transferred: number | null
                    transfer_id: string | null
                }
                Insert: {
                    branches?: string | null
                    created_at?: string
                    description?: string | null
                    id?: string
                    item_code?: string | null
                    item_id?: string | null
                    part_number?: string | null
                    qty_transferred?: number | null
                    transfer_id?: string | null
                }
                Update: {
                    branches?: string | null
                    created_at?: string
                    description?: string | null
                    id?: string
                    item_code?: string | null
                    item_id?: string | null
                    part_number?: string | null
                    qty_transferred?: number | null
                    transfer_id?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "branch_inventory_transfer_items_item_id_fkey"
                        columns: ["item_id"]
                        isOneToOne: false
                        referencedRelation: "products"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "branch_inventory_transfer_items_transfer_id_fkey"
                        columns: ["transfer_id"]
                        isOneToOne: false
                        referencedRelation: "branch_inventory_transfers"
                        referencedColumns: ["id"]
                    },
                ]
            }
            branch_inventory_transfers: {
                Row: {
                    approved_by: string | null
                    created_at: string
                    created_by: string | null
                    destination_branch: string | null
                    id: string
                    notes: string | null
                    received_by: string | null
                    reference_no: string | null
                    source_branch: string | null
                    status: string
                    transfer_date: string | null
                    updated_at: string | null
                }
                Insert: {
                    approved_by?: string | null
                    created_at?: string
                    created_by?: string | null
                    destination_branch?: string | null
                    id?: string
                    notes?: string | null
                    received_by?: string | null
                    reference_no?: string | null
                    source_branch?: string | null
                    status?: string
                    transfer_date?: string | null
                    updated_at?: string | null
                }
                Update: {
                    approved_by?: string | null
                    created_at?: string
                    created_by?: string | null
                    destination_branch?: string | null
                    id?: string
                    notes?: string | null
                    received_by?: string | null
                    reference_no?: string | null
                    source_branch?: string | null
                    status?: string
                    transfer_date?: string | null
                    updated_at?: string | null
                }
                Relationships: []
            }
            call_logs: {
                Row: {
                    agent: string
                    contact_id: string | null
                    created_at: string
                    date: string
                    duration: string | null
                    id: string
                    notes: string | null
                    outcome: string
                    timestamp: string
                    title: string | null
                    type: string
                }
                Insert: {
                    agent: string
                    contact_id?: string | null
                    created_at?: string
                    date: string
                    duration?: string | null
                    id?: string
                    notes?: string | null
                    outcome: string
                    timestamp: string
                    title?: string | null
                    type: string
                }
                Update: {
                    agent?: string
                    contact_id?: string | null
                    created_at?: string
                    date?: string
                    duration?: string | null
                    id?: string
                    notes?: string | null
                    outcome?: string
                    timestamp?: string
                    title?: string | null
                    type?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "call_logs_contact_id_fkey"
                        columns: ["contact_id"]
                        isOneToOne: false
                        referencedRelation: "contacts"
                        referencedColumns: ["id"]
                    },
                ]
            }
            contacts: {
                Row: {
                    address: string | null
                    aiReasoning: string | null
                    aiScore: number | null
                    area: string | null
                    assignedAgent: string | null
                    avatar: string | null
                    balance: number | null
                    businessLine: string | null
                    city: string | null
                    comment: string | null
                    comments: Json | null
                    company: string
                    contactPersons: Json | null
                    created_at: string | null
                    creditLimit: number | null
                    customerSince: string | null
                    dealershipQuota: number | null
                    dealershipSince: string | null
                    dealershipTerms: string | null
                    dealValue: number | null
                    debtType: string | null
                    deleted_at: string | null
                    deliveryAddress: string | null
                    email: string | null
                    id: string
                    interactions: Json | null
                    is_deleted: boolean | null
                    isHidden: boolean | null
                    lastContactDate: string | null
                    mobile: string | null
                    name: string | null
                    nextBestAction: string | null
                    officeAddress: string | null
                    pastName: string | null
                    phone: string | null
                    priceGroup: string | null
                    province: string | null
                    referBy: string | null
                    salesByYear: Json | null
                    salesHistory: Json | null
                    salesman: string | null
                    shippingAddress: string | null
                    stage: string | null
                    status: string | null
                    team: string | null
                    terms: string | null
                    tin: string | null
                    title: string | null
                    topProducts: Json | null
                    totalSales: number | null
                    transactionType: string | null
                    updated_at: string | null
                    vatPercentage: string | null
                    vatType: string | null
                    winProbability: number | null
                }
                Insert: {
                    address?: string | null
                    aiReasoning?: string | null
                    aiScore?: number | null
                    area?: string | null
                    assignedAgent?: string | null
                    avatar?: string | null
                    balance?: number | null
                    businessLine?: string | null
                    city?: string | null
                    comment?: string | null
                    comments?: Json | null
                    company: string
                    contactPersons?: Json | null
                    created_at?: string | null
                    creditLimit?: number | null
                    customerSince?: string | null
                    dealershipQuota?: number | null
                    dealershipSince?: string | null
                    dealershipTerms?: string | null
                    dealValue?: number | null
                    debtType?: string | null
                    deleted_at?: string | null
                    deliveryAddress?: string | null
                    email?: string | null
                    id?: string
                    interactions?: Json | null
                    is_deleted?: boolean | null
                    isHidden?: boolean | null
                    lastContactDate?: string | null
                    mobile?: string | null
                    name?: string | null
                    nextBestAction?: string | null
                    officeAddress?: string | null
                    pastName?: string | null
                    phone?: string | null
                    priceGroup?: string | null
                    province?: string | null
                    referBy?: string | null
                    salesByYear?: Json | null
                    salesHistory?: Json | null
                    salesman?: string | null
                    shippingAddress?: string | null
                    stage?: string | null
                    status?: string | null
                    team?: string | null
                    terms?: string | null
                    tin?: string | null
                    title?: string | null
                    topProducts?: Json | null
                    totalSales?: number | null
                    transactionType?: string | null
                    updated_at?: string | null
                    vatPercentage?: string | null
                    vatType?: string | null
                    winProbability?: number | null
                }
                Update: {
                    address?: string | null
                    aiReasoning?: string | null
                    aiScore?: number | null
                    area?: string | null
                    assignedAgent?: string | null
                    avatar?: string | null
                    balance?: number | null
                    businessLine?: string | null
                    city?: string | null
                    comment?: string | null
                    comments?: Json | null
                    company?: string
                    contactPersons?: Json | null
                    created_at?: string | null
                    creditLimit?: number | null
                    customerSince?: string | null
                    dealershipQuota?: number | null
                    dealershipSince?: string | null
                    dealershipTerms?: string | null
                    dealValue?: number | null
                    debtType?: string | null
                    deleted_at?: string | null
                    deliveryAddress?: string | null
                    email?: string | null
                    id?: string
                    interactions?: Json | null
                    is_deleted?: boolean | null
                    isHidden?: boolean | null
                    lastContactDate?: string | null
                    mobile?: string | null
                    name?: string | null
                    nextBestAction?: string | null
                    officeAddress?: string | null
                    pastName?: string | null
                    phone?: string | null
                    priceGroup?: string | null
                    province?: string | null
                    referBy?: string | null
                    salesByYear?: Json | null
                    salesHistory?: Json | null
                    salesman?: string | null
                    shippingAddress?: string | null
                    stage?: string | null
                    status?: string | null
                    team?: string | null
                    terms?: string | null
                    tin?: string | null
                    title?: string | null
                    topProducts?: Json | null
                    totalSales?: number | null
                    transactionType?: string | null
                    updated_at?: string | null
                    vatPercentage?: string | null
                    vatType?: string | null
                    winProbability?: number | null
                }
                Relationships: []
            }
            inventory_logs: {
                Row: {
                    created_at: string | null
                    date: string | null
                    deleted_at: string | null
                    id: string
                    is_deleted: boolean | null
                    item_id: string | null
                    notes: string | null
                    partner: string | null
                    processed_by: string | null
                    qty_in: number | null
                    qty_out: number | null
                    reference_no: string | null
                    status_indicator: string | null
                    transaction_type: string | null
                    unit_price: number | null
                    updated_at: string | null
                    warehouse_id: string | null
                }
                Insert: {
                    created_at?: string | null
                    date?: string | null
                    deleted_at?: string | null
                    id?: string
                    is_deleted?: boolean | null
                    item_id?: string | null
                    notes?: string | null
                    partner?: string | null
                    processed_by?: string | null
                    qty_in?: number | null
                    qty_out?: number | null
                    reference_no?: string | null
                    status_indicator?: string | null
                    transaction_type?: string | null
                    unit_price?: number | null
                    updated_at?: string | null
                    warehouse_id?: string | null
                }
                Update: {
                    created_at?: string | null
                    date?: string | null
                    deleted_at?: string | null
                    id?: string
                    is_deleted?: boolean | null
                    item_id?: string | null
                    notes?: string | null
                    partner?: string | null
                    processed_by?: string | null
                    qty_in?: number | null
                    qty_out?: number | null
                    reference_no?: string | null
                    status_indicator?: string | null
                    transaction_type?: string | null
                    unit_price?: number | null
                    updated_at?: string | null
                    warehouse_id?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "inventory_logs_item_id_fkey"
                        columns: ["item_id"]
                        isOneToOne: false
                        referencedRelation: "products"
                        referencedColumns: ["id"]
                    },
                ]
            }
            invoice_items: {
                Row: {
                    created_at: string | null
                    description: string | null
                    discount: number | null
                    discount_amount: number | null
                    id: string
                    invoice_id: string | null
                    item_id: string | null
                    net_price: number | null
                    quantity: number | null
                    unit_price: number | null
                }
                Insert: {
                    created_at?: string | null
                    description?: string | null
                    discount?: number | null
                    discount_amount?: number | null
                    id?: string
                    invoice_id?: string | null
                    item_id?: string | null
                    net_price?: number | null
                    quantity?: number | null
                    unit_price?: number | null
                }
                Update: {
                    created_at?: string | null
                    description?: string | null
                    discount?: number | null
                    discount_amount?: number | null
                    id?: string
                    invoice_id?: string | null
                    item_id?: string | null
                    net_price?: number | null
                    quantity?: number | null
                    unit_price?: number | null
                }
                Relationships: [
                    {
                        foreignKeyName: "invoice_items_invoice_id_fkey"
                        columns: ["invoice_id"]
                        isOneToOne: false
                        referencedRelation: "invoices"
                        referencedColumns: ["id"]
                    },
                ]
            }
            invoices: {
                Row: {
                    amount_paid: number
                    balance: number
                    contact_id: string | null
                    created_at: string | null
                    created_by: string | null
                    customer_address: string | null
                    customer_name: string | null
                    deleted_at: string | null
                    due_date: string | null
                    id: string
                    invoice_date: string | null
                    invoice_number: string
                    is_deleted: boolean | null
                    payment_status: string
                    reference_number: string | null
                    status: string
                    subtotal: number
                    tax_amount: number
                    terms: string | null
                    total_amount: number
                    updated_at: string | null
                }
                Insert: {
                    amount_paid?: number
                    balance?: number
                    contact_id?: string | null
                    created_at?: string | null
                    created_by?: string | null
                    customer_address?: string | null
                    customer_name?: string | null
                    deleted_at?: string | null
                    due_date?: string | null
                    id?: string
                    invoice_date?: string | null
                    invoice_number: string
                    is_deleted?: boolean | null
                    payment_status?: string
                    reference_number?: string | null
                    status?: string
                    subtotal?: number
                    tax_amount?: number
                    terms?: string | null
                    total_amount?: number
                    updated_at?: string | null
                }
                Update: {
                    amount_paid?: number
                    balance?: number
                    contact_id?: string | null
                    created_at?: string | null
                    created_by?: string | null
                    customer_address?: string | null
                    customer_name?: string | null
                    deleted_at?: string | null
                    due_date?: string | null
                    id?: string
                    invoice_date?: string | null
                    invoice_number?: string
                    is_deleted?: boolean | null
                    payment_status?: string
                    reference_number?: string | null
                    status?: string
                    subtotal?: number
                    tax_amount?: number
                    terms?: string | null
                    total_amount?: number
                    updated_at?: string | null
                }
                Relationships: []
            }
            order_slip_items: {
                Row: {
                    amount: number | null
                    created_at: string | null
                    description: string | null
                    id: string
                    item_id: string | null
                    order_slip_id: string | null
                    part_no: string | null
                    price: number | null
                    quantity: number | null
                    stock: number | null
                    unit: string | null
                }
                Insert: {
                    amount?: number | null
                    created_at?: string | null
                    description?: string | null
                    id?: string
                    item_id?: string | null
                    order_slip_id?: string | null
                    part_no?: string | null
                    price?: number | null
                    quantity?: number | null
                    stock?: number | null
                    unit?: string | null
                }
                Update: {
                    amount?: number | null
                    created_at?: string | null
                    description?: string | null
                    id?: string
                    item_id?: string | null
                    order_slip_id?: string | null
                    part_no?: string | null
                    price?: number | null
                    quantity?: number | null
                    stock?: number | null
                    unit?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "order_slip_items_item_id_fkey"
                        columns: ["item_id"]
                        isOneToOne: false
                        referencedRelation: "products"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "order_slip_items_order_slip_id_fkey"
                        columns: ["order_slip_id"]
                        isOneToOne: false
                        referencedRelation: "order_slips"
                        referencedColumns: ["id"]
                    },
                ]
            }
            order_slips: {
                Row: {
                    created_at: string | null
                    created_by: string | null
                    customer_id: string | null
                    customer_name: string | null
                    date: string | null
                    deleted_at: string | null
                    discount: number | null
                    grand_total: number | null
                    id: string
                    is_deleted: boolean | null
                    order_slip_type: string | null
                    os_number: string
                    payment_method: string | null
                    remarks: string | null
                    status: string | null
                    terms: string | null
                    total_amount: number | null
                    updated_at: string | null
                }
                Insert: {
                    created_at?: string | null
                    created_by?: string | null
                    customer_id?: string | null
                    customer_name?: string | null
                    date?: string | null
                    deleted_at?: string | null
                    discount?: number | null
                    grand_total?: number | null
                    id?: string
                    is_deleted?: boolean | null
                    order_slip_type?: string | null
                    os_number: string
                    payment_method?: string | null
                    remarks?: string | null
                    status?: string | null
                    terms?: string | null
                    total_amount?: number | null
                    updated_at?: string | null
                }
                Update: {
                    created_at?: string | null
                    created_by?: string | null
                    customer_id?: string | null
                    customer_name?: string | null
                    date?: string | null
                    deleted_at?: string | null
                    discount?: number | null
                    grand_total?: number | null
                    id?: string
                    is_deleted?: boolean | null
                    order_slip_type?: string | null
                    os_number?: string
                    payment_method?: string | null
                    remarks?: string | null
                    status?: string | null
                    terms?: string | null
                    total_amount?: number | null
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "order_slips_customer_id_fkey"
                        columns: ["customer_id"]
                        isOneToOne: false
                        referencedRelation: "contacts"
                        referencedColumns: ["id"]
                    },
                ]
            }
            products: {
                Row: {
                    application: string | null
                    brand: string | null
                    category: string | null
                    cost: number | null
                    created_at: string | null
                    date_added: string | null
                    deleted_at: string | null
                    description: string | null
                    description_2: string | null
                    enc_date: string | null
                    engine_no: string | null
                    id: string
                    id_no: number
                    image_url: string | null
                    inv_history: Json | null
                    is_deleted: boolean | null
                    item_code: string | null
                    location: string | null
                    notes: string | null
                    part_no: string | null
                    prices: Json | null
                    product_name: string | null
                    reorder_level: number | null
                    size: string | null
                    srp: number | null
                    stock: number | null
                    stock_main: number | null
                    stock_showroom: number | null
                    stock_wh6: number | null
                    supplier: string | null
                    unit: string | null
                    updated_at: string | null
                }
                Insert: {
                    application?: string | null
                    brand?: string | null
                    category?: string | null
                    cost?: number | null
                    created_at?: string | null
                    date_added?: string | null
                    deleted_at?: string | null
                    description?: string | null
                    description_2?: string | null
                    enc_date?: string | null
                    engine_no?: string | null
                    id?: string
                    id_no?: number
                    image_url?: string | null
                    inv_history?: Json | null
                    is_deleted?: boolean | null
                    item_code?: string | null
                    location?: string | null
                    notes?: string | null
                    part_no?: string | null
                    prices?: Json | null
                    product_name?: string | null
                    reorder_level?: number | null
                    size?: string | null
                    srp?: number | null
                    stock?: number | null
                    stock_main?: number | null
                    stock_showroom?: number | null
                    stock_wh6?: number | null
                    supplier?: string | null
                    unit?: string | null
                    updated_at?: string | null
                }
                Update: {
                    application?: string | null
                    brand?: string | null
                    category?: string | null
                    cost?: number | null
                    created_at?: string | null
                    date_added?: string | null
                    deleted_at?: string | null
                    description?: string | null
                    description_2?: string | null
                    enc_date?: string | null
                    engine_no?: string | null
                    id?: string
                    id_no?: number
                    image_url?: string | null
                    inv_history?: Json | null
                    is_deleted?: boolean | null
                    item_code?: string | null
                    location?: string | null
                    notes?: string | null
                    part_no?: string | null
                    prices?: Json | null
                    product_name?: string | null
                    reorder_level?: number | null
                    size?: string | null
                    srp?: number | null
                    stock?: number | null
                    stock_main?: number | null
                    stock_showroom?: number | null
                    stock_wh6?: number | null
                    supplier?: string | null
                    unit?: string | null
                    updated_at?: string | null
                }
                Relationships: []
            }
            profile_creation_logs: {
                Row: {
                    created_at: string | null
                    creator_id: string | null
                    email: string | null
                    error: string | null
                    full_name: string | null
                    id: string
                    role: string | null
                    status: string | null
                }
                Insert: {
                    created_at?: string | null
                    creator_id?: string | null
                    email?: string | null
                    error?: string | null
                    full_name?: string | null
                    id?: string
                    role?: string | null
                    status?: string | null
                }
                Update: {
                    created_at?: string | null
                    creator_id?: string | null
                    email?: string | null
                    error?: string | null
                    full_name?: string | null
                    id?: string
                    role?: string | null
                    status?: string | null
                }
                Relationships: []
            }
            profiles: {
                Row: {
                    access_rights: Json
                    avatar_url: string | null
                    created_at: string
                    email: string
                    full_name: string | null
                    id: string
                    role: string
                    updated_at: string
                }
                Insert: {
                    access_rights?: Json
                    avatar_url?: string | null
                    created_at?: string
                    email: string
                    full_name?: string | null
                    id: string
                    role?: string
                    updated_at?: string
                }
                Update: {
                    access_rights?: Json
                    avatar_url?: string | null
                    created_at?: string
                    email?: string
                    full_name?: string | null
                    id?: string
                    role?: string
                    updated_at?: string
                }
                Relationships: []
            }
            purchase_history: {
                Row: {
                    amount: number | null
                    created_at: string
                    date: string
                    id: string
                    item_id: string | null
                    price: number | null
                    quantity: number | null
                    supplier: string | null
                }
                Insert: {
                    amount?: number | null
                    created_at?: string
                    date: string
                    id?: string
                    item_id?: string | null
                    price?: number | null
                    quantity?: number | null
                    supplier?: string | null
                }
                Update: {
                    amount?: number | null
                    created_at?: string
                    date?: string
                    id?: string
                    item_id?: string | null
                    price?: number | null
                    quantity?: number | null
                    supplier?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "purchase_history_item_id_fkey"
                        columns: ["item_id"]
                        isOneToOne: false
                        referencedRelation: "products"
                        referencedColumns: ["id"]
                    },
                ]
            }
            purchase_order_items: {
                Row: {
                    amount: number | null
                    created_at: string | null
                    description: string | null
                    id: string
                    item_code: string | null
                    item_id: string | null
                    notes: string | null
                    part_no: string | null
                    po_id: string | null
                    qty_ordered: number | null
                    qty_received: number | null
                    status: string | null
                    unit_cost: number | null
                }
                Insert: {
                    amount?: number | null
                    created_at?: string | null
                    description?: string | null
                    id?: string
                    item_code?: string | null
                    item_id?: string | null
                    notes?: string | null
                    part_no?: string | null
                    po_id?: string | null
                    qty_ordered?: number | null
                    qty_received?: number | null
                    status?: string | null
                    unit_cost?: number | null
                }
                Update: {
                    amount?: number | null
                    created_at?: string | null
                    description?: string | null
                    id?: string
                    item_code?: string | null
                    item_id?: string | null
                    notes?: string | null
                    part_no?: string | null
                    po_id?: string | null
                    qty_ordered?: number | null
                    qty_received?: number | null
                    status?: string | null
                    unit_cost?: number | null
                }
                Relationships: [
                    {
                        foreignKeyName: "purchase_order_items_item_id_fkey"
                        columns: ["item_id"]
                        isOneToOne: false
                        referencedRelation: "products"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "purchase_order_items_po_id_fkey"
                        columns: ["po_id"]
                        isOneToOne: false
                        referencedRelation: "purchase_orders"
                        referencedColumns: ["id"]
                    },
                ]
            }
            purchase_orders: {
                Row: {
                    created_at: string | null
                    created_by: string | null
                    deleted_at: string | null
                    expected_date: string | null
                    grand_total: number | null
                    id: string
                    is_deleted: boolean | null
                    po_date: string
                    po_number: string
                    reference_no: string | null
                    remarks: string | null
                    status: string | null
                    supplier_id: string | null
                    supplier_name: string | null
                    updated_at: string | null
                }
                Insert: {
                    created_at?: string | null
                    created_by?: string | null
                    deleted_at?: string | null
                    expected_date?: string | null
                    grand_total?: number | null
                    id?: string
                    is_deleted?: boolean | null
                    po_date?: string
                    po_number: string
                    reference_no?: string | null
                    remarks?: string | null
                    status?: string | null
                    supplier_id?: string | null
                    supplier_name?: string | null
                    updated_at?: string | null
                }
                Update: {
                    created_at?: string | null
                    created_by?: string | null
                    deleted_at?: string | null
                    expected_date?: string | null
                    grand_total?: number | null
                    id?: string
                    is_deleted?: boolean | null
                    po_date?: string
                    po_number?: string
                    reference_no?: string | null
                    remarks?: string | null
                    status?: string | null
                    supplier_id?: string | null
                    supplier_name?: string | null
                    updated_at?: string | null
                }
                Relationships: []
            }
            purchase_request_items: {
                Row: {
                    created_at: string | null
                    description: string | null
                    id: string
                    item_code: string | null
                    item_id: string | null
                    part_no: string | null
                    pr_id: string | null
                    qty_approved: number | null
                    qty_ordered: number | null
                    qty_requested: number | null
                    reason_for_rejection: string | null
                    status: string | null
                    unit_cost: number | null
                }
                Insert: {
                    created_at?: string | null
                    description?: string | null
                    id?: string
                    item_code?: string | null
                    item_id?: string | null
                    part_no?: string | null
                    pr_id?: string | null
                    qty_approved?: number | null
                    qty_ordered?: number | null
                    qty_requested?: number | null
                    reason_for_rejection?: string | null
                    status?: string | null
                    unit_cost?: number | null
                }
                Update: {
                    created_at?: string | null
                    description?: string | null
                    id?: string
                    item_code?: string | null
                    item_id?: string | null
                    part_no?: string | null
                    pr_id?: string | null
                    qty_approved?: number | null
                    qty_ordered?: number | null
                    qty_requested?: number | null
                    reason_for_rejection?: string | null
                    status?: string | null
                    unit_cost?: number | null
                }
                Relationships: [
                    {
                        foreignKeyName: "purchase_request_items_item_id_fkey"
                        columns: ["item_id"]
                        isOneToOne: false
                        referencedRelation: "products"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "purchase_request_items_pr_id_fkey"
                        columns: ["pr_id"]
                        isOneToOne: false
                        referencedRelation: "purchase_requests"
                        referencedColumns: ["id"]
                    },
                ]
            }
            purchase_requests: {
                Row: {
                    approved_at: string | null
                    approved_by: string | null
                    created_at: string | null
                    created_by: string | null
                    deleted_at: string | null
                    id: string
                    is_deleted: boolean | null
                    logs: Json | null
                    notes: string | null
                    pr_date: string
                    pr_number: string
                    priority: string | null
                    reason_for_purchasing: string | null
                    requested_by: string | null
                    status: string | null
                    total_estimated_cost: number | null
                    updated_at: string | null
                }
                Insert: {
                    approved_at?: string | null
                    approved_by?: string | null
                    created_at?: string | null
                    created_by?: string | null
                    deleted_at?: string | null
                    id?: string
                    is_deleted?: boolean | null
                    logs?: Json | null
                    notes?: string | null
                    pr_date?: string
                    pr_number: string
                    priority?: string | null
                    reason_for_purchasing?: string | null
                    requested_by?: string | null
                    status?: string | null
                    total_estimated_cost?: number | null
                    updated_at?: string | null
                }
                Update: {
                    approved_at?: string | null
                    approved_by?: string | null
                    created_at?: string | null
                    created_by?: string | null
                    deleted_at?: string | null
                    id?: string
                    is_deleted?: boolean | null
                    logs?: Json | null
                    notes?: string | null
                    pr_date?: string
                    pr_number?: string
                    priority?: string | null
                    reason_for_purchasing?: string | null
                    requested_by?: string | null
                    status?: string | null
                    total_estimated_cost?: number | null
                    updated_at?: string | null
                }
                Relationships: []
            }
            purchases: {
                Row: {
                    amount: number | null
                    created_at: string
                    date: string
                    id: string
                    item_id: string | null
                    price: number | null
                    quantity: number | null
                    supplier: string | null
                }
                Insert: {
                    amount?: number | null
                    created_at?: string
                    date: string
                    id?: string
                    item_id?: string | null
                    price?: number | null
                    quantity?: number | null
                    supplier?: string | null
                }
                Update: {
                    amount?: number | null
                    created_at?: string
                    date?: string
                    id?: string
                    item_id?: string | null
                    price?: number | null
                    quantity?: number | null
                    supplier?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "purchases_item_id_fkey"
                        columns: ["item_id"]
                        isOneToOne: false
                        referencedRelation: "products"
                        referencedColumns: ["id"]
                    },
                ]
            }
            receiving_report_items: {
                Row: {
                    created_at: string | null
                    description: string | null
                    id: string
                    item_code: string | null
                    item_id: string | null
                    notes: string | null
                    part_no: string | null
                    qty_ordered: number | null
                    qty_received: number | null
                    qty_returned: number | null
                    rr_id: string | null
                    total_amount: number | null
                    unit_cost: number | null
                }
                Insert: {
                    created_at?: string | null
                    description?: string | null
                    id?: string
                    item_code?: string | null
                    item_id?: string | null
                    notes?: string | null
                    part_no?: string | null
                    qty_ordered?: number | null
                    qty_received?: number | null
                    qty_returned?: number | null
                    rr_id?: string | null
                    total_amount?: number | null
                    unit_cost?: number | null
                }
                Update: {
                    created_at?: string | null
                    description?: string | null
                    id?: string
                    item_code?: string | null
                    item_id?: string | null
                    notes?: string | null
                    part_no?: string | null
                    qty_ordered?: number | null
                    qty_received?: number | null
                    qty_returned?: number | null
                    rr_id?: string | null
                    total_amount?: number | null
                    unit_cost?: number | null
                }
                Relationships: [
                    {
                        foreignKeyName: "receiving_report_items_item_id_fkey"
                        columns: ["item_id"]
                        isOneToOne: false
                        referencedRelation: "products"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "receiving_report_items_rr_id_fkey"
                        columns: ["rr_id"]
                        isOneToOne: false
                        referencedRelation: "receiving_reports"
                        referencedColumns: ["id"]
                    },
                ]
            }
            receiving_reports: {
                Row: {
                    created_at: string | null
                    deleted_at: string | null
                    grand_total: number | null
                    id: string
                    is_deleted: boolean | null
                    po_id: string | null
                    po_no: string | null
                    receive_date: string
                    received_by: string | null
                    remarks: string | null
                    rr_no: string
                    status: string | null
                    supplier_id: string | null
                    supplier_name: string | null
                    updated_at: string | null
                    warehouse_id: string
                }
                Insert: {
                    created_at?: string | null
                    deleted_at?: string | null
                    grand_total?: number | null
                    id?: string
                    is_deleted?: boolean | null
                    po_id?: string | null
                    po_no?: string | null
                    receive_date: string
                    received_by?: string | null
                    remarks?: string | null
                    rr_no: string
                    status?: string | null
                    supplier_id?: string | null
                    supplier_name?: string | null
                    updated_at?: string | null
                    warehouse_id: string
                }
                Update: {
                    created_at?: string | null
                    deleted_at?: string | null
                    grand_total?: number | null
                    id?: string
                    is_deleted?: boolean | null
                    po_id?: string | null
                    po_no?: string | null
                    receive_date?: string
                    received_by?: string | null
                    remarks?: string | null
                    rr_no?: string
                    status?: string | null
                    supplier_id?: string | null
                    supplier_name?: string | null
                    updated_at?: string | null
                    warehouse_id?: string
                }
                Relationships: []
            }
            sales_history: {
                Row: {
                    amount: number | null
                    created_at: string
                    customer: string | null
                    date: string
                    id: string
                    item_id: string | null
                    price: number | null
                    quantity: number | null
                }
                Insert: {
                    amount?: number | null
                    created_at?: string
                    customer?: string | null
                    date: string
                    id?: string
                    item_id?: string | null
                    price?: number | null
                    quantity?: number | null
                }
                Update: {
                    amount?: number | null
                    created_at?: string
                    customer?: string | null
                    date?: string
                    id?: string
                    item_id?: string | null
                    price?: number | null
                    quantity?: number | null
                }
                Relationships: [
                    {
                        foreignKeyName: "sales_history_item_id_fkey"
                        columns: ["item_id"]
                        isOneToOne: false
                        referencedRelation: "products"
                        referencedColumns: ["id"]
                    },
                ]
            }
            sales_orders: {
                Row: {
                    created_at: string | null
                    customer_id: string | null
                    delivery_address: string | null
                    grand_total: number
                    id: string
                    sales_rep: string | null
                    so_date: string
                    so_number: string
                    status: string
                }
                Insert: {
                    created_at?: string | null
                    customer_id?: string | null
                    delivery_address?: string | null
                    grand_total?: number
                    id?: string
                    sales_rep?: string | null
                    so_date?: string
                    so_number: string
                    status?: string
                }
                Update: {
                    created_at?: string | null
                    customer_id?: string | null
                    delivery_address?: string | null
                    grand_total?: number
                    id?: string
                    sales_rep?: string | null
                    so_date?: string
                    so_number?: string
                    status?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "sales_orders_customer_id_fkey"
                        columns: ["customer_id"]
                        isOneToOne: false
                        referencedRelation: "contacts"
                        referencedColumns: ["id"]
                    },
                ]
            }
            supplier_return_items: {
                Row: {
                    created_at: string | null
                    description: string | null
                    id: string
                    item_code: string | null
                    item_id: string | null
                    part_no: string | null
                    qty_returned: number
                    remarks: string | null
                    return_id: string
                    return_reason: string | null
                    rr_item_id: string | null
                    total_amount: number | null
                    unit_cost: number | null
                }
                Insert: {
                    created_at?: string | null
                    description?: string | null
                    id?: string
                    item_code?: string | null
                    item_id?: string | null
                    part_no?: string | null
                    qty_returned: number
                    remarks?: string | null
                    return_id: string
                    return_reason?: string | null
                    rr_item_id?: string | null
                    total_amount?: number | null
                    unit_cost?: number | null
                }
                Update: {
                    created_at?: string | null
                    description?: string | null
                    id?: string
                    item_code?: string | null
                    item_id?: string | null
                    part_no?: string | null
                    qty_returned?: number
                    remarks?: string | null
                    return_id?: string
                    return_reason?: string | null
                    rr_item_id?: string | null
                    total_amount?: number | null
                    unit_cost?: number | null
                }
                Relationships: [
                    {
                        foreignKeyName: "supplier_return_items_item_id_fkey"
                        columns: ["item_id"]
                        isOneToOne: false
                        referencedRelation: "products"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "supplier_return_items_return_id_fkey"
                        columns: ["return_id"]
                        isOneToOne: false
                        referencedRelation: "supplier_returns"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "supplier_return_items_rr_item_id_fkey"
                        columns: ["rr_item_id"]
                        isOneToOne: false
                        referencedRelation: "receiving_report_items"
                        referencedColumns: ["id"]
                    },
                ]
            }
            supplier_returns: {
                Row: {
                    created_at: string | null
                    created_by: string | null
                    deleted_at: string | null
                    grand_total: number | null
                    id: string
                    is_deleted: boolean | null
                    notes: string | null
                    reason: string | null
                    reference_no: string | null
                    return_date: string
                    return_no: string
                    return_status: string | null
                    status: string | null
                    supplier_id: string | null
                    supplier_name: string | null
                    updated_at: string | null
                }
                Insert: {
                    created_at?: string | null
                    created_by?: string | null
                    deleted_at?: string | null
                    grand_total?: number | null
                    id?: string
                    is_deleted?: boolean | null
                    notes?: string | null
                    reason?: string | null
                    reference_no?: string | null
                    return_date: string
                    return_no: string
                    return_status?: string | null
                    status?: string | null
                    supplier_id?: string | null
                    supplier_name?: string | null
                    updated_at?: string | null
                }
                Update: {
                    created_at?: string | null
                    created_by?: string | null
                    deleted_at?: string | null
                    grand_total?: number | null
                    id?: string
                    is_deleted?: boolean | null
                    notes?: string | null
                    reason?: string | null
                    reference_no?: string | null
                    return_date?: string
                    return_no?: string
                    return_status?: string | null
                    status?: string | null
                    supplier_id?: string | null
                    supplier_name?: string | null
                    updated_at?: string | null
                }
                Relationships: []
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            finalize_order_slip: {
                Args: {
                    p_order_slip_id: string
                }
                Returns: undefined
            }
            finalize_receiving_report: {
                Args: {
                    p_rr_id: string
                }
                Returns: undefined
            }
            get_monthly_sales_summary: {
                Args: {
                    year_filter?: number
                    month_filter?: number
                }
                Returns: {
                    total_revenue: number
                    total_profit: number
                    sales_growth: number
                }[]
            }
            get_pipeline_stage_summary: {
                Args: Record<string, never>
                Returns: {
                    stage: string
                    count: number
                    value: number
                }[]
            }
            get_top_selling_items: {
                Args: {
                    limit_count?: number
                }
                Returns: {
                    item_id: string
                    item_name: string
                    total_quantity: number
                    total_revenue: number
                }[]
            }
        }
        Enums: {
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}

export type Tables<
    PublicTableNameOrOptions extends
    | keyof (Database["public"]["Tables"] & Database["public"]["Views"])
    | { schema: keyof Database },
    TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
    ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
            Row: infer R
        }
    ? R
    : never
    : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"] &
        Database["public"]["Views"])
    ? (Database["public"]["Tables"] &
        Database["public"]["Views"])[PublicTableNameOrOptions] extends {
            Row: infer R
        }
    ? R
    : never
    : never

export type TablesInsert<
    PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
    TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
    ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
        Insert: infer I
    }
    ? I
    : never
    : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
    }
    ? I
    : never
    : never

export type TablesUpdate<
    PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
    TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
    ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
        Update: infer U
    }
    ? U
    : never
    : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
    }
    ? U
    : never
    : never

export type Enums<
    PublicEnumNameOrOptions extends
    | keyof Database["public"]["Enums"]
    | { schema: keyof Database },
    EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = PublicEnumNameOrOptions extends { schema: keyof Database }
    ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
    : PublicEnumNameOrOptions extends keyof Database["public"]["Enums"]
    ? Database["public"]["Enums"][PublicEnumNameOrOptions]
    : never
