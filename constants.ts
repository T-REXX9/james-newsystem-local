

import { Contact, DealStage, PipelineDeal, PipelineColumn, CustomerStatus, Product, Task, ReorderReportEntry, CallLogEntry, Inquiry, Purchase, TeamMessage, Notification } from './types';

// Default access rights are expressed in terms of canonical hierarchical module IDs
export const DEFAULT_STAFF_ACCESS_RIGHTS = [
  'home',
  'sales-pipeline-board',
  'sales-database-customer-database',
  'sales-transaction-sales-inquiry',
  'sales-transaction-sales-order',
  'sales-transaction-order-slip',
  'sales-transaction-invoice',
  'sales-transaction-product-promotions',
  'sales-reports-inquiry-report',
  'sales-reports-sales-report',
  'sales-reports-sales-development-report',
  'warehouse-inventory-stock-movement',
  'warehouse-inventory-product-database',
  'warehouse-inventory-transfer-stock',
  'warehouse-inventory-inventory-audit',
  'warehouse-purchasing-purchase-request',
  'warehouse-purchasing-purchase-order',
  'warehouse-purchasing-receiving-stock',
  'warehouse-purchasing-return-to-supplier',
  'warehouse-reports-inventory-report',
  'warehouse-reports-reorder-report',
  'warehouse-reports-item-suggested-for-stock-report',
  'warehouse-reports-fast-slow-inventory-report',
  'accounting-transactions-freight-charges-debit',
  'accounting-transactions-sales-return-credit',
  'accounting-transactions-adjustment-entry',
  'accounting-transactions-daily-collection-entry',
  'accounting-accounting-customer-ledger',
  'accounting-accounting-collection-summary',
  'accounting-accounting-statement-of-account',
  'accounting-accounting-accounts-receivable',
  'accounting-reports-accounting-overview',
  'accounting-reports-aging-report',
  'accounting-reports-collection-report',
  'accounting-reports-sales-return-report',
  'accounting-reports-accounts-receivable-report',
  'accounting-reports-freight-charges-report',
  'accounting-reports-purchase-history',
  'accounting-reports-inactive-active-customers',
  'accounting-reports-old-new-customers',
  'accounting-reports-old-new-customers',
  'sales-transaction-daily-call-monitoring',
  'communication-messaging-inbox',
  'communication-text-menu-text-messages',
  'communication-text-menu-inbox',
  'communication-text-menu-sent',
  'communication-text-menu-pending',
  'communication-text-menu-failed',
  'communication-text-menu-operator',
  'communication-productivity-calendar',
  'communication-productivity-daily-call-monitoring',
  'communication-productivity-tasks',
  'maintenance-customer-customer-data',

  'maintenance-customer-customer-group',
  'maintenance-customer-pipeline',
  'maintenance-product-suppliers',
  'maintenance-product-special-price',
  'maintenance-product-category-management',
  'maintenance-product-courier-management',
  'maintenance-product-remark-templates',
  'maintenance-profile-staff',
  'maintenance-profile-team',
  'maintenance-profile-approver',
  'maintenance-profile-activity-logs',
  'maintenance-profile-system-access',
  'maintenance-profile-server-maintenance',
];
export const DEFAULT_STAFF_ROLE = 'Sales Agent';
export const STAFF_ROLES = ['Sales Agent', 'Senior Agent', 'Manager', 'Support', 'Owner'];

export const generateAvatarUrl = (fullName?: string, email?: string) => {
  const seedSource = fullName?.trim() || email?.trim() || 'Agent';
  const normalizedSeed = seedSource.toLowerCase().replace(/\s+/g, '-');
  const encodedSeed = encodeURIComponent(normalizedSeed);
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodedSeed}&backgroundColor=f0f4f8&fontSize=36`;
};

// Canonical list of application modules, keyed by hierarchical IDs used in navigation
export const AVAILABLE_APP_MODULES = [
  { id: 'home', label: 'Home Dashboard' },
  { id: 'warehouse-inventory-product-database', label: 'Product Database' },
  { id: 'warehouse-inventory-stock-movement', label: 'Stock Movement' },
  { id: 'warehouse-inventory-transfer-stock', label: 'Transfer Stock' },
  { id: 'warehouse-inventory-inventory-audit', label: 'Inventory Audit' },
  { id: 'warehouse-purchasing-purchase-request', label: 'Purchase Request' },
  { id: 'warehouse-purchasing-purchase-order', label: 'Purchase Order' },
  { id: 'warehouse-purchasing-receiving-stock', label: 'Receiving Stock' },
  { id: 'warehouse-purchasing-return-to-supplier', label: 'Return to Supplier' },
  { id: 'warehouse-reports-inventory-report', label: 'Inventory Report' },
  { id: 'warehouse-reports-reorder-report', label: 'Reorder Report' },
  { id: 'warehouse-reports-item-suggested-for-stock-report', label: 'Item Suggested for Stock Report' },
  { id: 'warehouse-reports-fast-slow-inventory-report', label: 'Fast/Slow Inventory Report' },
  { id: 'sales-pipeline-board', label: 'Pipelines' },
  { id: 'sales-database-customer-database', label: 'Customer Database' },
  { id: 'sales-transaction-sales-inquiry', label: 'Sales Inquiry' },
  { id: 'sales-transaction-sales-order', label: 'Sales Orders' },
  { id: 'sales-transaction-order-slip', label: 'Order Slips' },
  { id: 'sales-transaction-invoice', label: 'Invoices' },
  { id: 'sales-transaction-product-promotions', label: 'Marketing Campaign' },
  { id: 'sales-reports-inquiry-report', label: 'Inquiry Report' },
  { id: 'sales-reports-sales-report', label: 'Sales Report' },
  { id: 'sales-reports-sales-development-report', label: 'Sales Development Report' },
  { id: 'sales-performance-management-dashboard', label: 'Management Dashboard' },
  { id: 'accounting-transactions-freight-charges-debit', label: 'Freight Charges (Debit)' },
  { id: 'accounting-transactions-sales-return-credit', label: 'Sales Return (Credit)' },
  { id: 'accounting-transactions-adjustment-entry', label: 'Adjustment Entry' },
  { id: 'accounting-transactions-daily-collection-entry', label: 'Daily Collection Entry' },
  { id: 'accounting-accounting-customer-ledger', label: 'Customer Ledger' },
  { id: 'accounting-accounting-collection-summary', label: 'Collection Summary' },
  { id: 'accounting-accounting-statement-of-account', label: 'Statement of Account' },
  { id: 'accounting-accounting-accounts-receivable', label: 'Accounts Receivable' },
  { id: 'accounting-reports-accounting-overview', label: 'Accounting Overview' },
  { id: 'accounting-reports-aging-report', label: 'Aging Report' },
  { id: 'accounting-reports-collection-report', label: 'Collection Report' },
  { id: 'accounting-reports-sales-return-report', label: 'Sales Return Report' },
  { id: 'accounting-reports-accounts-receivable-report', label: 'Accounts Receivable Report' },
  { id: 'accounting-reports-freight-charges-report', label: 'Freight Charges Report' },
  { id: 'accounting-reports-purchase-history', label: 'Purchase History' },
  { id: 'accounting-reports-inactive-active-customers', label: 'Inactive/Active Customers' },
  { id: 'accounting-reports-old-new-customers', label: 'Old/New Customers' },
  { id: 'sales-transaction-daily-call-monitoring', label: 'Daily Call Monitoring' },
  { id: 'maintenance-customer-customer-data', label: 'Customer Data' },

  { id: 'maintenance-customer-customer-group', label: 'Customer Group' },
  { id: 'maintenance-customer-pipeline', label: 'Pipeline' },
  { id: 'maintenance-product-suppliers', label: 'Suppliers' },
  { id: 'maintenance-product-special-price', label: 'Special Price' },
  { id: 'maintenance-product-category-management', label: 'Category Management' },
  { id: 'maintenance-product-courier-management', label: 'Courier Management' },
  { id: 'maintenance-product-remark-templates', label: 'Remark Templates' },
  { id: 'maintenance-profile-staff', label: 'Staff' },
  { id: 'maintenance-profile-team', label: 'Team' },
  { id: 'maintenance-profile-approver', label: 'Approver' },
  { id: 'maintenance-profile-activity-logs', label: 'Activity Logs' },
  { id: 'maintenance-profile-system-access', label: 'System Access' },
  { id: 'maintenance-profile-server-maintenance', label: 'Server Maintenance' },
  { id: 'communication-messaging-inbox', label: 'Inbox' },
  { id: 'communication-text-menu-text-messages', label: 'Text Messages' },
  { id: 'communication-text-menu-inbox', label: 'Inbox' },
  { id: 'communication-text-menu-sent', label: 'Sent' },
  { id: 'communication-text-menu-pending', label: 'Pending' },
  { id: 'communication-text-menu-failed', label: 'Failed' },
  { id: 'communication-text-menu-operator', label: 'Operator' },
  { id: 'communication-productivity-calendar', label: 'Calendar' },
  { id: 'communication-productivity-daily-call-monitoring', label: 'Daily Call Monitoring' },
  { id: 'communication-productivity-tasks', label: 'Tasks' },
];

// Mapping from legacy flat module IDs to canonical hierarchical IDs.
// Used for routing and permission backward compatibility.
export const MODULE_ID_ALIASES: Record<string, string> = {
  dashboard: 'home',
  pipeline: 'maintenance-customer-pipeline',
  pipelines: 'sales-pipeline-board',
  customers: 'sales-database-customer-database',
  products: 'warehouse-inventory-product-database',
  reorder: 'warehouse-reports-reorder-report',
  'stock-movement': 'warehouse-inventory-stock-movement',
  salesinquiry: 'sales-transaction-sales-inquiry',
  salesorder: 'sales-transaction-sales-order',
  orderslip: 'sales-transaction-order-slip',
  invoice: 'sales-transaction-invoice',
  staff: 'maintenance-profile-staff',
  management: 'sales-performance-management-dashboard',
  mail: 'communication-messaging-inbox',
  calendar: 'communication-productivity-calendar',
  calls: 'sales-transaction-daily-call-monitoring',
  tasks: 'communication-productivity-tasks',
  recyclebin: 'maintenance-profile-server-maintenance',
  settings: 'maintenance-profile-system-access',
  'warehouse-inventory-reorder-report': 'warehouse-reports-reorder-report',
  'maintenance-profile-staff-and-agents': 'maintenance-profile-staff',
  'maintenance-system-recycle-bin': 'maintenance-profile-server-maintenance',
  'maintenance-system-settings-permissions': 'maintenance-profile-system-access',
  'maintenance-system-loyalty-discounts': 'maintenance-system-loyalty-discounts',
  'maintenance-system-profit-protection': 'maintenance-system-profit-protection',
  'maintenance-system-ai-templates': 'maintenance-system-ai-templates',
  'accounting-reports-overview': 'accounting-reports-accounting-overview',

  'accounting-reports-daily-calls-monitoring': 'sales-transaction-daily-call-monitoring',
  'maintenance-customer-daily-call-monitoring': 'sales-transaction-daily-call-monitoring',
};

// Sidebar keyboard shortcuts
export const SIDEBAR_KEYBOARD_SHORTCUTS = {
  SEARCH: { key: 'k', meta: true, description: 'Search navigation' },
  HELP: { key: '?', description: 'Show keyboard shortcuts' },
  HOME: { key: '1', alt: true, description: 'Go to Home' },
  WAREHOUSE: { key: '2', alt: true, description: 'Go to Warehouse' },
  SALES: { key: '3', alt: true, description: 'Go to Sales' },
  ACCOUNTING: { key: '4', alt: true, description: 'Go to Accounting' },
  MAINTENANCE: { key: '5', alt: true, description: 'Go to Maintenance' },
  COMMUNICATION: { key: '6', alt: true, description: 'Go to Communication' },
};

// Default sidebar preferences
export const DEFAULT_SIDEBAR_PREFERENCES = {
  isExpanded: false,
  favorites: [],
  recentlyUsed: [],
};

export const MOCK_TASKS: Task[] = [
  {
    id: 't1',
    title: 'Follow up with Jiffy Lube',
    description: 'Ensure they received the revised proposal for Q4 restock.',
    assignedTo: 'James Quek',
    assigneeAvatar: 'https://i.pravatar.cc/150?u=james',
    createdBy: 'James Quek',
    dueDate: '2023-11-15',
    priority: 'High',
    status: 'In Progress'
  },
  {
    id: 't2',
    title: 'Prepare Monthly Sales Report',
    description: 'Compile data from all regions and format for the board meeting.',
    assignedTo: 'Sarah Sales',
    assigneeAvatar: 'https://i.pravatar.cc/150?u=sarah',
    createdBy: 'James Quek',
    dueDate: '2023-11-20',
    priority: 'Medium',
    status: 'Todo'
  },
  {
    id: 't3',
    title: 'Call Banawe Auto regarding unpaid invoice',
    description: 'Invoice #INV-2023-998 is 30 days overdue.',
    assignedTo: 'Esther Van',
    assigneeAvatar: 'https://i.pravatar.cc/150?u=esther',
    createdBy: 'James Quek',
    dueDate: '2023-11-12',
    priority: 'High',
    status: 'Todo'
  },
  {
    id: 't4',
    title: 'Update Product Catalog',
    description: 'Add new Motul SKUs to the system.',
    assignedTo: 'James Quek',
    assigneeAvatar: 'https://i.pravatar.cc/150?u=james',
    createdBy: 'James Quek',
    dueDate: '2023-11-30',
    priority: 'Low',
    status: 'Done'
  }
];

export const MOCK_TEAM_MESSAGES: TeamMessage[] = [
  {
    id: 'msg-1',
    sender_id: 'user_admin_001',
    sender_name: 'James Quek',
    sender_avatar: 'https://i.pravatar.cc/150?u=james',
    message: 'Morning team — quick reminder to push Q1 renewals before Friday. Update the sheet by EOD.',
    created_at: '2024-02-02T01:00:00Z',
    is_from_owner: true
  },
  {
    id: 'msg-2',
    sender_id: 'a2',
    sender_name: 'Sarah Sales',
    sender_avatar: 'https://i.pravatar.cc/150?u=sarah',
    message: 'Shared the updated pricing tiers for Motul SKUs in the #pricing channel. Please review before client calls.',
    created_at: '2024-02-02T02:15:00Z',
    is_from_owner: false
  },
  {
    id: 'msg-3',
    sender_id: 'a3',
    sender_name: 'Esther Van',
    sender_avatar: 'https://i.pravatar.cc/150?u=esther',
    message: 'Heads up: Banawe Auto asked for a shipping ETA on their pending order. I told them we’d confirm within the day.',
    created_at: '2024-02-02T03:00:00Z',
    is_from_owner: false
  },
  {
    id: 'msg-4',
    sender_id: 'user_admin_001',
    sender_name: 'James Quek',
    sender_avatar: 'https://i.pravatar.cc/150?u=james',
    message: 'Great work on the Cebu 4x4 renewal, team. Let’s replicate the playbook for the Bulacan fleet account.',
    created_at: '2024-02-02T04:45:00Z',
    is_from_owner: true
  }
];

// --- EXTENSIVE MOCK DATA FOR DATABASE INJECTION ---

export const MOCK_PRODUCTS: Product[] = [
  {
    id: 'p1',
    part_no: 'MT-8100-X',
    oem_no: 'OEM-99812',
    brand: 'Motul',
    barcode: '88371923812',
    no_of_pieces_per_box: 12,
    item_code: 'OIL-SYN-5W40',
    description: '8100 X-cess 5W40 Synthetic Oil (1L)',
    size: '1L',
    reorder_quantity: 50,
    status: 'Active',
    category: 'Lubricants',
    descriptive_inquiry: 'High performance engine oil',
    no_of_holes: 'N/A',
    replenish_quantity: 100,
    original_pn_no: 'MT-8100-OLD',
    application: 'Gasoline/Diesel Engines',
    no_of_cylinder: 'All',
    price_aa: 550, price_bb: 520, price_cc: 500, price_dd: 480, price_vip1: 450, price_vip2: 430,
    stock_wh1: 200, stock_wh2: 150, stock_wh3: 0, stock_wh4: 50, stock_wh5: 100, stock_wh6: 0
  },
  {
    id: 'p2',
    part_no: 'BR-CER-001',
    oem_no: '4465-0K090',
    brand: 'Brembo',
    barcode: '77281920012',
    no_of_pieces_per_box: 4,
    item_code: 'BP-FT-VIGO',
    description: 'Ceramic Brake Pads Front Set',
    size: 'Standard',
    reorder_quantity: 20,
    status: 'Active',
    category: 'Brakes',
    descriptive_inquiry: 'Low dust ceramic pads',
    no_of_holes: '4',
    replenish_quantity: 40,
    original_pn_no: 'BR-ORG-001',
    application: 'Toyota Hilux Vigo',
    no_of_cylinder: '4',
    price_aa: 3200, price_bb: 3100, price_cc: 3000, price_dd: 2900, price_vip1: 2750, price_vip2: 2600,
    stock_wh1: 50, stock_wh2: 20, stock_wh3: 10, stock_wh4: 0, stock_wh5: 5, stock_wh6: 15
  },
  {
    id: 'p3',
    part_no: 'DN-IK20',
    oem_no: '90919-01210',
    brand: 'Denso',
    barcode: '66182910291',
    no_of_pieces_per_box: 4,
    item_code: 'SP-IR-IK20',
    description: 'Iridium Power Spark Plug',
    size: '14mm',
    reorder_quantity: 100,
    status: 'Active',
    category: 'Ignition',
    descriptive_inquiry: 'High ignitability iridium plug',
    no_of_holes: '1',
    replenish_quantity: 200,
    original_pn_no: 'DN-K20R-U11',
    application: 'Honda/Toyota Universal',
    no_of_cylinder: '4',
    price_aa: 450, price_bb: 420, price_cc: 400, price_dd: 380, price_vip1: 350, price_vip2: 320,
    stock_wh1: 500, stock_wh2: 300, stock_wh3: 100, stock_wh4: 200, stock_wh5: 150, stock_wh6: 50
  },
  {
    id: 'p4',
    part_no: 'MC-PS5-245',
    oem_no: '',
    brand: 'Michelin',
    barcode: '55192837123',
    no_of_pieces_per_box: 1,
    item_code: 'TIRE-245-40-18',
    description: 'Pilot Sport 5 245/40 ZR18',
    size: '245/40 R18',
    reorder_quantity: 10,
    status: 'Active',
    category: 'Tires',
    descriptive_inquiry: 'Max performance summer tire',
    no_of_holes: 'N/A',
    replenish_quantity: 24,
    original_pn_no: 'MC-PS4-245',
    application: 'Sports Sedans',
    no_of_cylinder: 'N/A',
    price_aa: 12500, price_bb: 12200, price_cc: 12000, price_dd: 11800, price_vip1: 11500, price_vip2: 11000,
    stock_wh1: 12, stock_wh2: 8, stock_wh3: 0, stock_wh4: 4, stock_wh5: 0, stock_wh6: 2
  },
  {
    id: 'p5',
    part_no: 'KYB-341362',
    oem_no: '48510-09L40',
    brand: 'KYB',
    barcode: '44123912311',
    no_of_pieces_per_box: 2,
    item_code: 'SHK-FR-VIOS',
    description: 'Excel-G Gas Shock Absorber Front',
    size: 'Standard',
    reorder_quantity: 12,
    status: 'Active',
    category: 'Suspension',
    descriptive_inquiry: 'Twin tube gas shock',
    no_of_holes: '3',
    replenish_quantity: 24,
    original_pn_no: 'KYB-341000',
    application: 'Toyota Vios 2008-2013',
    no_of_cylinder: '4',
    price_aa: 2800, price_bb: 2700, price_cc: 2600, price_dd: 2500, price_vip1: 2400, price_vip2: 2300,
    stock_wh1: 30, stock_wh2: 10, stock_wh3: 5, stock_wh4: 0, stock_wh5: 0, stock_wh6: 10
  },
  {
    id: 'p6',
    part_no: 'VIC-C-110',
    oem_no: '90915-10001',
    brand: 'VIC',
    barcode: '33129381291',
    no_of_pieces_per_box: 50,
    item_code: 'FIL-OIL-TOY',
    description: 'Oil Filter C-110',
    size: 'Small',
    reorder_quantity: 200,
    status: 'Active',
    category: 'Filters',
    descriptive_inquiry: 'High filtration efficiency',
    no_of_holes: '1',
    replenish_quantity: 500,
    original_pn_no: '',
    application: 'Toyota Corolla/Vios',
    no_of_cylinder: '4',
    price_aa: 180, price_bb: 170, price_cc: 160, price_dd: 150, price_vip1: 140, price_vip2: 130,
    stock_wh1: 1000, stock_wh2: 500, stock_wh3: 200, stock_wh4: 300, stock_wh5: 100, stock_wh6: 50
  }
];

export const MOCK_REORDER_REPORT: ReorderReportEntry[] = [
  {
    id: 'rr1',
    product_id: 'p2',
    part_no: 'BR-CER-001',
    description: 'Ceramic Brake Pads Front Set',
    brand: 'Brembo',
    reorder_point: 20,
    total_stock: 12,
    replenish_quantity: 40,
    status: 'low',
    stock_snapshot: { wh1: 5, wh2: 3, wh3: 4, wh4: 0, wh5: 0, wh6: 0 },
    notes: 'Mindanao depot flagged shortfall during cycle count.',
    created_at: '2023-11-01T08:00:00Z',
    updated_at: '2023-11-05T08:00:00Z'
  },
  {
    id: 'rr2',
    product_id: 'p4',
    part_no: 'MC-PS5-245',
    description: 'Pilot Sport 5 245/40 ZR18',
    brand: 'Michelin',
    reorder_point: 10,
    total_stock: 4,
    replenish_quantity: 24,
    status: 'critical',
    stock_snapshot: { wh1: 1, wh2: 1, wh3: 0, wh4: 1, wh5: 0, wh6: 1 },
    notes: 'Fleet client orders depleted on-hand tires.',
    created_at: '2023-11-02T08:00:00Z',
    updated_at: '2023-11-05T08:05:00Z'
  },
  {
    id: 'rr3',
    product_id: 'p5',
    part_no: 'KYB-341362',
    description: 'Excel-G Gas Shock Absorber Front',
    brand: 'KYB',
    reorder_point: 12,
    total_stock: 10,
    replenish_quantity: 24,
    status: 'low',
    stock_snapshot: { wh1: 2, wh2: 2, wh3: 1, wh4: 0, wh5: 0, wh6: 5 },
    notes: 'Auto supply partners requesting expedited replenishment.',
    created_at: '2023-11-03T08:00:00Z',
    updated_at: '2023-11-05T08:10:00Z'
  }
];

// Reusing existing mocks but enriching them with new fields
export const MOCK_CONTACTS: Contact[] = [
  {
    id: '1',
    company: '3JDS CALIBRATION CENTER',
    pastName: '3JDS Calibration Services',
    customerSince: '05/24/2019',
    team: 'North Team',
    salesman: 'James Quek',
    referBy: 'Walk-in',
    address: '#20 Guyong',
    province: 'Bulacan',
    city: 'Sta. Maria',
    deliveryAddress: '#20 Guyong Sta. Maria Bulacan',
    area: 'BULACAN',
    tin: '123-456-789',
    priceGroup: 'VIP2',
    businessLine: 'Diesel Calibration',
    terms: 'AP/TT-PNB',
    transactionType: 'Order Slip',
    vatType: 'Exclusive',
    vatPercentage: '12',
    dealershipTerms: 'Standard',
    dealershipSince: '2019',
    dealershipQuota: 100000,
    creditLimit: 50000,
    status: CustomerStatus.ACTIVE,
    isHidden: false,
    debtType: 'Bad',
    comment: 'Consistent orders but slow pay.',
    contactPersons: [
      { id: 'cp1', enabled: true, name: 'Geraldine Concepcion', position: 'Owner', birthday: '1985-05-12', telephone: '', mobile: '0917-8869038', email: 'geraldine@3jds.com' }
    ],
    // Legacy mapping
    name: 'Geraldine Concepcion',
    title: 'Owner',
    email: '',
    phone: '0917-8869038',
    avatar: 'https://i.pravatar.cc/150?u=3jds',
    dealValue: 0,
    stage: DealStage.CLOSED_WON,
    lastContactDate: '2023-11-01',
    assignedAgent: 'James Quek',
    totalSales: 177225.00,
    balance: 88801.00,
    officeAddress: '#20 GUYONG STA.MARIA BULACAN',
    salesByYear: { '2019': 177225.00 },
    topProducts: [],
    salesHistory: [],
    comments: [],
    interactions: []
  },
  {
    id: '2',
    company: 'CD MACHINEWORK CALIBRATION',
    pastName: 'CD Calibration Services',
    customerSince: '06/21/2013',
    team: 'Mindanao Team',
    salesman: 'Sarah Sales',
    referBy: 'Referral',
    address: 'Purok 7, Gusa Highway',
    province: 'Misamis Oriental',
    city: 'Cagayan De Oro',
    deliveryAddress: 'AP EXPRESS : PUROK 7, GUSA HIGHWAY...',
    area: 'CAGAYAN DE ORO CITY',
    tin: '707-993-646',
    priceGroup: 'VIP2',
    businessLine: 'Diesel Calibration',
    terms: 'AP/TT-PNB',
    transactionType: 'Order Slip',
    vatType: 'Exclusive',
    vatPercentage: '12',
    dealershipTerms: 'Premium',
    dealershipSince: '2013',
    dealershipQuota: 500000,
    creditLimit: 100000,
    status: CustomerStatus.ACTIVE,
    isHidden: false,
    debtType: 'Good',
    comment: 'Top tier client.',
    contactPersons: [
      { id: 'cp2', enabled: true, name: 'Glorian Iniego Cabana', position: 'Owner', birthday: '', telephone: '', mobile: '09176587765', email: '' }
    ],
    // Legacy
    name: 'GLORIAN INIEGO CABANA',
    title: 'Owner',
    email: '',
    phone: '',
    mobile: '09176587765',
    avatar: 'https://i.pravatar.cc/150?u=cdmachine',
    dealValue: 0,
    stage: DealStage.CLOSED_WON,
    lastContactDate: '2023-10-15',
    assignedAgent: 'Sarah Sales',
    totalSales: 885481.00,
    balance: 96775.00,
    salesByYear: { '2022': 135830.00, '2023': 39480.00 },
    topProducts: [],
    salesHistory: [],
    comments: [],
    interactions: []
  },
  {
    id: '3',
    company: '3R AND 3A CALIBRATION',
    pastName: '3R Calibration',
    customerSince: '03/03/2020',
    team: 'South Team',
    salesman: 'Sarah Sales',
    referBy: '',
    address: 'Blk 2 Lot 18 Grand River Stone',
    province: 'Laguna',
    city: 'Sta. Rosa',
    deliveryAddress: 'Same as Office',
    area: 'LAGUNA',
    tin: '',
    priceGroup: 'VIP1',
    businessLine: 'Diesel Calibration',
    terms: 'AP/TT-PNB',
    transactionType: 'Order Slip',
    vatType: 'Exclusive',
    vatPercentage: '12',
    dealershipTerms: '',
    dealershipSince: '',
    dealershipQuota: 0,
    creditLimit: 0,
    status: CustomerStatus.INACTIVE,
    isHidden: true,
    debtType: 'Good',
    comment: 'Seasonal buyer',
    contactPersons: [
      { id: 'cp3', enabled: true, name: 'Richard A. Penaflor', position: 'Manager', birthday: '', telephone: '0917-1271456', mobile: '0950-4145 264', email: '' }
    ],
    // Legacy
    name: 'RICHARD A. PENAFLOR',
    title: '',
    email: '',
    phone: '0917-1271456',
    avatar: 'https://i.pravatar.cc/150?u=3r3a',
    dealValue: 0,
    stage: DealStage.CLOSED_WON,
    lastContactDate: '2023-09-20',
    assignedAgent: 'Sarah Sales',
    totalSales: 131335.00,
    balance: 52049.88,
    salesByYear: { '2020': 55065.00, '2023': 18760.00 },
    topProducts: [],
    salesHistory: [],
    comments: [],
    interactions: []
  },
  {
    id: '4',
    company: '4 DA BOYS MOTORCYCLE SHOP',
    pastName: '4 DA BOYS MC Shop',
    customerSince: '07/31/2019',
    team: 'Metro Team',
    salesman: 'James Quek',
    referBy: '',
    address: 'Luzon Ave, Makasampa',
    province: 'NCR',
    city: 'Quezon City',
    deliveryAddress: 'Same',
    area: 'QUEZON CITY',
    tin: '',
    priceGroup: 'AA',
    businessLine: 'Motorcycle Shop',
    terms: 'COD',
    transactionType: 'Order Slip',
    vatType: 'Inclusive',
    vatPercentage: '12',
    dealershipTerms: '',
    dealershipSince: '',
    dealershipQuota: 0,
    creditLimit: 20000,
    status: CustomerStatus.BLACKLISTED,
    isHidden: false,
    debtType: 'Bad',
    comment: 'Do not sell until balance paid',
    contactPersons: [
      { id: 'cp4', enabled: true, name: 'Mohatmen Sultan', position: 'Owner', birthday: '', telephone: '', mobile: '09464377575', email: '' }
    ],
    // Legacy
    name: 'MOHATMEN SULTAN',
    title: '',
    email: '',
    phone: '',
    mobile: '09464377575',
    avatar: 'https://i.pravatar.cc/150?u=4daboys',
    dealValue: 0,
    stage: DealStage.CLOSED_LOST,
    lastContactDate: '2023-07-22',
    assignedAgent: 'James Quek',
    totalSales: 32300.00,
    balance: 9000.00,
    salesByYear: { '2019': 23250.00 },
    topProducts: [],
    salesHistory: [],
    comments: [],
    interactions: []
  },
  {
    id: '5',
    company: 'AGA AUTO PARTS',
    pastName: 'AGA Auto Supply',
    customerSince: '09/24/2018',
    team: 'Mindanao Team',
    salesman: 'Esther Van',
    referBy: '',
    address: 'AP Building Zone 7',
    province: 'Misamis Oriental',
    city: 'Cagayan De Oro',
    deliveryAddress: 'Same',
    area: 'CAGAYAN DE ORO CITY',
    tin: '422-118-127',
    priceGroup: 'CC',
    businessLine: 'Auto Supply',
    terms: 'AP',
    transactionType: 'Invoice',
    vatType: 'Inclusive',
    vatPercentage: '12',
    dealershipTerms: '',
    dealershipSince: '',
    dealershipQuota: 0,
    creditLimit: 0,
    status: CustomerStatus.PROSPECTIVE,
    isHidden: false,
    debtType: 'Good',
    comment: 'Potential for high volume',
    contactPersons: [
      { id: 'cp5', enabled: true, name: 'Rafael Amboy', position: 'Owner', birthday: '', telephone: '', mobile: '09175183332', email: '' }
    ],
    // Legacy
    name: 'RAFAEL AMBOY',
    title: '',
    email: '',
    phone: '',
    mobile: '09175183332',
    avatar: 'https://i.pravatar.cc/150?u=aga',
    dealValue: 0,
    stage: DealStage.PROPOSAL,
    lastContactDate: '2023-10-05',
    assignedAgent: 'Esther Van',
    totalSales: 789385.00,
    balance: 70674.00,
    salesByYear: { '2018': 474560.00, '2023': 145470.00 },
    topProducts: [],
    salesHistory: [],
    comments: [],
    interactions: []
  },
  {
    id: '6',
    company: 'BANAWE AUTO SUPPLY DEPOT',
    pastName: 'Banawe Auto Trading',
    customerSince: '08/15/2016',
    team: 'Metro Team',
    salesman: 'Sarah Sales',
    referBy: 'Inbound',
    address: '888 Banawe St.',
    province: 'NCR',
    city: 'Quezon City',
    deliveryAddress: 'Warehouse 5, Banawe Complex, QC',
    area: 'QUEZON CITY',
    tin: '998-331-207',
    priceGroup: 'VIP1',
    businessLine: 'Auto Supply',
    terms: '30 DAYS',
    transactionType: 'PO',
    vatType: 'Exclusive',
    vatPercentage: '12',
    dealershipTerms: 'Premium',
    dealershipSince: '2018',
    dealershipQuota: 250000,
    creditLimit: 150000,
    status: CustomerStatus.ACTIVE,
    isHidden: false,
    debtType: 'Good',
    comment: 'High volume buyer for consumables.',
    contactPersons: [
      { id: 'cp6', enabled: true, name: 'Lorenzo Tan', position: 'Owner', birthday: '1978-04-02', telephone: '02-8123456', mobile: '0917-100-0200', email: 'lorenzo@banaweauto.com' }
    ],
    name: 'Lorenzo Tan',
    title: 'Owner',
    email: 'lorenzo@banaweauto.com',
    phone: '02-8123456',
    mobile: '0917-100-0200',
    avatar: 'https://i.pravatar.cc/150?u=banaweauto',
    dealValue: 0,
    stage: DealStage.CLOSED_WON,
    lastContactDate: '2023-11-05',
    assignedAgent: 'Sarah Sales',
    totalSales: 1250000.00,
    balance: 22500.00,
    officeAddress: '888 Banawe St, Quezon City',
    salesByYear: { '2021': 830000.00, '2022': 950000.00, '2023': 1250000.00 },
    topProducts: [],
    salesHistory: [],
    comments: [],
    interactions: []
  },
  {
    id: '7',
    company: 'CEBU CAR CARE SOLUTIONS',
    pastName: 'Cebu Car Care',
    customerSince: '02/12/2014',
    team: 'Visayas Team',
    salesman: 'Esther Van',
    referBy: 'Referral',
    address: 'M.J. Cuenco Ave.',
    province: 'Cebu',
    city: 'Cebu City',
    deliveryAddress: 'M.J. Cuenco Ave, Cebu City',
    area: 'CEBU',
    tin: '335-442-118',
    priceGroup: 'VIP2',
    businessLine: 'Detailing & Service',
    terms: '15 DAYS',
    transactionType: 'Order Slip',
    vatType: 'Inclusive',
    vatPercentage: '12',
    dealershipTerms: 'Standard',
    dealershipSince: '2014',
    dealershipQuota: 140000,
    creditLimit: 80000,
    status: CustomerStatus.ACTIVE,
    isHidden: false,
    debtType: 'Good',
    comment: 'Strong seasonal purchases for festivals.',
    contactPersons: [
      { id: 'cp7', enabled: true, name: 'Elena Cruz', position: 'General Manager', birthday: '', telephone: '', mobile: '0917-555-2010', email: 'elena@cebucarcare.ph' }
    ],
    name: 'Elena Cruz',
    title: 'General Manager',
    email: 'elena@cebucarcare.ph',
    phone: '',
    mobile: '0917-555-2010',
    avatar: 'https://i.pravatar.cc/150?u=cebucarcare',
    dealValue: 0,
    stage: DealStage.CLOSED_WON,
    lastContactDate: '2023-10-28',
    assignedAgent: 'Esther Van',
    totalSales: 612350.00,
    balance: 0,
    officeAddress: 'M.J. Cuenco Ave, Cebu City',
    salesByYear: { '2020': 320000.00, '2021': 415000.00, '2022': 580000.00, '2023': 612350.00 },
    topProducts: [],
    salesHistory: [],
    comments: [],
    interactions: []
  },
  {
    id: '8',
    company: 'DAVAO 4X4 OUTFITTERS',
    pastName: 'Davao 4x4',
    customerSince: '11/09/2018',
    team: 'Mindanao Team',
    salesman: 'Miguel Santos',
    referBy: 'Trade Show',
    address: 'Quimpo Blvd',
    province: 'Davao del Sur',
    city: 'Davao City',
    deliveryAddress: 'Quimpo Blvd, Talomo District',
    area: 'DAVAO',
    tin: '889-220-119',
    priceGroup: 'VIP1',
    businessLine: 'Off-road Specialty',
    terms: 'COD',
    transactionType: 'Sales Invoice',
    vatType: 'Exclusive',
    vatPercentage: '12',
    dealershipTerms: 'Preferred',
    dealershipSince: '2019',
    dealershipQuota: 120000,
    creditLimit: 70000,
    status: CustomerStatus.ACTIVE,
    isHidden: false,
    debtType: 'Good',
    comment: 'Buys high-margin suspension kits monthly.',
    contactPersons: [
      { id: 'cp8', enabled: true, name: 'Dennis Uy', position: 'Owner', birthday: '', telephone: '', mobile: '0919-991-1221', email: 'dennis@davao4x4.ph' }
    ],
    name: 'Dennis Uy',
    title: 'Owner',
    email: 'dennis@davao4x4.ph',
    phone: '',
    mobile: '0919-991-1221',
    avatar: 'https://i.pravatar.cc/150?u=davao4x4',
    dealValue: 0,
    stage: DealStage.CLOSED_WON,
    lastContactDate: '2023-11-07',
    assignedAgent: 'Miguel Santos',
    totalSales: 455000.00,
    balance: 15000.00,
    officeAddress: 'Quimpo Blvd, Davao City',
    salesByYear: { '2021': 210000.00, '2022': 340000.00, '2023': 455000.00 },
    topProducts: [],
    salesHistory: [],
    comments: [],
    interactions: []
  },
  {
    id: '9',
    company: 'PASIG RAPID SERVICE CENTER',
    pastName: 'Pasig Rapid',
    customerSince: '01/05/2015',
    team: 'Metro Team',
    salesman: 'Corbin Dallas',
    referBy: 'Existing Client',
    address: 'C. Raymundo Ave.',
    province: 'NCR',
    city: 'Pasig',
    deliveryAddress: 'C. Raymundo Ave, Pasig',
    area: 'PASIG',
    tin: '778-221-009',
    priceGroup: 'VIP1',
    businessLine: 'Fleet Service',
    terms: '45 DAYS',
    transactionType: 'Order Slip',
    vatType: 'Exclusive',
    vatPercentage: '12',
    dealershipTerms: 'Premium',
    dealershipSince: '2016',
    dealershipQuota: 300000,
    creditLimit: 180000,
    status: CustomerStatus.ACTIVE,
    isHidden: false,
    debtType: 'Good',
    comment: 'Requires SLA compliance for urgent deliveries.',
    contactPersons: [
      { id: 'cp9', enabled: true, name: 'Vico Sotto', position: 'Managing Partner', birthday: '1989-06-17', telephone: '', mobile: '0917-454-8899', email: 'vico@pasigrapid.com' }
    ],
    name: 'Vico Sotto',
    title: 'Managing Partner',
    email: 'vico@pasigrapid.com',
    phone: '',
    mobile: '0917-454-8899',
    avatar: 'https://i.pravatar.cc/150?u=pasigrapid',
    dealValue: 0,
    stage: DealStage.CLOSED_WON,
    lastContactDate: '2023-10-30',
    assignedAgent: 'Corbin Dallas',
    totalSales: 998200.00,
    balance: 38990.00,
    officeAddress: 'C. Raymundo Ave, Pasig',
    salesByYear: { '2020': 450000.00, '2021': 620000.00, '2022': 780000.00, '2023': 998200.00 },
    topProducts: [],
    salesHistory: [],
    comments: [],
    interactions: []
  },
  {
    id: '10',
    company: 'QC AUTO DETAILING HUB',
    pastName: 'QC Auto Hub',
    customerSince: '04/19/2021',
    team: 'Metro Team',
    salesman: 'James Quek',
    referBy: 'Digital Campaign',
    address: 'Scout Tuazon',
    province: 'NCR',
    city: 'Quezon City',
    deliveryAddress: '28-B Scout Tuazon, QC',
    area: 'QUEZON CITY',
    tin: '665-119-837',
    priceGroup: 'AA',
    businessLine: 'Detailing',
    terms: 'COD',
    transactionType: 'Sales Invoice',
    vatType: 'Inclusive',
    vatPercentage: '12',
    dealershipTerms: 'Starter',
    dealershipSince: '2022',
    dealershipQuota: 80000,
    creditLimit: 40000,
    status: CustomerStatus.PROSPECTIVE,
    isHidden: false,
    debtType: 'Good',
    comment: 'New account ramping up ceramic coating kits.',
    contactPersons: [
      { id: 'cp10', enabled: true, name: 'Mara Laurel', position: 'Owner', birthday: '', telephone: '', mobile: '0918-884-5123', email: 'mara@qcautohub.ph' }
    ],
    name: 'Mara Laurel',
    title: 'Owner',
    email: 'mara@qcautohub.ph',
    phone: '',
    mobile: '0918-884-5123',
    avatar: 'https://i.pravatar.cc/150?u=qcautohub',
    dealValue: 0,
    stage: DealStage.PROPOSAL,
    lastContactDate: '2023-11-08',
    assignedAgent: 'James Quek',
    totalSales: 120000.00,
    balance: 0,
    officeAddress: 'Scout Tuazon, Quezon City',
    salesByYear: { '2022': 60000.00, '2023': 120000.00 },
    topProducts: [],
    salesHistory: [],
    comments: [],
    interactions: []
  },
  {
    id: '11',
    company: 'ILOILO DIESEL SPECIALISTS',
    pastName: 'Iloilo Diesel Shop',
    customerSince: '07/01/2012',
    team: 'Visayas Team',
    salesman: 'Sofia Reyes',
    referBy: 'Dealer Event',
    address: 'Diversion Road, Mandurriao',
    province: 'Iloilo',
    city: 'Iloilo City',
    deliveryAddress: 'Diversion Rd, Iloilo City',
    area: 'ILOILO',
    tin: '441-992-331',
    priceGroup: 'VIP2',
    businessLine: 'Diesel Calibration',
    terms: '30 DAYS',
    transactionType: 'Order Slip',
    vatType: 'Exclusive',
    vatPercentage: '12',
    dealershipTerms: 'Premium',
    dealershipSince: '2013',
    dealershipQuota: 200000,
    creditLimit: 120000,
    status: CustomerStatus.INACTIVE,
    isHidden: false,
    debtType: 'Good',
    comment: 'Paused while facility renovates.',
    contactPersons: [
      { id: 'cp11', enabled: true, name: 'Rafael Dizon', position: 'Owner', birthday: '', telephone: '', mobile: '0917-611-8899', email: 'rafael@iloilodiesel.ph' }
    ],
    name: 'Rafael Dizon',
    title: 'Owner',
    email: 'rafael@iloilodiesel.ph',
    phone: '',
    mobile: '0917-611-8899',
    avatar: 'https://i.pravatar.cc/150?u=iloilodiesel',
    dealValue: 0,
    stage: DealStage.NEGOTIATION,
    lastContactDate: '2023-09-12',
    assignedAgent: 'Sofia Reyes',
    totalSales: 352000.00,
    balance: 50220.00,
    officeAddress: 'Diversion Rd, Iloilo City',
    salesByYear: { '2020': 120000.00, '2021': 180000.00, '2022': 210000.00 },
    topProducts: [],
    salesHistory: [],
    comments: [],
    interactions: []
  },
  {
    id: '12',
    company: 'BULACAN FLEET SERVICES',
    pastName: 'Bulacan Fleet Workshop',
    customerSince: '10/10/2019',
    team: 'North Team',
    salesman: 'James Quek',
    referBy: 'Government Bid',
    address: 'Plaridel Bypass Road',
    province: 'Bulacan',
    city: 'Plaridel',
    deliveryAddress: 'Plaridel Bypass Km 38',
    area: 'BULACAN',
    tin: '511-824-003',
    priceGroup: 'VIP1',
    businessLine: 'Fleet Maintenance',
    terms: '60 DAYS',
    transactionType: 'Contract',
    vatType: 'Exclusive',
    vatPercentage: '12',
    dealershipTerms: 'Enterprise',
    dealershipSince: '2020',
    dealershipQuota: 400000,
    creditLimit: 300000,
    status: CustomerStatus.ACTIVE,
    isHidden: false,
    debtType: 'Good',
    comment: 'Handles provincial government units.',
    contactPersons: [
      { id: 'cp12', enabled: true, name: 'Gerard Ramos', position: 'Operations Head', birthday: '', telephone: '', mobile: '0917-881-4433', email: 'gerard@bulacanfleet.ph' }
    ],
    name: 'Gerard Ramos',
    title: 'Operations Head',
    email: 'gerard@bulacanfleet.ph',
    phone: '',
    mobile: '0917-881-4433',
    avatar: 'https://i.pravatar.cc/150?u=bulacanfleet',
    dealValue: 0,
    stage: DealStage.CLOSED_WON,
    lastContactDate: '2023-11-03',
    assignedAgent: 'James Quek',
    totalSales: 1750000.00,
    balance: 120000.00,
    officeAddress: 'Plaridel Bypass Rd, Bulacan',
    salesByYear: { '2021': 950000.00, '2022': 1320000.00, '2023': 1750000.00 },
    topProducts: [],
    salesHistory: [],
    comments: [],
    interactions: []
  }
];

export const MOCK_AGENTS = [
  {
    id: 'a1',
    name: 'James Quek',
    role: 'Owner',
    avatar: 'https://i.pravatar.cc/150?u=james',
    activeClients: 12,
    salesThisMonth: 5600000,
    callsThisWeek: 45,
    conversionRate: 68
  },
  {
    id: 'a2',
    name: 'Sarah Sales',
    role: 'Senior Sales Agent',
    avatar: 'https://i.pravatar.cc/150?u=sarah',
    activeClients: 28,
    salesThisMonth: 2100000,
    callsThisWeek: 112,
    conversionRate: 42
  },
  {
    id: 'a3',
    name: 'Esther Van',
    role: 'Sales Agent',
    avatar: 'https://i.pravatar.cc/150?u=esther',
    activeClients: 15,
    salesThisMonth: 950000,
    callsThisWeek: 88,
    conversionRate: 35
  },
  {
    id: 'a4',
    name: 'Corbin Dallas',
    role: 'Sales Agent',
    avatar: 'https://i.pravatar.cc/150?u=corbin',
    activeClients: 9,
    salesThisMonth: 150000,
    callsThisWeek: 120,
    conversionRate: 12
  },
  {
    id: 'a5',
    name: 'Anna Smith',
    role: 'Junior Associate',
    avatar: 'https://i.pravatar.cc/150?u=anna',
    activeClients: 5,
    salesThisMonth: 0,
    callsThisWeek: 150,
    conversionRate: 5
  },
  {
    id: 'a6',
    name: 'Miguel Santos',
    role: 'Sales Agent',
    avatar: 'https://i.pravatar.cc/150?u=miguel',
    activeClients: 18,
    salesThisMonth: 1250000,
    callsThisWeek: 95,
    conversionRate: 28
  },
  {
    id: 'a7',
    name: 'Sofia Reyes',
    role: 'Sales Agent',
    avatar: 'https://i.pravatar.cc/150?u=sofia',
    activeClients: 22,
    salesThisMonth: 1800000,
    callsThisWeek: 105,
    conversionRate: 33
  },
  {
    id: 'a8',
    name: 'Luis Rivera',
    role: 'Junior Associate',
    avatar: 'https://i.pravatar.cc/150?u=luis',
    activeClients: 8,
    salesThisMonth: 350000,
    callsThisWeek: 140,
    conversionRate: 15
  },
  {
    id: 'a9',
    name: 'Carmen Luna',
    role: 'Senior Sales Agent',
    avatar: 'https://i.pravatar.cc/150?u=carmen',
    activeClients: 35,
    salesThisMonth: 2900000,
    callsThisWeek: 80,
    conversionRate: 55
  },
  {
    id: 'a10',
    name: 'Diego Garcia',
    role: 'Sales Agent',
    avatar: 'https://i.pravatar.cc/150?u=diego',
    activeClients: 14,
    salesThisMonth: 850000,
    callsThisWeek: 110,
    conversionRate: 22
  },
  {
    id: 'a11',
    name: 'Isabella Cruz',
    role: 'Sales Agent',
    avatar: 'https://i.pravatar.cc/150?u=isabella',
    activeClients: 19,
    salesThisMonth: 1450000,
    callsThisWeek: 92,
    conversionRate: 30
  },
  {
    id: 'a12',
    name: 'Rafael Torres',
    role: 'Junior Associate',
    avatar: 'https://i.pravatar.cc/150?u=rafael',
    activeClients: 6,
    salesThisMonth: 120000,
    callsThisWeek: 160,
    conversionRate: 8
  },
  {
    id: 'a13',
    name: 'Maria Fernandez',
    role: 'Senior Sales Agent',
    avatar: 'https://i.pravatar.cc/150?u=maria_f',
    activeClients: 42,
    salesThisMonth: 3200000,
    callsThisWeek: 75,
    conversionRate: 62
  },
  {
    id: 'a14',
    name: 'Antonio Mendoza',
    role: 'Sales Agent',
    avatar: 'https://i.pravatar.cc/150?u=antonio',
    activeClients: 16,
    salesThisMonth: 980000,
    callsThisWeek: 100,
    conversionRate: 25
  },
  {
    id: 'a15',
    name: 'Gabriela Diaz',
    role: 'Sales Agent',
    avatar: 'https://i.pravatar.cc/150?u=gabriela',
    activeClients: 25,
    salesThisMonth: 2100000,
    callsThisWeek: 98,
    conversionRate: 38
  }
];

// Mock Call Data
export interface CallLog {
  id: string;
  contactName: string;
  company: string;
  agentName: string;
  agentAvatar: string;
  type: 'Inbound' | 'Outbound';
  status: 'Completed' | 'Missed' | 'Scheduled' | 'In-Progress';
  duration: string; // e.g., "4m 32s"
  time: string; // e.g., "09:30 AM"
  outcome: 'Successful' | 'Voicemail' | 'Follow-up Needed' | 'Not Interested' | 'No Answer';
  notes: string;
}

export const MOCK_CALL_LOGS: CallLog[] = [
  { id: 'cl1', contactName: 'Ramon Bautista', company: 'Banawe Auto', agentName: 'Sarah Sales', agentAvatar: 'https://i.pravatar.cc/150?u=sarah', type: 'Outbound', status: 'Completed', duration: '12m 45s', time: '09:15 AM', outcome: 'Successful', notes: 'Confirmed Q4 bulk order details.' },
  { id: 'cl2', contactName: 'Elena Cruz', company: 'Cebu Car Care', agentName: 'Esther Van', agentAvatar: 'https://i.pravatar.cc/150?u=esther', type: 'Outbound', status: 'Completed', duration: '5m 12s', time: '09:45 AM', outcome: 'Follow-up Needed', notes: 'Needs catalog sent via email.' },
  { id: 'cl3', contactName: 'Dennis Uy', company: 'Davao 4x4', agentName: 'Antony Brown', agentAvatar: 'https://i.pravatar.cc/150?u=antony', type: 'Inbound', status: 'Missed', duration: '0s', time: '10:05 AM', outcome: 'No Answer', notes: 'Caller hung up before pickup.' },
  { id: 'cl4', contactName: 'Vico Sotto', company: 'Pasig Rapid', agentName: 'Corbin Dallas', agentAvatar: 'https://i.pravatar.cc/150?u=corbin', type: 'Outbound', status: 'Completed', duration: '8m 30s', time: '10:30 AM', outcome: 'Successful', notes: 'Re-engagement successful. Interested in promos.' },
  { id: 'cl5', contactName: 'New Prospect', company: 'QC Auto Detailing', agentName: 'Sarah Sales', agentAvatar: 'https://i.pravatar.cc/150?u=sarah', type: 'Inbound', status: 'In-Progress', duration: '2m 15s', time: '11:00 AM', outcome: 'Successful', notes: 'Currently on call regarding wax supplies.' },
];

export const REPORT_PIE_DATA = [
  { name: 'Metro Manila Shops', value: 45.0, color: '#0F5298' },
  { name: 'Luzon Provincial', value: 25.0, color: '#3b82f6' },
  { name: 'Visayas Dealers', value: 18.0, color: '#60a5fa' },
  { name: 'Mindanao Dealers', value: 12.0, color: '#93c5fd' },
];

export const REPORT_BAR_DATA = [
  { name: 'Wholesale Parts', value: 45000000 },
  { name: 'Service Centers', value: 28000000 },
  { name: 'Retail Shops', value: 80000000 },
];

export const TOP_PRODUCTS_DATA = [
  { name: 'Motul 8100 X-cess', value: 15500000 },
  { name: 'Michelin Pilot Sport 5', value: 12200000 },
  { name: 'Amaron Pro Battery', value: 9800000 },
  { name: 'Brembo Ceramic Pads', value: 7500000 },
  { name: 'Denso Iridium Plugs', value: 5200000 },
  { name: 'Bosch Oil Filter', value: 4800000 },
  { name: 'Shell Helix Ultra', value: 4200000 },
  { name: 'KYB Shock Absorber', value: 3900000 },
  { name: 'Yokohama BlueEarth', value: 3500000 },
  { name: 'Panasonic Battery', value: 3100000 },
];

export const PIPELINE_COLUMNS: PipelineColumn[] = [
  {
    id: 'prospective',
    title: 'Qualification',
    color: 'text-amber-600',
    accentColor: '#d97706',
    probability: 0.1,
    entryCriteria: 'Intent captured / inbound signal',
    exitCriteria: 'BANT validated, buyer engaged',
    keyActivities: ['Document pain points', 'Map stakeholders', 'Confirm budget & timeline'],
    rootingDays: 5
  },
  {
    id: 'active',
    title: 'Proposal',
    color: 'text-emerald-600',
    accentColor: '#059669',
    probability: 0.6,
    entryCriteria: 'Solution validated with buyer',
    exitCriteria: 'Economic buyer reviewed proposal',
    keyActivities: ['Customize proposal', 'Align value to metrics', 'Secure EB review'],
    rootingDays: 10
  },
  {
    id: 'inactive',
    title: 'Negotiation',
    color: 'text-slate-500',
    accentColor: '#64748b',
    probability: 0.8,
    entryCriteria: 'Buyer in pricing/legal review',
    exitCriteria: 'Terms agreed, redlines resolved',
    keyActivities: ['Handle objections', 'Align legal/procurement', 'Reconfirm ROI'],
    rootingDays: 7
  },
  {
    id: 'blacklisted',
    title: 'Closed Lost / Blocked',
    color: 'text-rose-600',
    accentColor: '#e11d48',
    probability: 0,
    entryCriteria: 'Deal disqualified or blacklisted',
    exitCriteria: 'Re-qualification required',
    keyActivities: ['Capture loss reason', 'Plan nurture/retry path'],
    rootingDays: 3
  },
];

export const MOCK_PIPELINE_DEALS: PipelineDeal[] = [
  { id: 'd1', title: 'Jiffy Lube QC - Monthly Restock', company: 'Jiffy Lube QC', contactName: 'Tracy Nguyen', avatar: 'https://i.pravatar.cc/150?u=tracy', value: 150000, currency: '₱', stageId: 'prospective', ownerName: 'Tracy' },
  { id: 'd2', title: 'Shell Select - Oil Supply', company: 'Shell Select Alabang', contactName: 'Victoria Miller', avatar: 'https://i.pravatar.cc/150?u=victoria', value: 100000, currency: '₱', stageId: 'prospective', ownerName: 'Esther', daysInStage: 1, isOverdue: true, isWarning: true },
];

// --- Daily Call Monitoring Seeds ---
const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pickOne = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

export const generateCallMonitoringSeed = (days = 30): { callLogs: CallLogEntry[]; inquiries: Inquiry[]; purchases: Purchase[] } => {
  const contacts = MOCK_CONTACTS.filter(contact => !contact.isHidden);
  const agents = MOCK_AGENTS;
  const callLogs: CallLogEntry[] = [];
  const inquiries: Inquiry[] = [];
  const purchases: Purchase[] = [];

  if (!contacts.length || !agents.length) {
    return { callLogs, inquiries, purchases };
  }

  const callOutcomes: CallLogEntry['outcome'][] = ['positive', 'follow_up', 'negative', 'other'];
  const inquiryTopics = ['pricing', 'delivery windows', 'credit terms', 'promo eligibility', 'stock availability'];
  const purchaseFocus = ['filters', 'synthetic oils', 'brake pads', 'suspension kits', 'battery restock'];

  for (let dayIndex = 0; dayIndex < days; dayIndex++) {
    const baseDay = new Date();
    baseDay.setHours(8, 0, 0, 0);
    baseDay.setDate(baseDay.getDate() - dayIndex);

    const dailyCallCount = 6 + (dayIndex % 4);
    for (let i = 0; i < dailyCallCount; i++) {
      const contact = contacts[(dayIndex + i) % contacts.length];
      const agent = agents[(dayIndex * 3 + i) % agents.length];
      const occurredAt = new Date(baseDay);
      occurredAt.setHours(8 + (i % 9), randInt(0, 59), randInt(0, 59), 0);

      const outcome = callOutcomes[(dayIndex + i) % callOutcomes.length];
      const direction: CallLogEntry['direction'] = (dayIndex + i) % 3 === 0 ? 'inbound' : 'outbound';
      const channel: CallLogEntry['channel'] = Math.random() > 0.15 ? 'call' : 'text';
      const duration = randInt(45, 720);

      const followUp = outcome === 'follow_up' ? 'Schedule follow-up demo' : undefined;
      const notesMap: Record<CallLogEntry['outcome'], string> = {
        positive: `Discussed replenishment plan with ${contact.company}.`,
        follow_up: `Awaiting approval from ${contact.company}'s manager.`,
        negative: `${contact.company} postponed their decision this week.`,
        note: `Left a general note for ${contact.company}.`,
        other: `Routine touch-base with ${contact.company}.`
      };

      callLogs.push({
        id: `call_${dayIndex}_${i}_${contact.id}`,
        contact_id: contact.id,
        agent_name: agent.name,
        channel,
        direction,
        duration_seconds: duration,
        notes: notesMap[outcome],
        outcome,
        occurred_at: occurredAt.toISOString(),
        next_action: followUp,
        next_action_due: followUp ? new Date(occurredAt.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString() : undefined
      });
    }

    const inquiryCount = 1 + (dayIndex % 2);
    for (let j = 0; j < inquiryCount; j++) {
      const contact = contacts[(dayIndex * 2 + j) % contacts.length];
      const inquiryTime = new Date(baseDay);
      inquiryTime.setHours(11 + j, randInt(0, 59), randInt(0, 59), 0);
      const topic = pickOne(inquiryTopics);

      inquiries.push({
        id: `inq_${dayIndex}_${j}_${contact.id}`,
        contact_id: contact.id,
        title: `Question about ${topic}`,
        channel: pickOne(['email', 'chat', 'call', 'text']),
        sentiment: pickOne(['positive', 'neutral', 'negative']),
        occurred_at: inquiryTime.toISOString(),
        notes: `Discussed ${topic} with ${contact.company}.`
      });
    }

    if (dayIndex % 2 === 0 || Math.random() > 0.65) {
      const purchaseContact = contacts[(dayIndex * 5) % contacts.length];
      const purchaseDate = new Date(baseDay);
      purchaseDate.setHours(15, randInt(0, 59), randInt(0, 59), 0);
      const amount = randInt(45000, 250000);
      const status: Purchase['status'] = amount % 3 === 0 ? 'pending' : 'paid';

      purchases.push({
        id: `purchase_${dayIndex}_${purchaseContact.id}`,
        contact_id: purchaseContact.id,
        amount,
        status,
        purchased_at: purchaseDate.toISOString(),
        notes: `Order for ${purchaseContact.company} covering ${pickOne(purchaseFocus)}.`
      });
    }
  }

  return { callLogs, inquiries, purchases };
};

export const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'notif-1',
    recipient_id: 'user_admin_001',
    title: 'New Task Assigned',
    message: 'Follow up with Jiffy Lube regarding Q4 restock proposal has been assigned to you.',
    type: 'info',
    action_url: '/tasks',
    metadata: { taskId: 't1', priority: 'High' },
    is_read: false,
    created_at: new Date(Date.now() - 5 * 60000).toISOString(), // 5 minutes ago
    read_at: undefined
  },
  {
    id: 'notif-2',
    recipient_id: 'user_admin_001',
    title: 'Sales Report Approved',
    message: 'Your monthly sales report for November has been approved and published.',
    type: 'success',
    action_url: '/dashboard',
    metadata: { reportId: 'report-nov-2024' },
    is_read: false,
    created_at: new Date(Date.now() - 45 * 60000).toISOString(), // 45 minutes ago
    read_at: undefined
  },
  {
    id: 'notif-3',
    recipient_id: 'user_admin_001',
    title: 'Low Stock Alert',
    message: 'Motul 300V SAE 0W40 inventory is below minimum threshold. Please reorder soon.',
    type: 'warning',
    action_url: '/products',
    metadata: { productId: 'prod-motul-300v', currentStock: 12, minThreshold: 50 },
    is_read: false,
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(), // 2 hours ago
    read_at: undefined
  },
  {
    id: 'notif-4',
    recipient_id: 'user_admin_001',
    title: 'Contact Update Request',
    message: 'Your request to update contact information for Banawe Auto has been rejected.',
    type: 'error',
    action_url: '/customers',
    metadata: { contactId: 'contact-banawe', reason: 'Missing verification documents' },
    is_read: true,
    created_at: new Date(Date.now() - 24 * 3600000).toISOString(), // 1 day ago
    read_at: new Date(Date.now() - 23 * 3600000).toISOString()
  },
  {
    id: 'notif-5',
    recipient_id: 'user_admin_001',
    title: 'Discount Request Approved',
    message: 'Customer request for 10% volume discount on Castrol products has been approved.',
    type: 'success',
    action_url: '/dashboard',
    metadata: { discountId: 'disc-001', percentage: 10 },
    is_read: true,
    created_at: new Date(Date.now() - 48 * 3600000).toISOString(), // 2 days ago
    read_at: new Date(Date.now() - 47 * 3600000).toISOString()
  },
  {
    id: 'notif-6',
    recipient_id: 'user_admin_001',
    title: 'System Maintenance Scheduled',
    message: 'System maintenance will occur on December 15 from 11 PM to 1 AM. Plan accordingly.',
    type: 'info',
    action_url: undefined,
    metadata: { maintenanceDate: '2024-12-15', duration: '2 hours' },
    is_read: true,
    created_at: new Date(Date.now() - 3 * 24 * 3600000).toISOString(), // 3 days ago
    read_at: new Date(Date.now() - 2.9 * 24 * 3600000).toISOString()
  }
];
