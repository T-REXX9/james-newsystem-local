

export enum DealStage {
  NEW = 'New',
  DISCOVERY = 'Discovery',
  QUALIFIED = 'Qualified',
  PROPOSAL = 'Proposal',
  NEGOTIATION = 'Negotiation',
  CLOSED_WON = 'Closed Won',
  CLOSED_LOST = 'Closed Lost',
}

export enum CustomerStatus {
  ACTIVE = 'Active',
  INACTIVE = 'Inactive',
  PROSPECTIVE = 'Prospective',
  BLACKLISTED = 'Blacklisted'
}

export enum SalesInquiryStatus {
  DRAFT = 'draft',
  APPROVED = 'approved',
  CONVERTED_TO_ORDER = 'converted_to_order',
  CANCELLED = 'cancelled',
}

export enum SalesOrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CONVERTED_TO_DOCUMENT = 'converted_to_document',
  CANCELLED = 'cancelled',
}

export enum OrderSlipStatus {
  DRAFT = 'draft',
  FINALIZED = 'finalized',
  CANCELLED = 'cancelled',
}

export enum InvoiceStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface StandardNotificationPayload {
  actor_id: string;
  actor_role: string;
  entity_type: string;
  entity_id: string;
  org_id?: string;
  tenant?: string;
  severity: NotificationType;
  action: string;
  status?: string;
  action_url?: string;
  idempotency_key: string;
  correlation_id?: string;
  [key: string]: unknown;
}

export interface Notification {
  id: string;
  recipient_id: string;
  title: string;
  message: string;
  type: NotificationType;
  action_url?: string;
  metadata?: StandardNotificationPayload;
  is_read: boolean;
  created_at: string;
  read_at?: string;
  is_deleted?: boolean;
  deleted_at?: string;
}

export interface CreateNotificationInput {
  recipient_id: string;
  title: string;
  message: string;
  type: NotificationType;
  action_url?: string;
  metadata?: StandardNotificationPayload;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  role?: string;
  access_rights?: string[]; // List of module IDs allowed
  team?: string;
  birthday?: string;
  mobile?: string;
  monthly_quota?: number;
}

export interface ProfileRow extends UserProfile {
  created_at: string;
  updated_at: string;
}

export interface StaffAccountValidationError {
  fullName?: string;
  email?: string;
  password?: string;
  role?: string;
  accessRights?: string;
}

export interface SidebarPreferences {
  isExpanded: boolean;
  favorites: string[];
  recentlyUsed: string[];
}

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: () => void;
  description: string;
  allowInInput?: boolean;
}

export interface SidebarMenuItem {
  id: string;
  icon: any;
  label: string;
  group: string;
  badge?: number;
  shortcut?: string;
}

// Hierarchical sidebar navigation types
export type MenuLevel = 1 | 2 | 3;

export interface MenuItemLeaf {
  id: string;
  label: string;
  icon?: any;
  level: 3;
  parentId: string;
  /**
   * Route identifier used by the router (activeTab) and access control.
   * Follows the convention: {category}-{subcategory}-{page-name}
   * e.g. "warehouse-inventory-product-database".
   */
  route: string;
  isExpandable?: false;
}

export interface MenuSubCategory {
  id: string;
  label: string;
  icon?: any;
  level: 2;
  parentId: string;
  /**
   * Optional route when the submenu itself should be clickable.
   * Most submenus will only act as containers for leaf pages.
   */
  route?: string;
  isExpandable?: boolean;
  children: MenuItemLeaf[];
}

export interface MenuCategory {
  id: string;
  label: string;
  icon: any;
  level: 1;
  parentId?: null;
  /**
   * When present (e.g. for HOME), clicking the category navigates directly
   * to this route instead of expanding children.
   */
  route?: string;
  isExpandable?: boolean;
  children?: Array<MenuSubCategory | MenuItemLeaf>;
}

export type HierarchicalMenuItem = MenuCategory | MenuSubCategory | MenuItemLeaf;

export interface CreateStaffAccountInput {
  email: string;
  password: string;
  fullName: string;
  role?: string;
  birthday?: string;
  mobile?: string;
  accessRights?: string[];
}

export interface CreateStaffAccountResult {
  success: boolean;
  error?: string;
  userId?: string;
  profile?: UserProfile;
  validationErrors?: StaffAccountValidationError;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assignedTo: string; // User full_name
  assigneeAvatar?: string;
  createdBy: string;
  dueDate: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Todo' | 'In Progress' | 'Done';
  is_deleted?: boolean;
  deleted_at?: string;
  updated_at?: string;
}

export interface Interaction {
  id: string;
  date: string;
  type: 'Email' | 'Call' | 'Meeting' | 'SMS';
  notes: string;
  sentiment?: 'Positive' | 'Neutral' | 'Negative';
}

export interface Comment {
  id: string;
  author: string;
  role: string; // e.g., 'Owner', 'Sales Agent'
  text: string;
  timestamp: string;
  avatar?: string;
}

export interface SalesRecord {
  id: string;
  date: string;
  product: string;
  amount: number;
  status: 'Paid' | 'Pending';
}

export interface ContactPerson {
  id: string;
  enabled: boolean;
  name: string;
  position: string;
  birthday: string;
  telephone: string;
  mobile: string;
  email: string;
}

export interface Contact {
  id: string;
  // Core Identifiers
  company: string; // "customer_name"
  pastName?: string;
  customerSince: string; // "since"
  team: string;
  salesman: string; // "salesman" (Assigned Agent)
  referBy: string;

  // Location
  address: string; // Street/Building
  province: string;
  city: string;
  area: string;
  deliveryAddress: string;

  // Financial / Legal
  tin: string;
  priceGroup: string; // "price_group"
  businessLine: string; // "business_line"
  terms: string;
  transactionType: string;
  vatType: string;
  vatPercentage: string;

  // Dealership Specifics
  dealershipTerms: string;
  dealershipSince: string;
  dealershipQuota: number;
  creditLimit: number;
  ishinomotoDealerSince?: string;
  ishinomotoSignageSince?: string;
  signageSince?: string;
  codeText?: string;
  codeDate?: string;

  // Status & Logic
  status: CustomerStatus; // "status_filter"
  isHidden: boolean; // "hide_unhide"
  debtType: 'Good' | 'Bad';
  comment: string; // General comment

  // Nested Data
  contactPersons: ContactPerson[];

  // Legacy / UI Helper Fields (kept for compatibility with existing components)
  name: string; // Primary Contact Name (from contactPersons[0] usually)
  title: string;
  email: string;
  phone: string;
  mobile?: string;
  avatar: string;
  dealValue: number;
  stage: DealStage;
  lastContactDate: string;
  interactions: Interaction[];
  comments: Comment[];
  salesHistory: SalesRecord[];
  topProducts: string[];
  assignedAgent?: string; // Sync with 'salesman'

  // AI Enriched Fields
  aiScore?: number;
  aiReasoning?: string;
  winProbability?: number;
  nextBestAction?: string;

  // Legacy address fields mapping
  officeAddress?: string;
  shippingAddress?: string;
  totalSales?: number;
  balance?: number;
  salesByYear?: Record<string, number>;

  // Soft delete fields
  is_deleted?: boolean;
  deleted_at?: string;
  updated_at?: string;
}

export interface LeadScoreResult {
  score: number;
  winProbability: number;
  reasoning: string;
  nextBestAction: string;
  riskFactors: string[];
}

export interface DashboardStats {
  totalRevenue: number;
  activeDeals: number;
  avgWinRate: number;
  pipelineValue: number;
}

// New types for Pipeline View
export interface PipelineDeal {
  id: string;
  title: string;
  company: string;
  pastName?: string;
  contactName: string;
  avatar: string; // Contact avatar
  value: number;
  currency: string;
  stageId: string;
  ownerName?: string;
  ownerId?: string;
  team?: string;
  customerType?: 'VIP1' | 'VIP2' | 'Regular';
  createdAt?: string;
  updatedAt?: string;
  daysInStage?: number;
  isOverdue?: boolean;
  isWarning?: boolean; // For pink background
  nextStep?: string;
  entryEvidence?: string;
  exitEvidence?: string;
  riskFlag?: string;
  is_deleted?: boolean;
  deleted_at?: string;
}

export interface PipelineColumn {
  id: string;
  title: string;
  color: string; // Tailwind text color class e.g. 'text-yellow-500'
  accentColor: string; // Hex for border/bg
  probability?: number; // Weighted forecast probability
  entryCriteria?: string;
  exitCriteria?: string;
  keyActivities?: string[];
  rootingDays?: number; // Max days before flagged as stalled
}

// Product Database Type
export interface Product {
  id: string;
  part_no: string;
  oem_no: string;
  brand: string;
  barcode: string;
  no_of_pieces_per_box: number;
  item_code: string;
  description: string;
  size: string;
  reorder_quantity: number;
  status: 'Active' | 'Inactive' | 'Discontinued';
  category: string;
  descriptive_inquiry: string;
  no_of_holes: string;
  replenish_quantity: number;
  original_pn_no: string;
  application: string;
  no_of_cylinder: string;

  // Price Groups
  price_aa: number;
  price_bb: number;
  price_cc: number;
  price_dd: number;
  price_vip1: number;
  price_vip2: number;
  cost?: number;

  // Warehouse Stocks
  stock_wh1: number;
  stock_wh2: number;
  stock_wh3: number;
  stock_wh4: number;
  stock_wh5: number;
  stock_wh6: number;

  // Soft delete fields
  is_deleted?: boolean;
  deleted_at?: string;
  updated_at?: string;
}

export interface InventoryLog {
  id: string;
  item_id: string;
  date: string;
  transaction_type: 'Purchase Order' | 'Invoice' | 'Order Slip' | 'Transfer Receipt' | 'Credit Memo' | 'Stock Adjustment';
  reference_no: string;
  partner: string;
  warehouse_id: string;
  qty_in: number;
  qty_out: number;
  status_indicator: '+' | '-';
  unit_price: number;
  processed_by: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  is_deleted?: boolean;
  deleted_at?: string;
  balance?: number;
}

export interface InventoryLogWithProduct extends InventoryLog {
  product?: Product;
}

export interface InventoryLogFilters {
  item_id?: string;
  warehouse_id?: string;
  date_from?: string;
  date_to?: string;
  transaction_type?: string;
}

export type ReorderStatus = 'critical' | 'low' | 'healthy';

export type MovementClassification = 'fast' | 'slow' | 'normal';

export interface ReorderReportEntry {
  id: string;
  product_id?: string;
  part_no: string;
  description?: string;
  brand?: string;
  reorder_point: number;
  total_stock: number;
  replenish_quantity: number;
  status: ReorderStatus;
  stock_snapshot: Record<string, number>;
  notes?: string;
  created_at: string;
  updated_at: string;
  // New fields for badges
  movement_classification?: MovementClassification;
  complaint_count?: number;
}

// --- Daily Call Monitoring Types ---
export type CallOutcome = 'follow_up' | 'positive' | 'negative' | 'note' | 'other';

export interface CallLogEntry {
  id: string;
  contact_id: string;
  agent_name: string;
  channel: 'call' | 'text';
  direction: 'inbound' | 'outbound';
  duration_seconds: number;
  notes?: string;
  outcome: CallOutcome;
  occurred_at: string;
  next_action?: string | null;
  next_action_due?: string | null;
}

export interface Inquiry {
  id: string;
  contact_id: string;
  title: string;
  channel: 'call' | 'text' | 'email' | 'chat';
  sentiment?: 'positive' | 'neutral' | 'negative';
  occurred_at: string;
  notes?: string;
}

export interface Purchase {
  id: string;
  contact_id: string;
  amount: number;
  status: 'paid' | 'pending' | 'cancelled';
  purchased_at: string;
  notes?: string;
}

export interface TeamMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar?: string;
  message: string;
  created_at: string;
  is_from_owner: boolean;
}

export type DailyCallCustomerFilterStatus = 'all' | 'active' | 'inactive' | 'prospective';

export interface DailyActivityRecord {
  id: string;
  contact_id: string;
  activity_date: string;
  activity_type: 'call' | 'text' | 'order' | 'none';
  activity_count: number;
  notes?: string;
}

export interface LBCRTORecord {
  id: string;
  contact_id: string;
  date: string;
  tracking_number: string;
  reason: string;
  status: 'pending' | 'in_transit' | 'resolved' | 'cancelled';
  notes?: string;
}

export interface DailyCallCustomerRow {
  id: string;
  source: string;
  assignedTo: string;
  assignedDate?: string;
  clientSince: string;
  city: string;
  shopName: string;
  contactNumber: string;
  codeDate: string;
  ishinomotoDealerSince: string;
  ishinomotoSignageSince: string;
  quota: number;
  modeOfPayment: string;
  courier: string;
  status: CustomerStatus;
  outstandingBalance: number;
  averageMonthlyOrder: number;
  monthlyOrder: number;
  weeklyRangeTotals: number[];
  dailyActivity: DailyActivityRecord[];
}

export interface CustomerDetailExpansionState {
  isOpen: boolean;
  contactId: string | null;
  activeTab: 'sales' | 'incident' | 'returns' | 'lbc-rto' | 'purchase' | 'comments';
}

// --- Customer Database Enhancement Types ---

export interface PersonalComment {
  id: string;
  contact_id: string;
  author_id: string;
  author_name: string;
  author_avatar?: string;
  text: string;
  timestamp: string;
}

export interface SalesReport {
  id: string;
  contact_id: string;
  date: string;
  time: string;
  products: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
  currency: string;
  salesAgent: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvalDate?: string;
  notes?: string;
  created_at: string;
}

export interface DiscountRequest {
  id: string;
  contact_id: string;
  inquiry_id?: string;
  requestDate: string;
  discountPercentage: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvalDate?: string;
  notes?: string;
}

export interface UpdatedContactDetails {
  id: string;
  contact_id: string;
  changedFields: Record<string, {
    oldValue: any;
    newValue: any;
  }>;
  submittedBy: string;
  submittedDate: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvalDate?: string;
  notes?: string;
}

export interface SalesProgress {
  id: string;
  contact_id: string;
  inquiryDate: string;
  inquiry: string;
  stage: DealStage;
  stageChangedDate: string;
  expectedClosureDate?: string;
  outcome?: 'closed_won' | 'closed_lost';
  outcomDate?: string;
  lostReason?: string;
  notes?: string;
}

export interface RelatedTransaction {
  transaction_type: 'invoice' | 'order_slip' | 'sales_order' | 'sales_inquiry' | 'purchase_history';
  transaction_id: string;
  transaction_number: string;
  transaction_date: string;
}

export interface IncidentReport {
  id: string;
  contact_id: string;
  report_date: string;
  incident_date: string;
  issue_type: 'product_quality' | 'service_quality' | 'delivery' | 'other';
  description: string;
  reported_by: string;
  attachments?: string[];
  related_transactions?: RelatedTransaction[];
  approval_status: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  approval_date?: string;
  notes?: string;
}

export interface CreateIncidentReportInput {
  contact_id: string;
  report_date: string;
  incident_date: string;
  issue_type: 'product_quality' | 'service_quality' | 'delivery' | 'other';
  description: string;
  reported_by: string;
  attachments?: string[];
  related_transactions?: RelatedTransaction[];
  notes?: string;
}

export interface ContactTransaction {
  id: string;
  type: 'invoice' | 'order_slip' | 'sales_order' | 'sales_inquiry' | 'purchase_history';
  number: string;
  date: string;
  amount: number;
  label: string;
}

export interface IncidentReportWithCustomer extends IncidentReport {
  customer_company: string;
  customer_city: string;
  customer_salesman: string;
  contacts?: {
    company: string;
    city: string;
    salesman: string;
  };
}

export interface SalesReturn {
  id: string;
  contact_id: string;
  incident_report_id: string;
  returnDate: string;
  products: Array<{
    name: string;
    quantity: number;
    originalPrice: number;
    refundAmount: number;
  }>;
  totalRefund: number;
  currency: string;
  reason: string;
  status: 'processed' | 'pending';
  processedBy?: string;
  processedDate?: string;
  notes?: string;
}

export interface PurchaseHistory {
  id: string;
  contact_id: string;
  purchaseDate: string;
  products: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
  currency: string;
  paymentStatus: 'paid' | 'pending' | 'overdue';
  invoiceNumber?: string;
  notes?: string;
}

export interface InquiryHistory {
  id: string;
  contact_id: string;
  inquiryDate: string;
  product: string;
  quantity: number;
  status: 'converted' | 'pending' | 'cancelled';
  convertedToPurchase?: boolean;
  notes?: string;
}

export interface PaymentTerms {
  id: string;
  contact_id: string;
  termsType: 'cash' | 'credit' | 'installment';
  creditDays?: number;
  installmentMonths?: number;
  startDate: string;
  endDate?: string;
  status: 'active' | 'expired' | 'upgraded' | 'downgraded';
  previousTerms?: string;
  changedDate: string;
  changedBy?: string;
  reason?: string;
}

export interface CustomerMetrics {
  contact_id: string;
  averageMonthlyPurchase: number;
  purchaseFrequency: number; // Days between purchases
  outstandingBalance: number;
  totalPurchases: number;
  lastPurchaseDate?: string;
  averageOrderValue: number;
  currency: string;
}

// Management Page Types
export interface SalesPerformanceData {
  salesPersonName: string;
  currentMonthSales: number;
  previousMonthSales: number;
  salesChange: number;
  percentageChange: number;
  customerCount: number;
}

export interface CityPerformanceData {
  city: string;
  currentMonthSales: number;
  previousMonthSales: number;
  salesChange: number;
  percentageChange: number;
  customerCount: number;
}

export interface CustomerStatusPerformance {
  status: CustomerStatus;
  currentMonthSales: number;
  previousMonthSales: number;
  salesChange: number;
  percentageChange: number;
  customerCount: number;
}

export interface PaymentTypePerformance {
  paymentType: 'cash' | 'credit' | 'term';
  currentMonthSales: number;
  previousMonthSales: number;
  salesChange: number;
  percentageChange: number;
  customerCount: number;
}

export interface CustomerStatusNotification {
  id: string;
  contactId: string;
  company: string;
  city: string;
  salesman: string;
  status: CustomerStatus;
  notificationType: 'sales_increase' | 'sales_decrease' | 'inactive' | 'inactive_critical' | 'inquiry_only';
  lastPurchaseDate?: string;
  daysSinceLastPurchase?: number;
  currentMonthSales?: number;
  previousMonthSales?: number;
  salesChange?: number;
  inquiryToSalesRatio?: number;
  outstandingBalance?: number;
  severity: 'high' | 'medium' | 'low';
  createdAt: string;
}

export interface InquiryOnlyAlert {
  id: string;
  contactId: string;
  company: string;
  city: string;
  salesman: string;
  totalInquiries: number;
  totalPurchases: number;
  inquiryToPurchaseRatio: number;
  lastInquiryDate?: string;
  lastPurchaseDate?: string;
}

export interface MonthlyTeamPerformance {
  month: string;
  totalSales: number;
  activeSalesCount: number;
  totalCustomers: number;
  averageOrderValue: number;
}

// --- Sales Performance Leaderboard Types ---

export interface AgentSalesData {
  agent_id: string;
  agent_name: string;
  avatar_url?: string;
  total_sales: number;
  rank: number;
}

export interface TopCustomer {
  id: string;
  company: string;
  total_sales: number;
  last_purchase_date?: string;
}

export interface AgentPerformanceSummary {
  agent_id: string;
  agent_name: string;
  avatar_url?: string;
  monthly_quota: number;
  current_achievement: number;
  remaining_quota: number;
  achievement_percentage: number;
  prospective_count: number;
  active_count: number;
  inactive_count: number;
  // new fields for sales breakdown
  active_sales: number;
  prospective_sales: number;
  inactive_sales: number;
  top_customers: TopCustomer[];
}

// --- Sales Inquiry Types ---

export interface SalesInquiryItem {
  id: string;
  inquiry_id: string;
  item_id?: string;
  qty: number;
  part_no: string;
  item_code: string;
  location: string;
  description: string;
  unit_price: number;
  amount: number;
  remark?: string;
  approval_status: 'pending' | 'approved' | 'rejected';
}

export interface SalesInquiry {
  id: string;
  inquiry_no: string;
  contact_id: string;
  sales_date: string;
  sales_person: string;
  delivery_address: string;
  reference_no: string;
  customer_reference: string;
  send_by: string;
  price_group: string;
  credit_limit: number;
  terms: string;
  promise_to_pay: string;
  po_number: string;
  remarks?: string;
  inquiry_type: string;
  urgency: string;
  urgency_date?: string;
  grand_total: number;
  created_by: string;
  created_at: string;
  updated_at?: string;
  status: SalesInquiryStatus;
  is_deleted: boolean;
  deleted_at?: string;
  items?: SalesInquiryItem[];
}

export interface InquiryReportFilters {
  dateFrom: string;
  dateTo: string;
  customerId?: string;
  reportType: 'today' | 'week' | 'month' | 'year' | 'custom';
}

export interface InquiryReportData extends SalesInquiry {
  customer_company: string;
  formatted_date: string;
  formatted_time: string;
}

export interface SalesInquiryDTO {
  contact_id: string;
  sales_date: string;
  sales_person: string;
  delivery_address: string;
  reference_no: string;
  customer_reference: string;
  send_by: string;
  price_group: string;
  credit_limit: number;
  terms: string;
  promise_to_pay: string;
  po_number: string;
  remarks?: string;
  inquiry_type: string;
  urgency: string;
  urgency_date?: string;
  status?: SalesInquiryStatus;
  items: Omit<SalesInquiryItem, 'id' | 'inquiry_id'>[];
}

export interface SalesOrderItem {
  id: string;
  order_id: string;
  item_id?: string;
  qty: number;
  part_no: string;
  item_code: string;
  location: string;
  description: string;
  unit_price: number;
  amount: number;
  remark?: string;
  approval_status?: 'pending' | 'approved' | 'rejected';
}

export interface SalesOrder {
  id: string;
  order_no: string;
  inquiry_id?: string;
  contact_id: string;
  sales_date: string;
  sales_person: string;
  delivery_address: string;
  reference_no: string;
  customer_reference: string;
  send_by: string;
  price_group: string;
  credit_limit: number;
  terms: string;
  promise_to_pay: string;
  po_number: string;
  remarks?: string;
  inquiry_type: string;
  urgency: string;
  urgency_date?: string;
  grand_total: number;
  status: SalesOrderStatus;
  approved_by?: string;
  approved_at?: string;
  created_by: string;
  created_at: string;
  updated_at?: string;
  items: SalesOrderItem[];
  is_deleted?: boolean;
  deleted_at?: string;
}

export interface SalesOrderDTO {
  inquiry_id?: string;
  contact_id: string;
  sales_date: string;
  sales_person: string;
  delivery_address: string;
  reference_no: string;
  customer_reference: string;
  send_by: string;
  price_group: string;
  credit_limit: number;
  terms: string;
  promise_to_pay: string;
  po_number: string;
  remarks?: string;
  inquiry_type: string;
  urgency: string;
  urgency_date?: string;
  status?: SalesOrderStatus;
  approved_by?: string;
  approved_at?: string;
  items: Omit<SalesOrderItem, 'id' | 'order_id'>[];
}

export interface OrderSlipItem {
  id: string;
  order_slip_id: string;
  item_id?: string;
  qty: number;
  part_no: string;
  item_code: string;
  location: string;
  description: string;
  unit_price: number;
  amount: number;
  remark?: string;
}

export interface OrderSlip {
  id: string;
  slip_no: string;
  order_id: string;
  contact_id: string;
  sales_date: string;
  sales_person: string;
  delivery_address: string;
  reference_no: string;
  customer_reference: string;
  send_by: string;
  price_group: string;
  credit_limit: number;
  terms: string;
  promise_to_pay: string;
  po_number: string;
  remarks?: string;
  inquiry_type: string;
  urgency: string;
  urgency_date?: string;
  grand_total: number;
  status: OrderSlipStatus;
  printed_at?: string;
  printed_by?: string;
  created_by: string;
  created_at: string;
  updated_at?: string;
  items: OrderSlipItem[];
  is_deleted?: boolean;
  deleted_at?: string;
}

export interface OrderSlipDTO {
  order_id: string;
  contact_id: string;
  sales_date: string;
  sales_person: string;
  delivery_address: string;
  reference_no: string;
  customer_reference: string;
  send_by: string;
  price_group: string;
  credit_limit: number;
  terms: string;
  promise_to_pay: string;
  po_number: string;
  remarks?: string;
  inquiry_type: string;
  urgency: string;
  urgency_date?: string;
  status?: OrderSlipStatus;
  printed_at?: string;
  printed_by?: string;
  items: Omit<OrderSlipItem, 'id' | 'order_slip_id'>[];
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  item_id?: string;
  qty: number;
  part_no: string;
  item_code: string;
  description: string;
  unit_price: number;
  amount: number;
  // Optional per-line VAT rate; manual invoices may populate this
  // but it is not derived when converting sales orders, which use a global VAT rule.
  vat_rate?: number;
}

export interface Invoice {
  id: string;
  invoice_no: string;
  order_id: string;
  contact_id: string;
  sales_date: string;
  sales_person: string;
  delivery_address: string;
  reference_no: string;
  customer_reference: string;
  send_by: string;
  price_group: string;
  credit_limit: number;
  terms: string;
  promise_to_pay: string;
  po_number: string;
  remarks?: string;
  inquiry_type: string;
  urgency: string;
  urgency_date?: string;
  grand_total: number;
  status: InvoiceStatus;
  due_date?: string;
  payment_date?: string;
  payment_method?: string;
  printed_at?: string;
  sent_at?: string;
  created_by: string;
  created_at: string;
  updated_at?: string;
  items: InvoiceItem[];
  is_deleted?: boolean;
  deleted_at?: string;
}

export interface InvoiceDTO {
  order_id: string;
  contact_id: string;
  sales_date: string;
  sales_person: string;
  delivery_address: string;
  reference_no: string;
  customer_reference: string;
  send_by: string;
  price_group: string;
  credit_limit: number;
  terms: string;
  promise_to_pay: string;
  po_number: string;
  remarks?: string;
  inquiry_type: string;
  urgency: string;
  urgency_date?: string;
  status?: InvoiceStatus;
  due_date?: string;
  payment_date?: string;
  payment_method?: string;
  printed_at?: string;
  sent_at?: string;
  items: Omit<InvoiceItem, 'id' | 'invoice_id'>[];
}

// --- Developer Cockpit Types ---

export enum LogType {
  SYSTEM = 'system',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info'
}

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}

export interface SystemLog {
  id: string;
  log_type: LogType;
  log_level: LogLevel;
  message: string;
  details: Record<string, any>;
  user_id: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
  is_deleted: boolean;
  deleted_at: string | null;
}

export interface SystemMetric {
  id: string;
  metric_name: string;
  metric_value: Record<string, any>;
  timestamp: string;
  is_deleted: boolean;
  deleted_at: string | null;
}

export enum DeploymentType {
  API = 'api',
  FRONTEND = 'frontend',
  DATABASE = 'database',
  INFRASTRUCTURE = 'infrastructure'
}

export enum DeploymentStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  SUCCESS = 'success',
  FAILED = 'failed',
  ROLLBACK = 'rollback'
}

export interface DeploymentRecord {
  id: string;
  deployment_type: DeploymentType;
  deployment_version: string;
  deployment_description: string;
  deployment_status: DeploymentStatus;
  deployment_start: string;
  deployment_end: string | null;
  deployment_log: string;
  is_deleted: boolean;
  deleted_at: string | null;
}

export interface SystemSetting {
  id: string;
  setting_key: string;
  setting_value: Record<string, any>;
  description: string;
  is_deleted: boolean;
  deleted_at: string | null;
}

// --- Recycle Bin Types ---

export enum RecycleBinItemType {
  CONTACT = 'contact',
  INQUIRY = 'inquiry',
  ORDER = 'order',
  ORDERSLIP = 'orderslip',
  INVOICE = 'invoice',
  TASK = 'task',
  PRODUCT = 'product',
  TEAM_MESSAGE = 'team_message',
  COMMENT = 'comment',
  NOTIFICATION = 'notification',
  DEAL = 'deal'
}

export interface RecycleBinItem {
  id: string;
  item_type: RecycleBinItemType;
  item_id: string;
  original_data: Record<string, any>;
  deleted_by: string;
  deleted_at: string;
  restore_token: string;
  expires_at: string;
  is_restored: boolean;
  restored_at: string | null;
  restored_by: string | null;
  permanent_delete_at: string;
}

// Purchase Order types
export interface PurchaseOrderItem {
  id: string;
  po_id: string;
  item_id: string;
  qty: number;
  unit_price: number;
  amount: number;
  notes?: string;
}

export interface PurchaseOrder {
  id: string;
  po_no: string;
  supplier_id: string;
  order_date: string;
  delivery_date?: string;
  warehouse_id: string;
  status: 'draft' | 'ordered' | 'delivered' | 'cancelled';
  grand_total: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  deleted_at?: string;
  items?: PurchaseOrderItem[];
}

export interface PurchaseOrderDTO {
  po_no: string;
  supplier_id: string;
  order_date: string;
  delivery_date?: string;
  warehouse_id: string;
  items: Omit<PurchaseOrderItem, 'id' | 'po_id' | 'amount'>[];
}

export enum PurchaseOrderStatus {
  DRAFT = 'draft',
  ORDERED = 'ordered',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled'
}

// Stock Adjustment types
export interface StockAdjustmentItem {
  id: string;
  adjustment_id: string;
  item_id: string;
  system_qty: number;
  physical_qty: number;
  difference: number;
  reason?: string;
}

export interface StockAdjustment {
  id: string;
  adjustment_no: string;
  adjustment_date: string;
  warehouse_id: string;
  adjustment_type: 'physical_count' | 'damage' | 'correction';
  notes?: string;
  status: 'draft' | 'finalized';
  processed_by?: string;
  created_at: string;
  updated_at: string;
  items?: StockAdjustmentItem[];
}

export interface StockAdjustmentDTO {
  adjustment_no: string;
  adjustment_date: string;
  warehouse_id: string;
  adjustment_type: 'physical_count' | 'damage' | 'correction';
  notes?: string;
  items: Omit<StockAdjustmentItem, 'id' | 'adjustment_id' | 'difference'>[];
}

export enum StockAdjustmentType {
  PHYSICAL_COUNT = 'physical_count',
  DAMAGE = 'damage',
  CORRECTION = 'correction'
}

export interface TransferStockItem {
  id: string;
  transfer_id: string;
  item_id: string;
  from_warehouse_id: string;
  to_warehouse_id: string;
  transfer_qty: number;
  notes?: string;
  created_at: string;
}

export interface TransferStock {
  id: string;
  transfer_no: string;
  transfer_date: string;
  status: 'pending' | 'submitted' | 'approved' | 'deleted';
  notes?: string;
  processed_by?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  deleted_at?: string;
  items?: TransferStockItem[];
}

export interface TransferStockDTO {
  transfer_no: string;
  transfer_date: string;
  notes?: string;
  items: Omit<TransferStockItem, 'id' | 'transfer_id' | 'created_at'>[];
}

export enum TransferStockStatus {
  PENDING = 'pending',
  SUBMITTED = 'submitted',
  APPROVED = 'approved',
  DELETED = 'deleted'
}

export enum DeliveryReceiptStatus {
  DRAFT = 'draft',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

export interface DeliveryReceiptItem {
  id: string;
  dr_id: string;
  item_id?: string;
  qty: number;
  part_no?: string;
  item_code?: string;
  location?: string;
  description?: string;
  unit_price: number;
  amount: number;
  remark?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DeliveryReceipt {
  id: string;
  dr_no: string;
  order_id?: string;
  contact_id?: string;
  sales_date: string;
  sales_person?: string;
  delivery_address?: string;
  reference_no?: string;
  customer_reference?: string;
  send_by?: string;
  price_group?: string;
  credit_limit?: number;
  terms?: string;
  promise_to_pay?: string;
  po_number?: string;
  remarks?: string;
  inquiry_type?: string;
  urgency?: string;
  urgency_date?: string;
  grand_total: number;
  status: DeliveryReceiptStatus;
  printed_at?: string;
  printed_by?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  deleted_at?: string;
  items?: DeliveryReceiptItem[];
  contact?: { company: string };
  sales_order?: { order_no: string };
}

export interface DeliveryReceiptDTO {
  order_id?: string;
  contact_id: string;
  sales_date: string;
  sales_person?: string;
  delivery_address?: string;
  reference_no?: string;
  customer_reference?: string;
  send_by?: string;
  price_group?: string;
  credit_limit?: number;
  terms?: string;
  promise_to_pay?: string;
  po_number?: string;
  remarks?: string;
  inquiry_type?: string;
  urgency?: string;
  urgency_date?: string;
  status?: DeliveryReceiptStatus;
  items: Omit<DeliveryReceiptItem, 'id' | 'dr_id' | 'created_at' | 'updated_at'>[];
}

export interface SalesReportFilters {
  dateFrom: string;
  dateTo: string;
  customerId: string | 'all';
}

export interface SalesReportTransaction {
  id: string;
  date: string;
  customer: string;
  customerId: string;
  terms: string;
  refNo: string;
  soNo: string;
  soAmount: number;
  drAmount: number;
  invoiceAmount: number;
  salesperson: string;
  category: string;
  vatType: 'exclusive' | 'inclusive' | null;
  type: 'invoice' | 'dr';
  orderSlipAmount?: number;
}

export interface CategoryTotal {
  category: string;
  soAmount: number;
  drAmount: number;
  invoiceAmount: number;
}

export interface SalespersonTotal {
  salesperson: string;
  categories: CategoryTotal[];
  total: number;
}

export interface GrandTotal {
  soAmount: number;
  drAmount: number;
  invoiceAmount: number;
  total: number;
}

export interface SalesReportSummary {
  categoryTotals: CategoryTotal[];
  salespersonTotals: SalespersonTotal[];
  grandTotal: GrandTotal;
}

export interface SalesReportData {
  transactions: SalesReportTransaction[];
  summary: SalesReportSummary;
}

export interface CustomerOption {
  id: string;
  company: string;
}

export type MovementCategory = 'fast' | 'slow';

export interface FastSlowMovementItem {
  item_id: string;
  part_no: string;
  item_code: string;
  description: string;
  first_arrival_date: string | null;
  total_purchased: number;
  total_sold: number;
  month1_sales: number;
  month2_sales: number;
  month3_sales: number;
  month1_label: string;
  month2_label: string;
  month3_label: string;
  category: MovementCategory;
}

export interface FastSlowReportFilters {
  sortBy: 'sales_volume' | 'part_no';
  sortDirection: 'asc' | 'desc';
}

export interface FastSlowReportData {
  fastMovingItems: FastSlowMovementItem[];
  slowMovingItems: FastSlowMovementItem[];
  generatedAt: string;
}

export type InventoryAuditTimePeriod = 'today' | 'week' | 'month' | 'year' | 'custom';

export interface InventoryAuditFilters {
  timePeriod: InventoryAuditTimePeriod;
  dateFrom?: string;
  dateTo?: string;
  partNo?: string;
  itemCode?: string;
}

export interface InventoryAuditRecord {
  id: string;
  item_id: string;
  item_code: string;
  part_no: string;
  description: string;
  brand: string;
  adjustment_date: string;
  adjustment_type: 'physical_count' | 'damage' | 'correction';
  adjustment_no: string;
  warehouse_id: string;
  system_qty: number;
  physical_qty: number;
  difference: number;
  reason: string;
  processed_by: string;
  processor_name?: string;
  notes?: string;
}

export interface InventoryAuditReportData {
  records: InventoryAuditRecord[];
  totalAdjustments: number;
  totalPositive: number;
  totalNegative: number;
  generatedAt: string;
  filters: InventoryAuditFilters;
}

// ============================================================================
// Product Promotion Management Types
// ============================================================================

export type PromotionStatus = 'Draft' | 'Active' | 'Expired' | 'Cancelled';
export type PostingStatus = 'Not Posted' | 'Pending Review' | 'Approved' | 'Rejected';

export interface Promotion {
  id: string;
  campaign_title: string;
  description?: string;
  start_date?: string;
  end_date: string;
  status: PromotionStatus;
  created_by: string;
  assigned_to: string[];  // Empty array = all sales persons
  target_platforms: string[];
  // Client/City Targeting
  target_all_clients: boolean;  // When true, applies to all clients
  target_client_ids: string[];  // Specific client IDs when target_all_clients is false
  target_cities: string[];      // Optional city filter
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  is_deleted: boolean;
  // Joined data
  creator?: UserProfile;
  products?: PromotionProduct[];
  postings?: PromotionPosting[];
}

export interface PromotionProduct {
  id: string;
  promotion_id: string;
  product_id: string;
  promo_price_aa?: number;
  promo_price_bb?: number;
  promo_price_cc?: number;
  promo_price_dd?: number;
  promo_price_vip1?: number;
  promo_price_vip2?: number;
  created_at: string;
  // Joined product data
  product?: Product;
}

export interface PromotionPosting {
  id: string;
  promotion_id: string;
  platform_name: string;
  posted_by?: string;
  post_url?: string;
  screenshot_url?: string;
  status: PostingStatus;
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  poster?: UserProfile;
  reviewer?: UserProfile;
}

export interface CreatePromotionDTO {
  campaign_title: string;
  description?: string;
  start_date?: string;
  end_date: string;
  assigned_to: string[];  // Empty = all sales persons
  target_platforms: string[];
  // Client/City Targeting
  target_all_clients?: boolean;  // Default true = all clients
  target_client_ids?: string[];  // Specific client IDs
  target_cities?: string[];      // Optional city filter
  products: Array<{
    product_id: string;
    promo_price_aa?: number;
    promo_price_bb?: number;
    promo_price_cc?: number;
    promo_price_dd?: number;
    promo_price_vip1?: number;
    promo_price_vip2?: number;
  }>;
}

export interface UpdatePromotionDTO {
  campaign_title?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  status?: PromotionStatus;
  assigned_to?: string[];
  target_platforms?: string[];
  target_all_clients?: boolean;
  target_client_ids?: string[];
  target_cities?: string[];
}

export interface PromotionFilters {
  status?: PromotionStatus | PromotionStatus[];
  created_by?: string;
  assigned_to?: string;
  expiring_within_days?: number;
  search?: string;
}

export interface PromotionPerformance {
  promotion_id: string;
  total_sales: number;
  total_orders: number;
  products_sold: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    revenue: number;
  }>;
  date_range: {
    start: string;
    end: string;
  };
}

export interface PromotionStats {
  total_active: number;
  pending_reviews: number;
  expiring_soon: number;
}

// --- AI Customer Service Types ---

export type AIConversationChannel = 'sms';
export type AIConversationPurpose = 'lead_gen' | 'inquiry' | 'complaint' | 'delivery' | 'sales';
export type AIConversationStatus = 'active' | 'completed' | 'escalated' | 'abandoned';
export type AIConversationOutcome = 'resolved' | 'escalated' | 'follow_up' | 'converted';
export type AIMessageRole = 'customer' | 'ai' | 'agent';
export type AIEscalationReason = 'low_confidence' | 'customer_request' | 'complex_issue' | 'vip_customer';
export type AIEscalationPriority = 'urgent' | 'high' | 'normal' | 'low';
export type AIEscalationStatus = 'pending' | 'in_progress' | 'resolved';

export interface AIStandardAnswer {
  id: string;
  category: string;
  trigger_keywords: string[];
  question_template: string;
  answer_template: string;
  variables?: Record<string, string>;
  is_active: boolean;
  priority: number;
  created_by?: string;
  created_at: string;
  updated_at?: string;
}

export interface AIConversation {
  id: string;
  contact_id?: string;
  phone_number?: string;
  channel: AIConversationChannel;
  purpose: AIConversationPurpose;
  status: AIConversationStatus;
  started_at: string;
  ended_at?: string;
  duration_seconds?: number;
  outcome?: AIConversationOutcome;
  sentiment?: 'positive' | 'neutral' | 'negative';
  summary?: string;
  assigned_agent_id?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at?: string;
  // Joined fields
  contact?: Contact;
  assigned_agent?: UserProfile;
  messages?: AIConversationMessage[];
}

export interface AIConversationMessage {
  id: string;
  conversation_id: string;
  role: AIMessageRole;
  content: string;
  timestamp: string;
  standard_answer_id?: string;
  confidence_score?: number;
}

export interface AIEscalation {
  id: string;
  conversation_id: string;
  reason: AIEscalationReason;
  priority: AIEscalationPriority;
  assigned_to?: string;
  status: AIEscalationStatus;
  created_at: string;
  resolved_at?: string;
  resolution_notes?: string;
  // Joined fields
  conversation?: AIConversation;
  assigned_agent?: UserProfile;
}

export interface CreateAIStandardAnswerInput {
  category: string;
  trigger_keywords: string[];
  question_template: string;
  answer_template: string;
  variables?: Record<string, string>;
  priority?: number;
}

export interface UpdateAIStandardAnswerInput {
  category?: string;
  trigger_keywords?: string[];
  question_template?: string;
  answer_template?: string;
  variables?: Record<string, string>;
  priority?: number;
  is_active?: boolean;
}

export interface AIConversationFilters {
  status?: AIConversationStatus;
  purpose?: AIConversationPurpose;
  contact_id?: string;
  date_from?: string;
  date_to?: string;
}

export interface AIEscalationWithDetails extends AIEscalation {
  conversation: AIConversation & {
    contact?: Contact;
  };
  assigned_agent?: UserProfile;
}

export interface AIDashboardStats {
  active_conversations: number;
  today_conversations: number;
  escalation_rate: number;
  avg_response_time_seconds: number;
  sentiment_breakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };
  purpose_breakdown: Record<AIConversationPurpose, number>;
}

// ============================================================================
// Loyalty Discount (Regular Buyer Discount) Types
// ============================================================================

export type LoyaltyEvaluationPeriod = 'calendar_month' | 'rolling_30_days';
export type LoyaltyEligibilityStatus = 'eligible' | 'partially_used' | 'fully_used' | 'expired';

export interface LoyaltyDiscountRule {
  id: string;
  name: string;
  description?: string;
  min_purchase_amount: number;
  discount_percentage: number;
  evaluation_period: LoyaltyEvaluationPeriod;
  is_active: boolean;
  priority: number;
  created_by?: string;
  created_at: string;
  updated_at?: string;
  is_deleted: boolean;
  deleted_at?: string;
}

export interface ClientMonthlyPurchase {
  id: string;
  client_id: string;
  year_month: string;  // e.g., '2026-01'
  total_amount: number;
  order_count: number;
  last_order_date?: string;
  created_at: string;
  updated_at?: string;
  // Joined data
  client?: Contact;
}

export interface ClientDiscountEligibility {
  id: string;
  client_id: string;
  rule_id: string;
  eligible_month: string;
  qualifying_month: string;
  qualifying_amount: number;
  discount_percentage: number;
  status: LoyaltyEligibilityStatus;
  total_discount_applied?: number;
  usage_count?: number;
  created_at: string;
  expires_at: string;
  // Joined data
  client?: Contact;
  rule?: LoyaltyDiscountRule;
}

export interface DiscountUsageLog {
  id: string;
  eligibility_id: string;
  order_id?: string;
  invoice_id?: string;
  order_amount: number;
  discount_amount: number;
  applied_by?: string;
  applied_at: string;
  notes?: string;
  // Joined data
  eligibility?: ClientDiscountEligibility;
  applier?: UserProfile;
}

export interface CreateLoyaltyDiscountRuleDTO {
  name: string;
  description?: string;
  min_purchase_amount: number;
  discount_percentage: number;
  evaluation_period?: LoyaltyEvaluationPeriod;
  priority?: number;
}

export interface UpdateLoyaltyDiscountRuleDTO {
  name?: string;
  description?: string;
  min_purchase_amount?: number;
  discount_percentage?: number;
  evaluation_period?: LoyaltyEvaluationPeriod;
  priority?: number;
  is_active?: boolean;
}

export interface LoyaltyDiscountStats {
  total_active_rules: number;
  clients_eligible_this_month: number;
  total_discount_given_this_month: number;
  top_qualifying_clients: Array<{
    client_id: string;
    client_name: string;
    qualifying_amount: number;
    discount_percentage: number;
  }>;
}

export interface ClientActiveDiscount {
  eligibility_id: string;
  discount_percentage: number;
  qualifying_amount: number;
  expires_at: string;
}

// ============================================================================
// Profit Protection & System Settings Types
// ============================================================================

export type OverrideType = 'price_adjustment' | 'full_approval' | 'discount_override' | 'discount_rule' | 'profit_threshold';

// Note: SystemSetting interface is already defined above (line ~1204)

export interface ProfitThresholdConfig {
  percentage: number;
  enforce_approval: boolean;
  allow_override: boolean;
}

export interface AISalesAgentConfig {
  default_language: 'tagalog' | 'english';
  fallback_language: 'tagalog' | 'english';
  max_retries: number;
  response_timeout_seconds: number;
}

export interface ProfitOverrideLog {
  id: string;
  order_id?: string;
  invoice_id?: string;
  item_id: string;
  original_price: number;
  override_price: number;
  cost: number;
  original_profit_pct: number;
  override_profit_pct: number;
  reason?: string;
  override_type: OverrideType;
  approved_by: string;
  created_at: string;
  // Joined data
  approver?: UserProfile;
  item?: Product;
}

export interface AdminOverrideLog {
  id: string;
  override_type: string;
  entity_type: string;
  entity_id: string;
  original_value?: Record<string, any>;
  override_value?: Record<string, any>;
  reason?: string;
  performed_by: string;
  created_at: string;
  // Joined data
  performer?: UserProfile;
}

export interface LowProfitItem {
  product_id: string;
  product_name: string;
  item_code: string;
  cost: number;
  selling_price: number;
  discount: number;
  net_price: number;
  profit_amount: number;
  profit_percentage: number;
  threshold_percentage: number;
  below_threshold: boolean;
}

export interface ProfitCalculation {
  selling_price: number;
  cost: number;
  discount: number;
  net_price: number;
  profit_amount: number;
  profit_percentage: number;
  is_below_threshold: boolean;
  suggested_price?: number;
}

export interface CreateProfitOverrideDTO {
  order_id?: string;
  invoice_id?: string;
  item_id: string;
  original_price: number;
  override_price: number;
  cost: number;
  original_profit_pct: number;
  override_profit_pct: number;
  reason?: string;
  override_type: OverrideType;
}

export interface CreateAdminOverrideDTO {
  override_type: string;
  entity_type: string;
  entity_id: string;
  original_value?: Record<string, any>;
  override_value?: Record<string, any>;
  reason?: string;
}

// ============================================================================
// AI Sales Agent Types
// ============================================================================

export type AIOutreachType = 'sms' | 'call' | 'chat';
export type AIOutreachStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'responded';
export type AIOutreachOutcome = 'interested' | 'not_interested' | 'no_response' | 'converted' | 'escalated';
export type AIFeedbackType = 'objection' | 'interest' | 'question' | 'conversion' | 'complaint' | 'positive';
export type AISentiment = 'positive' | 'neutral' | 'negative';
export type AIMessageLanguage = 'tagalog' | 'english';

export interface AICampaignOutreach {
  id: string;
  campaign_id: string;
  client_id: string;
  outreach_type: AIOutreachType;
  status: AIOutreachStatus;
  language: AIMessageLanguage;
  message_content?: string;
  scheduled_at?: string;
  sent_at?: string;
  response_received: boolean;
  response_content?: string;
  outcome?: AIOutreachOutcome;
  conversation_id?: string;
  error_message?: string;
  retry_count: number;
  created_by?: string;
  created_at: string;
  updated_at?: string;
  // Joined data
  campaign?: Promotion;
  client?: Contact;
  conversation?: AIConversation;
}

export interface AICampaignFeedback {
  id: string;
  campaign_id: string;
  outreach_id?: string;
  client_id?: string;
  feedback_type: AIFeedbackType;
  content: string;
  sentiment?: AISentiment;
  tags?: string[];
  ai_analysis?: Record<string, any>;
  created_at: string;
  // Joined data
  campaign?: Promotion;
  outreach?: AICampaignOutreach;
  client?: Contact;
}

export interface AIMessageTemplate {
  id: string;
  name: string;
  language: AIMessageLanguage;
  template_type: string;
  content: string;
  variables: string[];
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at?: string;
}

export interface CreateAIMessageTemplateDTO {
  name: string;
  language: AIMessageLanguage;
  template_type: string;
  content: string;
  variables: string[];
  is_active?: boolean;
}

export interface CreateAICampaignOutreachDTO {
  campaign_id: string;
  client_ids: string[];
  outreach_type: AIOutreachType;
  language: AIMessageLanguage;
  scheduled_at?: string;
  message_template_id?: string;
  custom_message?: string;
}

export interface AICampaignStats {
  total_outreach: number;
  pending_count: number;
  sent_count: number;
  delivered_count: number;
  responded_count: number;
  failed_count: number;
  conversion_rate: number;
  response_rate: number;
  sentiment_breakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };
  outcome_breakdown: Record<AIOutreachOutcome, number>;
}

export interface AIAgentCapabilities {
  can_handle_inbound: boolean;
  can_handle_outbound: boolean;
  supported_languages: AIMessageLanguage[];
  supported_channels: AIOutreachType[];
  can_offer_discount: boolean;
  max_discount_percentage: number;
  requires_human_approval_for: string[];
}
