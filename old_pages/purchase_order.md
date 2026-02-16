# Purchase Order - Implementation Guide

## Overview
Build a fully functional **Purchase Order** page that manages formal orders sent to suppliers. This is the official procurement document created after a Purchase Request is approved, or can be created directly for immediate ordering needs.

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
   - Purchase order tables (look for `purchase_orders`, `po_list`, `po_items`)
   - Purchase request tables (for PR-to-PO conversion reference)
   - Supplier tables (look for `suppliers`)
   - Inventory/product tables
3. **Check existing policies**: Query `pg_policies` to understand current RLS rules.
4. **Generate TypeScript types**: Use `mcp_supabase-mcp-server_generate_typescript_types` to get accurate type definitions.

### Schema Discovery Queries
```sql
-- Find relevant tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name ILIKE ANY(ARRAY['%purchase%', '%order%', '%po_%', '%supplier%']);

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
Create and manage formal purchase orders to be sent to suppliers. POs serve as the official document authorizing the purchase of goods and tracking the expected delivery of items.

---

## Features to Implement

### 1. Purchase Order List View
- **List of all POs**: Display all purchase orders with columns:
  - PO Number (auto-generated format: PO-YY##)
  - Date Created
  - Supplier Name
  - Status (Draft, Pending, Approved, Sent, Received, Cancelled)
  - PR Reference (if created from PR)
  - Total Amount
- **Month/Year Filter**: Filter list by creation month and year.
- **Create New PO Button**: Opens form to create a new purchase order.
- **Delete PO Button**: Remove draft purchase orders.

### 2. Create Purchase Order
- **Auto-generated PO Number**: Format `PO-YY##` (e.g., PO-2601, PO-2602).
- **Supplier Selection**: Dropdown to select the supplier.
- **Item Selection**: Searchable dropdown with options:
  - Show all items
  - Show only items at/below reorder point
  - Show only out-of-stock items
- **Quantity Input**: Specify quantity to order.
- **ETA Date**: Expected arrival date.
- **Add Item Button**: Add item to the PO line items.

### 3. View/Edit Purchase Order
- **Header Information**: 
  - PO Number, Date, Status
  - Supplier details
  - PR Reference (if applicable)
  - Remarks/Notes
- **Line Items Table**:
  - Item Code
  - Part Number
  - Description
  - Quantity Ordered
  - Unit Cost
  - ETA Date
  - Quantity Received (for partial receiving)
  - Actions (Edit Qty, Edit ETA, Delete)
- **Inline Editing**: Update quantity or ETA date directly.
- **Workflow Actions**:
  - **Approve Button**: (For approvers) Approve the PO.
  - **Generate RR Button**: Create Receiving Report from this PO.
  - **Cancel Button**: Cancel the purchase order.
- **Print Button**: Generate printable PO document.

### 4. Smart Item Filtering
- Filter item dropdown to show:
  - Items below reorder quantity
  - Items with zero stock
  - All items

---

## Frontend Implementation

### Component Structure
```
src/
├── pages/
│   └── PurchaseOrder/
│       ├── index.tsx                  # Main page with list
│       ├── PurchaseOrderList.tsx      # PO list table
│       ├── PurchaseOrderView.tsx      # View/Edit single PO
│       ├── PurchaseOrderForm.tsx      # Create new PO form
│       └── PurchaseOrderPrint.tsx     # Print view
├── services/
│   └── purchaseOrderService.ts        # Supabase queries
└── types/
    └── purchaseOrder.types.ts         # TypeScript interfaces
```

### Service Layer Requirements
Create a service file that:
1. Fetches list of all purchase orders with filtering.
2. Creates new purchase order records.
3. Adds/updates/deletes line items on a PO.
4. Updates PO status (approve, cancel, sent, received).
5. Generates Receiving Report from PO.
6. Fetches supplier list and filtered item lists.
7. Calculates totals for PO.

---

## Backend Implementation

### Migration Requirements
**All database changes MUST be done via migration files** using `mcp_supabase-mcp-server_apply_migration`.

After schema discovery, if necessary tables do not exist, create migrations for:

1. **Purchase Orders Table** (if not exists):
   - PO number, reference number
   - Supplier reference
   - Date, time, status
   - User reference (created by)
   - PR reference (if created from PR)
   - Remarks/notes

2. **Purchase Order Items Table** (if not exists):
   - Reference to PO
   - Item reference
   - Quantity ordered
   - Quantity received
   - Unit cost
   - ETA date

3. **RLS Policies**:
   - Enable RLS on PO tables
   - Allow authenticated users to read/write POs
   - Allow approvers to update status

### Example Migration Structure
```sql
-- Migration: create_purchase_order_tables

-- Purchase Order Header
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number VARCHAR(20) NOT NULL UNIQUE,
  reference_no VARCHAR(50) NOT NULL UNIQUE,
  supplier_id UUID REFERENCES suppliers(id),
  supplier_name VARCHAR(100),
  status VARCHAR(20) DEFAULT 'Draft',
  pr_reference VARCHAR(50),
  remarks TEXT,
  created_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchase Order Items
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),
  item_code VARCHAR(50),
  part_number VARCHAR(50),
  description TEXT,
  quantity_ordered INTEGER NOT NULL,
  quantity_received INTEGER DEFAULT 0,
  unit_cost DECIMAL(10,2),
  eta_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can manage POs" ON purchase_orders
  FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage PO items" ON purchase_order_items
  FOR ALL TO authenticated USING (true);
```

---

## Workflow

1. **User opens page** → PO list displays with filter controls.
2. **User clicks "Create New"** → Form opens with auto-generated PO number.
3. **User selects supplier** → Supplier assigned to the PO.
4. **User adds items** → Searches for item, enters quantity and ETA.
5. **User saves PO** → PO is created in "Draft" status.
6. **Approver reviews** → Can approve the PO.
7. **PO is sent to supplier** → Status changes to "Sent".
8. **User creates Receiving Report** → RR created to record received items.

---

## PO Number Generation
```typescript
// Format: PO-YYNN where YY is 2-digit year, NN is sequential number
const generatePONumber = async (): Promise<string> => {
  const year = new Date().getFullYear().toString().slice(-2);
  const count = await getPOCountForYear(year);
  const sequence = String(count + 1).padStart(2, '0');
  return `PO-${year}${sequence}`;
};
```

---

## Validation & Error Handling
- Validate that supplier is selected before adding items.
- Validate that at least one item is added before approval.
- Validate quantity is greater than zero.
- Prevent editing of sent/received POs (except for receiving).
- Confirm before deleting items or cancelling PO.
- Display loading states during operations.
- Show error messages if operations fail.

---

## Testing Checklist
- [ ] PO number auto-generates correctly.
- [ ] Supplier can be selected and changed.
- [ ] Items can be added, edited, and removed.
- [ ] Item filtering (reorder/out-of-stock) works.
- [ ] Approval workflow functions correctly.
- [ ] Generate RR creates a valid Receiving Report.
- [ ] Month/year filter works correctly.
- [ ] Print functionality generates proper document.
- [ ] RLS policies work correctly.
- [ ] PO totals calculate correctly.

note: map this page to its existing topbar nav menu entry
