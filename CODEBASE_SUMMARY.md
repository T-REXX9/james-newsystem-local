# Codebase Summary - TND OPC System

## Project Overview

**Project Name:** Role-Based Permission of TND OPC
**Type:** Enterprise Resource Planning (ERP) / Customer Relationship Management (CRM) System
**Tech Stack:** React 19.2.0, TypeScript, Vite, Supabase

This is a comprehensive business management system designed for sales operations, warehouse management, customer relationship management, and accounting. It features role-based access control, real-time notifications, and a hierarchical module structure.

---

## Core Technologies

### Frontend Framework
- **React 19.2.0** - UI library
- **TypeScript 5.8.2** - Type safety
- **Vite 6.2.0** - Build tool and dev server

### UI Libraries
- **Lucide React** - Icon library
- **Recharts 3.4.1** - Data visualization/charts
- **@tanstack/react-virtual** - Virtual scrolling for large lists
- **@dnd-kit/core & @dnd-kit/sortable** - Drag and drop functionality

### Backend & Database
- **Supabase JS 2** - Backend-as-a-Service (PostgreSQL database, auth, real-time)
- **@google/genai** - AI integration for lead scoring and insights

### Testing
- **Vitest 4.0.14** - Unit testing framework
- **@testing-library/react** - React component testing
- **jsdom** - DOM simulation for tests

---

## Complete File Hierarchy

```
james-newsystem/
├── .claude/                          # Claude Code configuration
│   └── ralph-loop.local.md           # Ralph loop state file
├── .github/
│   └── workflows/                    # GitHub Actions CI/CD
├── .git/
├── .kilocode/
│   └── rules/                        # Kilocode AI rules
├── components/                       # React components (69 files)
│   ├── __tests__/                    # Component tests
│   │   ├── AccessControlSettings.test.tsx
│   │   ├── App.test.tsx
│   │   └── OwnerDailyCallMonitoringUnifiedView.test.tsx
│   ├── AccessControlSettings.tsx     # Role & permission management
│   ├── AddContactModal.tsx           # Add customer contact modal
│   ├── AgentActivityFeed.tsx         # Sales agent activity display
│   ├── AgentCallActivity.tsx         # Call tracking display
│   ├── AgentSummaryModal.tsx         # Agent performance summary
│   ├── AgentTasksList.tsx            # Task management for agents
│   ├── CompanyName.tsx               # Company branding component
│   ├── ContactDetails.tsx            # Customer contact information
│   ├── CreateIncidentReportModal.tsx # Incident reporting
│   ├── CustomerDatabase.tsx          # Customer management
│   ├── CustomerMetricsView.tsx       # Customer analytics
│   ├── DailyCallMonitoringView.tsx   # Daily call tracking (agents)
│   ├── Dashboard.tsx                 # Main dashboard (owner/manager)
│   ├── DiscountRequestModal.tsx      # Discount approval workflow
│   ├── IncidentReportTab.tsx         # Incident reports display
│   ├── InquiryHistoryTab.tsx         # Customer inquiry history
│   ├── InquiryReportFilter.tsx       # Inquiry report filtering
│   ├── InquiryReportView.tsx         # Inquiry reports
│   ├── InvoiceView.tsx               # Invoice management
│   ├── Login.tsx                     # Authentication
│   ├── ManagementView.tsx            # Management dashboard
│   ├── MetricsCard.tsx               # KPI metrics display
│   ├── NotificationCenter.tsx        # Notification center UI
│   ├── NotificationProvider.tsx      # Notification system provider
│   ├── OrderSlipView.tsx             # Order slip management
│   ├── OwnerLiveCallMonitoringView.tsx # Live call monitoring (owner)
│   ├── PipelineView.tsx              # Sales pipeline board
│   ├── ProductAutocomplete.tsx       # Product search/autocomplete
│   ├── ProductDatabase.tsx           # Product inventory management
│   ├── ProductSearchModal.tsx        # Product search modal
│   ├── PurchaseHistoryTab.tsx        # Purchase history
│   ├── PurchaseOrderView.tsx         # Purchase order management
│   ├── RecycleBinView.tsx            # Deleted items recovery
│   ├── ReorderReport.tsx             # Reorder point reports
│   ├── ReportsView.tsx               # Accounting reports overview
│   ├── SalesAgentDashboard.tsx       # Sales agent home dashboard
│   ├── SalesInquiryView.tsx          # Sales inquiry management
│   ├── SalesOrderView.tsx            # Sales order management
│   ├── SalesPerformanceCard.tsx      # Sales performance metrics
│   ├── SalesReportTab.tsx            # Sales reports
│   ├── SalesReturnTab.tsx            # Sales returns
│   ├── StaffView.tsx                 # Staff account management
│   ├── StatusBadge.tsx               # Status indicator badges
│   ├── StockAdjustmentView.tsx       # Stock adjustment
│   ├── StockMovementView.tsx         # Stock movement tracking
│   ├── TasksView.tsx                 # Task management
│   ├── ToastProvider.tsx             # Toast notification provider
│   ├── TopNav.tsx                    # Top navigation bar
│   ├── TopbarNavigation.tsx          # Topbar navigation component
│   ├── UpdateContactApprovalModal.tsx # Contact update approval
│   ├── WorkflowStepper.tsx           # Workflow stepper UI
│   ├── callMetricsUtils.ts           # Call metrics utilities
│   └── InventoryLogRow.tsx           # Inventory log display
├── conductor/                        # Conductor framework (code standards)
│   ├── code_styleguides/
│   └── tracks/
├── data/                             # Static data or fixtures
├── docs/                             # Documentation (17 files)
│   ├── ADDING_NAVIGATION_ITEMS.md    # Navigation addition guide
│   ├── IMPLEMENTATION_SUMMARY.md     # Implementation summary
│   ├── PIPELINE_FEATURES_AND_NAVIGATION.md
│   ├── PIPELINE_MENU_ADDITION.md
│   ├── REALTIME_MIGRATION_STATUS.md  # Real-time feature migration status
│   ├── REALTIME_PATTERNS.md          # Real-time patterns
│   ├── SIDEBAR_BEFORE_AFTER.md       # Sidebar changes documentation
│   ├── TOPBAR_BEFORE_AFTER_COMPARISON.md
│   ├── TOPBAR_IMPLEMENTATION_CHECKLIST.md
│   ├── TOPBAR_JOLTING_FIX.md         # Topbar positioning fix
│   ├── TOPBAR_NAVIGATION_GUIDE.md    # Topbar navigation guide
│   ├── TOPBAR_POSITIONING_TEST_GUIDE.md
│   ├── TOPBAR_SMART_POSITIONING_IMPLEMENTATION.md
│   └── database_schema.md            # Database schema documentation
├── hooks/                            # Custom React hooks
│   └── __tests__/                    # Hook tests
├── lib/                              # Library utilities
├── md files/                         # Markdown documentation files (36 files)
├── references/                       # Reference documentation
│   ├── client_requirements.md
│   ├── sales_forecasting.md
│   └── sales_pipeline.md
├── scripts/                          # Utility scripts
├── services/                         # Business logic services (20 files)
│   └── __tests__/                    # Service tests
├── src/                              # Source files (minimal, mostly at root)
│   └── utils/
│       └── __tests__/
├── supabase/                         # Supabase configuration
│   ├── .temp/
│   └── migrations/                   # Database migrations
├── utils/                            # Utility functions
│   ├── __tests__/
│   │   └── optimisticUpdates.test.ts
│   ├── optimisticUpdates.ts          # Optimistic UI updates
│   ├── subscriptionManager.ts        # Real-time subscriptions
│   └── topbarMenuConfig.ts           # Topbar menu configuration
├── App.tsx                           # Main application component (535 lines)
├── checkSupabaseConnection.js        # Supabase connection checker
├── constants.ts                      # Application constants (200 lines)
├── index.html                        # HTML entry point
├── index.tsx                         # Application entry point
├── issue.md                          # Issue tracking
├── INVENTORY_LOGS_FIX_SUMMARY.md     # Inventory logs fix summary
├── metadata.json                     # Project metadata
├── package.json                      # NPM dependencies
├── package-lock.json                 # NPM lock file
├── TOPBAR_SMART_POSITIONING_SUMMARY.md
├── tsconfig.json                     # TypeScript configuration
├── types.ts                          # TypeScript type definitions (1,318 lines)
├── vite.config.ts                    # Vite build configuration
└── vitest.setup.ts                   # Vitest test setup

---

## System Architecture

### Authentication & Authorization
- **Supabase Auth** for user authentication
- **Role-Based Access Control (RBAC)** with hierarchical permissions
- **User Roles:** Owner, Manager, Senior Agent, Sales Agent, Support, Developer
- **Access Rights:** Granular module-level permissions with 72+ available modules
- **Module ID System:** Canonical hierarchical IDs (e.g., `warehouse-inventory-product-database`)

### Database Architecture (Supabase/PostgreSQL)
- **Soft Delete Pattern:** All major tables use `is_deleted` and `deleted_at` fields
- **Recycle Bin:** 30-day retention for deleted items with restore capability
- **Real-time Subscriptions:** Live updates for collaborative features
- **Audit Trail:** Activity logs and change tracking

---

## Core Features & Modules

### 1. **Sales Management**

#### Pipeline/Deal Management
- Kanban-style pipeline board with drag-and-drop
- Deal stages: New → Discovery → Qualified → Proposal → Negotiation → Closed Won/Lost
- AI-powered lead scoring and win probability prediction
- Entry/exit criteria enforcement per stage
- Days-in-stage tracking with overdue alerts
- Pipeline value forecasting

#### Customer Database (CRM)
- Comprehensive customer profiles with contact persons
- Customer status: Active, Inactive, Prospective, Blacklisted
- Territory management (province, city, area)
- Price groups and credit limits
- Payment terms and VAT configuration
- Dealership-specific quotas and terms
- AI-enriched customer insights
- Customer metrics and purchase history
- Personal comments and interaction tracking

#### Sales Transaction Workflow
```
Inquiry → Sales Order → Order Slip → Invoice
```
- **Sales Inquiry:** Initial customer inquiries with item quotes
- **Sales Orders:** Confirmed orders (optional approval workflow)
- **Order Slips:** Finalized orders ready for processing/printing
- **Invoices:** Billing with payment tracking
- Each stage maintains full audit trail and approval chains

### 2. **Warehouse & Inventory Management**

#### Product Database
- Multi-warehouse inventory tracking (6 warehouses)
- Product details: part numbers, OEM, barcode, brand, description
- Price groups: AA, BB, CC, DD, VIP1, VIP2
- Reorder points and replenish quantities
- Stock status indicators

#### Stock Movement
- Real-time inventory tracking
- Transaction types: Purchase Order, Invoice, Order Slip, Transfer, Credit Memo, Adjustment
- Warehouse-to-warehouse transfers
- Stock adjustments for physical counts, damage, corrections

#### Reorder Reporting
- Automated reorder point monitoring
- Status levels: Critical, Low, Healthy
- Stock snapshots across all warehouses
- Bulk replenishment suggestions

### 3. **Accounting & Financial Reports**

#### Reports Overview
- Accounting overview dashboard
- Aging reports for receivables
- Collection reports
- Sales return reports
- Freight charges reports
- Accounts receivable tracking
- Purchase history
- Customer activity analysis (inactive/active, old/new)

#### Daily Call Monitoring
- Owner: Live call monitoring across all agents
- Agent: Personal daily call tracking
- Call outcomes: Follow-up, Positive, Negative, Other
- Duration tracking and next action scheduling

### 4. **Communication & Productivity**

#### Messaging
- Inbox system (planned)
- Text message management (planned)
- Sent, Pending, Failed folders (planned)

#### Productivity Tools
- Calendar (planned)
- **Tasks Management:**
  - Task creation, assignment, tracking
  - Priority levels: High, Medium, Low
  - Status: Todo, In Progress, Done
  - Due date tracking

### 5. **Management & Analytics**

#### Management Dashboard
- Sales performance by salesperson
- City/geographic performance analysis
- Customer status performance metrics
- Payment type performance (cash/credit/term)
- Monthly team performance tracking
- Agent quota vs. achievement tracking
- Top customers ranking
- Agent leaderboards

#### Customer Status Notifications
- Sales increase/decrease alerts
- Inactivity warnings (with severity levels)
- Inquiry-only alerts (high inquiry-to-purchase ratio)
- Outstanding balance notifications

### 6. **System Administration**

#### Staff Management
- Staff account creation and management
- Role assignment
- Access rights configuration
- Team assignment
- Birthday and contact info

#### Access Control (RBAC)
- Hierarchical module permissions
- 72+ granular permission modules
- Owner has full access (`*`)
- Default staff access rights configurable
- Module ID aliasing for backward compatibility

#### Server Maintenance (Recycle Bin)
- View all deleted items (contacts, inquiries, orders, invoices, tasks, products)
- Soft delete with 30-day retention
- Restore functionality
- Permanent deletion after expiration

#### Activity Logs (planned)
- System-wide audit trail
- User activity tracking
- Security event logging

---

## Key Technical Features

### 1. **Hierarchical Navigation System**
- **3-Level Hierarchy:** Category → Subcategory → Leaf Page
- **Smart Navigation:** Route normalization and alias resolution
- **Keyboard Shortcuts:** Alt+1 through Alt+6 for main categories, Cmd+K for search
- **Search:** Full-text search across navigation items
- **Favorites & Recent:** Personalized navigation experience

### 2. **Real-Time Features**
- Supabase real-time subscriptions
- Live call monitoring
- Instant notification delivery
- Collaborative updates

### 3. **Optimistic UI Updates**
- Immediate UI feedback before server confirmation
- Rollback on error
- Improved perceived performance

### 4. **Workflow Integration**
- Custom event system for cross-module navigation
- Workflow stepper component for multi-step processes
- Approval workflow support

### 5. **AI Integration**
- Lead scoring using Google GenAI
- Win probability prediction
- Next best action recommendations
- Risk factor identification

### 6. **Virtual Scrolling**
- Efficient rendering of large lists
- Used in customer database, product database, reports

---

## Data Models (Key Tables)

### Core Tables
- **profiles** - User profiles and authentication
- **contacts** - Customer records (soft delete enabled)
- **products** - Product catalog (soft delete enabled)
- **sales_inquiries** - Sales inquiries with items
- **sales_orders** - Confirmed sales orders
- **order_slips** - Finalized orders
- **invoices** - Billing documents
- **pipeline_deals** - Pipeline/deal management
- **tasks** - Task management (soft delete enabled)
- **inventory_logs** - Stock movement tracking
- **notifications** - User notifications (soft delete enabled)
- **team_messages** - Team chat
- **system_logs** - Developer cockpit logs
- **recycle_bin** - Deleted items storage

### Supporting Tables
- contact_persons
- sales_inquiry_items
- sales_order_items
- order_slip_items
- invoice_items
- personal_comments
- incident_reports
- sales_returns
- purchase_history
- inquiry_history
- payment_terms
- customer_metrics

---

## Component Architecture

### Layout Components
- **App.tsx** - Main routing and permission checking
- **TopNav** - Top navigation with user menu
- **Sidebar** - Hierarchical navigation menu
- **NotificationProvider** - Notification system
- **ToastProvider** - Toast notifications

### Feature Components (69 components)
Organized by domain:
- **Sales:** PipelineView, SalesInquiryView, SalesOrderView, etc.
- **Warehouse:** ProductDatabase, StockMovementView, ReorderReport
- **Accounting:** ReportsView, InvoiceView
- **Communication:** TasksView, DailyCallMonitoringView
- **Admin:** StaffView, AccessControlSettings, RecycleBinView

---

## State Management

### Local State
- React useState for component-level state
- Context providers for Toast and Notifications

### Server State
- Direct Supabase queries in components
- Real-time subscriptions for live updates
- Optimistic updates with rollback

### No Global State Management
- The app does not use Redux, Zustand, or similar
- Relies on component state and Supabase real-time

---

## Testing Strategy

### Unit Tests
- **Vitest** as test runner
- **@testing-library/react** for component testing
- Test files: `__tests__` directories next to components
- Tests for:
  - Sidebar components
  - Access Control Settings
  - App routing
  - Optimistic updates

### Test Coverage
- Core navigation logic
- Permission checking
- Utility functions
- Critical business logic

---

## Build & Deployment

### Development
```bash
npm run dev
```
- Vite dev server with HMR
- TypeScript type checking
- Supabase local development support

### Production Build
```bash
npm run build
```
- Optimized bundle
- Tree shaking
- Code splitting

### Testing
```bash
npm run test
```
- Vitest test runner
- Watch mode for development
- CI integration ready

---

## Environment Configuration

### Required Environment Variables (.env.local)
```
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Supabase Setup
- PostgreSQL database
- Authentication configured
- Row Level Security (RLS) enabled
- Real-time subscriptions enabled
- Storage buckets for file uploads (if needed)

---

## Key Business Workflows

### 1. Customer to Cash Flow
```
1. Create/Update Customer (Customer Database)
2. Create Sales Inquiry
3. Convert to Sales Order (optional approval)
4. Convert to Order Slip (finalization)
5. Convert to Invoice (billing)
6. Track Payment
```

### 2. Inventory Management
```
1. Stock In (Purchase Order, Receiving)
2. Stock Movement (Transfers between warehouses)
3. Stock Out (Invoice, Order Slip)
4. Stock Adjustment (Physical count, damage, correction)
5. Monitor Reorder Points (Reorder Report)
```

### 3. Sales Pipeline Management
```
1. Create Lead in Pipeline (New stage)
2. Progress through stages (Discovery → Qualified → ...)
3. Track probability and value
4. Close Won (convert to customer) or Close Lost
```

### 4. Staff & Permission Management
```
1. Create Staff Account (Staff Management)
2. Assign Role (Sales Agent, Manager, etc.)
3. Configure Access Rights (select modules)
4. Monitor Activity (Activity Logs)
```

---

## Performance Optimizations

### Virtual Scrolling
- Large lists (customers, products) use @tanstack/react-virtual
- Only renders visible items

### Code Splitting
- Route-based code splitting planned
- Lazy loading for heavy components

### Optimistic Updates
- UI responds immediately
- Server confirmation happens asynchronously
- Rollback on error

### Real-time Debouncing
- Controlled update frequency
- Prevents excessive re-renders

---

## Security Features

### Authentication
- Supabase Auth with JWT tokens
- Session management
- Auto-refresh tokens

### Authorization
- Role-Based Access Control (RBAC)
- Module-level permissions
- Server-side RLS policies in Supabase

### Data Protection
- Soft delete (no permanent data loss)
- Audit trail
- Recycle bin with retention policy

### Input Validation
- TypeScript type checking
- Form validation on submission
- Sanitization of user inputs

---

## Known Issues & Limitations

### Documented in issue.md
(Refer to issue.md file for current issues)

### Planned Features (marked "Coming Soon")
- Transfer Stock
- Inventory Audit
- Purchase Request/Order
- Receiving Stock
- Return to Supplier
- Various accounting reports
- Messaging/Inbox features
- Calendar
- Activity Logs
- Approver management
- Customer Groups
- Suppliers
- Special Price
- Category Management
- Courier Management
- Remark Templates

---

## Development Guidelines

### Code Style
- TypeScript strict mode enabled
- Functional components with hooks
- No class components
- Absolute imports (configured in vite.config.ts)

### Component Organization
- One component per file
- Test file next to component
- Co-located utilities

### Naming Conventions
- Components: PascalCase (e.g., SalesOrderView)
- Utilities: camelCase (e.g., topbarMenuConfig)
- Types: PascalCase (e.g., SalesInquiry)
- Constants: UPPER_SNAKE_CASE (e.g., DEFAULT_STAFF_ACCESS_RIGHTS)

### Git Workflow
- Main branch: `main`
- Feature branches: descriptive names
- Pull requests for code review
- CI/CD via GitHub Actions (configured in .github/workflows)

---

## Integration Points

### External Services
- **Supabase** - Primary backend
- **Google GenAI** - AI lead scoring
- **Dicebear API** - Avatar generation

### Future Integrations
- SMS gateway for text messages
- Email service for notifications
- Payment gateway integration
- Document generation (PDF)

---

## Metrics & Monitoring

### Developer Cockpit (planned)
- System logs
- Performance metrics
- Deployment tracking
- Error monitoring

### Business Metrics
- Sales performance by agent/city/status
- Customer engagement
- Inventory turnover
- Collection rates
- Pipeline conversion rates

---

## File Count Summary
- **Total TypeScript/TSX files:** 118
- **Components:** 69 React components
- **Services:** ~20 service files
- **Utilities:** 5+ utility files
- **Test files:** 10+ test files
- **Documentation:** 17+ markdown files in docs/, plus reference docs

---

## Conclusion

This is a **production-grade ERP/CRM system** with:
- Comprehensive sales and inventory management
- Role-based access control with 72+ modules
- Real-time collaboration features
- AI-powered insights
- Soft delete and audit trails
- Modern React architecture with TypeScript
- Extensive type definitions (1,318 lines in types.ts)
- Enterprise-grade security and permissions

The system is designed for **distribution/sales organizations** that need to manage:
- Customer relationships
- Sales pipelines
- Multi-location inventory
- Accounting and reporting
- Team performance

Current status: **Active development** with many core features implemented and several planned features marked as "Coming Soon."

---

*Generated: 2026-01-02*
*System Version: Based on latest commit 34463d9*
