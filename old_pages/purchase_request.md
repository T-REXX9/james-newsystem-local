# Purchase Request - Implementation Guide

## Overview
Build a fully functional **Purchase Request** page that allows users to create internal requests for purchasing inventory items. This is the first step in the procurement workflow, where staff can identify items that need to be ordered and submit them for approval before creating a formal Purchase Order.

---

## Tech Stack
- **Frontend**: React with Vite
- **Backend**: Supabase (PostgreSQL)
- **State Management**: React hooks or your preferred state solution

---

## Pre-Implementation: Backend Discovery

**CRITICAL**: Before writing any code, you MUST query the Supabase project using MCP tools to gather the current backend schema.

### Required MCP Queries
1. **List all tables**: Use `mcp_supabase-mcp-server_list_tables` to get all tables in the `public` schema.
2. **Execute SQL for schema details**: Use `mcp_supabase-mcp-server_execute_sql` to inspect:
   - Purchase request tables (look for `purchase_requests`, `pr_list`, `pr_items`)
   - Inventory/product tables (look for `inventory`, `products`, `items`)
   - Supplier tables (look for `suppliers`)
   - User tables for approver functionality
3. **Check existing policies**: Query `pg_policies` to understand current RLS rules.
4. **Generate TypeScript types**: Use `mcp_supabase-mcp-server_generate_typescript_types` to get accurate type definitions.

### Schema Discovery Queries
```sql
-- Find relevant tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name ILIKE ANY(ARRAY['%purchase%', '%request%', '%pr_%', '%supplier%', '%item%']);

-- Get column details for discovered tables
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = '<TABLE_NAME>';

-- Check existing RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies WHERE schemaname = 'public';
```

---

## Page Purpose
Enable staff to create and manage purchase requests for items needed in inventory. These requests go through an approval workflow before being converted into formal Purchase Orders.

---

## Features to Implement

### 1. Purchase Request List View
- **List of all PRs**: Display all purchase requests with columns:
  - PR Number (auto-generated format: PR-YY##)
  - Date Created
  - Status (Draft, Pending, Approved, Submitted, Cancelled)
  - Total Items
  - Created By
- **Month/Year Filter**: Filter list by creation month and year.
- **Create New PR Button**: Opens form to create a new purchase request.
- **Delete PR Button**: Remove draft purchase requests.

### 2. Create Purchase Request
- **Auto-generated PR Number**: Format `PR-YY##` (e.g., PR-2601, PR-2602).
- **Item Selection**: Searchable dropdown to select items from inventory.
- **Quantity Input**: Specify quantity needed.
- **Supplier Selection**: Dropdown to assign a preferred supplier.
- **ETA Date**: Date picker for expected arrival.
- **Add Item Button**: Add item to the PR line items.

### 3. View/Edit Purchase Request
- **Header Information**: PR Number, Date, Status, Created By.
- **Line Items Table**:
  - Item Code
  - Part Number
  - Description
  - Quantity
  - Unit Cost
  - Supplier
  - PO Reference (if converted)
  - Actions (Edit Qty, Edit Supplier, Delete)
- **Inline Editing**: Update quantity, cost, or supplier directly.
- **Approval Workflow**:
  - **Approve Button**: (For approvers only) Mark PR as approved.
  - **Create PO Button**: Convert approved items into a Purchase Order.
  - **Cancel Button**: Cancel the purchase request.
- **Print Button**: Generate printable version.

### 4. Supplier Cost Database
- When adding items, check if supplier-specific pricing exists.
- Store new supplier-item cost relationships for future use.

---

## Frontend Implementation

### Component Structure
```
src/
├── pages/
│   └── PurchaseRequest/
│       ├── index.tsx                    # Main page with list
│       ├── PurchaseRequestList.tsx      # PR list table
│       ├── PurchaseRequestView.tsx      # View/Edit single PR
│       ├── PurchaseRequestForm.tsx      # Create new PR form
│       └── PurchaseRequestPrint.tsx     # Print view
├── services/
│   └── purchaseRequestService.ts        # Supabase queries
└── types/
    └── purchaseRequest.types.ts         # TypeScript interfaces
```

### Service Layer Requirements
Create a service file that:
1. Fetches list of all purchase requests with filtering.
2. Creates new purchase request records.
3. Adds/updates/deletes line items on a PR.
4. Updates PR status (approve, cancel, submit).
5. Converts PR items to Purchase Order.
6. Fetches supplier list and item list for dropdowns.
7. Manages supplier-item cost database.

---

## Backend Implementation

### Migration Requirements
**All database changes MUST be done via migration files** using `mcp_supabase-mcp-server_apply_migration`.

After schema discovery, if necessary tables do not exist, create migrations for:

1. **Purchase Requests Table** (if not exists):
   - PR number, reference number
   - Date, time, status
   - User reference (created by)
   - Approval status

2. **Purchase Request Items Table** (if not exists):
   - Reference to PR
   - Item reference
   - Quantity, unit cost
   - Supplier reference
   - ETA date
   - PO reference (for tracking conversion)

3. **Supplier Cost Database** (if not exists):
   - Supplier reference
   - Item reference
   - Cost/price

4. **RLS Policies**:
   - Enable RLS on PR tables
   - Allow authenticated users to read/write their own PRs
   - Allow approvers to update status

### Example Migration Structure
```sql
-- Migration: create_purchase_request_tables

-- Purchase Request Header
CREATE TABLE IF NOT EXISTS purchase_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_number VARCHAR(20) NOT NULL UNIQUE,
  reference_no VARCHAR(50) NOT NULL UNIQUE,
  status VARCHAR(20) DEFAULT 'Draft',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchase Request Items
CREATE TABLE IF NOT EXISTS purchase_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_id UUID REFERENCES purchase_requests(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),
  item_code VARCHAR(50),
  part_number VARCHAR(50),
  description TEXT,
  quantity INTEGER NOT NULL,
  unit_cost DECIMAL(10,2),
  supplier_id UUID REFERENCES suppliers(id),
  supplier_name VARCHAR(100),
  eta_date DATE,
  po_reference VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_request_items ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage own PRs" ON purchase_requests
  FOR ALL TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Users can manage PR items" ON purchase_request_items
  FOR ALL TO authenticated
  USING (pr_id IN (SELECT id FROM purchase_requests WHERE created_by = auth.uid()));
```

---

## Workflow

1. **User opens page** → PR list displays with filter controls.
2. **User clicks "Create New"** → Form opens with auto-generated PR number.
3. **User adds items** → Searches for item, selects supplier, enters quantity.
4. **User saves PR** → PR is created in "Draft" status.
5. **User submits for approval** → Status changes to "Pending".
6. **Approver reviews** → Can approve or reject.
7. **User converts to PO** → Selected items are added to a new Purchase Order.

---

## PR Number Generation
```typescript
// Format: PR-YYNN where YY is 2-digit year, NN is sequential number
const generatePRNumber = async (): Promise<string> => {
  const year = new Date().getFullYear().toString().slice(-2);
  const count = await getPRCountForYear(year);
  const sequence = String(count + 1).padStart(2, '0');
  return `PR-${year}${sequence}`;
};
```

---

## Validation & Error Handling
- Validate that at least one item is added before submission.
- Validate quantity is greater than zero.
- Prevent editing of approved/submitted PRs.
- Confirm before deleting items or cancelling PR.
- Display loading states during operations.
- Show error messages if operations fail.

---

## Testing Checklist
- [ ] PR number auto-generates correctly.
- [ ] Items can be added, edited, and removed.
- [ ] Supplier selection works and populates cost.
- [ ] Approval workflow functions correctly.
- [ ] Only approvers see the approve button.
- [ ] Convert to PO creates a valid Purchase Order.
- [ ] Month/year filter works correctly.
- [ ] Print functionality works.
- [ ] RLS policies prevent unauthorized access.

note: map this page to its existing topbar nav menu entry
