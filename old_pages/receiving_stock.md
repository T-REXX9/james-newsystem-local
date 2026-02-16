# Receiving Stock - Implementation Guide

## Overview
Build a fully functional **Receiving Stock** (Receiving Report) page that records the actual receipt of goods from suppliers. This page is used when inventory arrives at the warehouse, either from a Purchase Order or as a direct receipt without a prior PO.

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
   - Receiving tables (look for `receiving`, `receiving_reports`, `rr_items`, `purchase_order`)
   - Inventory log tables (for stock updates)
   - Supplier tables
   - Inventory/product tables
3. **Check existing policies**: Query `pg_policies` to understand current RLS rules.
4. **Generate TypeScript types**: Use `mcp_supabase-mcp-server_generate_typescript_types` to get accurate type definitions.

### Schema Discovery Queries
```sql
-- Find relevant tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name ILIKE ANY(ARRAY['%receiv%', '%rr_%', '%purchase%', '%inventory%', '%log%']);

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
Record and track the physical receipt of goods from suppliers, updating inventory quantities and maintaining a history of all stock receipts for auditing and reconciliation purposes.

---

## Features to Implement

### 1. Receiving Report List View
- **List of all RRs**: Display all receiving reports with columns:
  - RR Number (auto-generated format: RR-YY##)
  - Date Received
  - Supplier Name
  - PO Reference (if from PO)
  - Status (Draft, Posted)
  - Total Items
- **Month/Year Filter**: Filter list by receipt month and year.
- **Search**: Search by RR number or supplier.
- **Create New RR Button**: Opens form to create a new receiving report.
- **Delete RR Button**: Remove draft receiving reports.

### 2. Create Receiving Report
- **Auto-generated RR Number**: Format `RR-YY##` (e.g., RR-2601, RR-2602).
- **RR Number Input**: Allow manual entry for existing supplier invoice numbers.
- **Duplicate Check**: Warn if RR number already exists.
- **Supplier Selection**: Dropdown to select the supplier.
- **Item Selection**: Searchable dropdown to select items from inventory.
- **Quantity Input**: Specify quantity received.
- **Unit Cost Input**: Enter the cost per unit.
- **Add Item Button**: Add item to the RR line items.

### 3. View/Edit Receiving Report
- **Header Information**:
  - RR Number, Date, Status
  - Supplier details
  - PO Reference (if applicable)
  - Notes/Remarks
- **Line Items Table**:
  - Item Code
  - Part Number
  - Description
  - Quantity Received
  - Unit Cost
  - Total Cost
  - Actions (Edit Qty, Edit Cost, Delete)
- **Inline Editing**: Update quantity or cost directly.
- **Workflow Actions**:
  - **Finalize/Post Button**: Post the RR and update inventory.
  - **Cancel Button**: Cancel the receiving report.
- **Print Button**: Generate printable RR document.

### 4. Inventory Update on Finalize
- When RR is finalized:
  - Update inventory stock quantities (add received quantities).
  - Create inventory log entries for each item.
  - Update PO received quantities (if from PO).
  - Mark RR as "Posted".

---

## Frontend Implementation

### Component Structure
```
src/
├── pages/
│   └── ReceivingStock/
│       ├── index.tsx                  # Main page with list
│       ├── ReceivingList.tsx          # RR list table
│       ├── ReceivingView.tsx          # View/Edit single RR
│       ├── ReceivingForm.tsx          # Create new RR form
│       └── ReceivingPrint.tsx         # Print view
├── services/
│   └── receivingService.ts            # Supabase queries
└── types/
    └── receiving.types.ts             # TypeScript interfaces
```

### Service Layer Requirements
Create a service file that:
1. Fetches list of all receiving reports with filtering.
2. Creates new receiving report records.
3. Checks for duplicate RR numbers.
4. Adds/updates/deletes line items on an RR.
5. Finalizes RR (posts to inventory).
6. Creates inventory log entries.
7. Updates PO received quantities.
8. Fetches supplier list and item lists.

---

## Backend Implementation

### Migration Requirements
**All database changes MUST be done via migration files** using `mcp_supabase-mcp-server_apply_migration`.

After schema discovery, if necessary tables do not exist, create migrations for:

1. **Receiving Reports Table** (if not exists):
   - RR number, reference number
   - Supplier reference
   - Date, time, status
   - PO reference (if applicable)
   - User reference (created by)
   - Notes/remarks

2. **Receiving Report Items Table** (if not exists):
   - Reference to RR
   - Item reference
   - Quantity received
   - Unit cost
   - Total cost

3. **Inventory Logs Update**:
   - Ensure inventory logs can track receiving transactions
   - Transaction type = 'purchase' or 'receiving'

4. **RLS Policies**:
   - Enable RLS on receiving tables
   - Allow authenticated users to manage receiving reports

### Example Migration Structure
```sql
-- Migration: create_receiving_stock_tables

-- Receiving Report Header
CREATE TABLE IF NOT EXISTS receiving_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rr_number VARCHAR(20) NOT NULL UNIQUE,
  reference_no VARCHAR(50) NOT NULL UNIQUE,
  supplier_id UUID REFERENCES suppliers(id),
  supplier_name VARCHAR(100),
  status VARCHAR(20) DEFAULT 'Draft',
  po_reference VARCHAR(50),
  received_date DATE DEFAULT CURRENT_DATE,
  remarks TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  posted_at TIMESTAMPTZ
);

-- Receiving Report Items
CREATE TABLE IF NOT EXISTS receiving_report_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rr_id UUID REFERENCES receiving_reports(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),
  item_code VARCHAR(50),
  part_number VARCHAR(50),
  description TEXT,
  quantity_received INTEGER NOT NULL,
  unit_cost DECIMAL(10,2),
  total_cost DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE receiving_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE receiving_report_items ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can manage RRs" ON receiving_reports
  FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage RR items" ON receiving_report_items
  FOR ALL TO authenticated USING (true);

-- Function to update inventory on RR finalize
CREATE OR REPLACE FUNCTION finalize_receiving_report(p_rr_id UUID)
RETURNS VOID AS $$
DECLARE
  v_item RECORD;
BEGIN
  -- Update status
  UPDATE receiving_reports SET status = 'Posted', posted_at = NOW() WHERE id = p_rr_id;
  
  -- Create inventory logs for each item
  FOR v_item IN SELECT * FROM receiving_report_items WHERE rr_id = p_rr_id LOOP
    INSERT INTO inventory_logs (
      item_id, 
      transaction_type, 
      quantity_in, 
      reference_no,
      created_at
    ) VALUES (
      v_item.item_id,
      'receiving',
      v_item.quantity_received,
      (SELECT rr_number FROM receiving_reports WHERE id = p_rr_id),
      NOW()
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Workflow

1. **User opens page** → RR list displays with filter controls.
2. **User clicks "Create New"** → Form opens.
3. **User enters RR number** → System checks for duplicates.
4. **User selects supplier** → Supplier assigned to the RR.
5. **User adds items** → Searches for item, enters quantity and cost.
6. **User saves RR** → RR is created in "Draft" status.
7. **User finalizes RR** → 
   - Inventory quantities are updated (stock in).
   - Inventory logs are created.
   - RR status changes to "Posted".
8. **RR is locked** → Posted RRs cannot be edited.

---

## RR Number Generation
```typescript
// Format: RR-YYNN where YY is 2-digit year, NN is sequential number
const generateRRNumber = async (): Promise<string> => {
  const year = new Date().getFullYear().toString().slice(-2);
  const count = await getRRCountForYear(year);
  const sequence = String(count + 1).padStart(2, '0');
  return `RR-${year}${sequence}`;
};
```

---

## Validation & Error Handling
- Check for duplicate RR numbers before creation.
- Validate that supplier is selected.
- Validate that at least one item is added before finalizing.
- Validate quantity is greater than zero.
- Validate unit cost is provided.
- Prevent editing of posted RRs.
- Confirm before finalizing (action cannot be undone).
- Display loading states during operations.
- Show error messages if operations fail.

---

## Testing Checklist
- [ ] RR number auto-generates correctly.
- [ ] Duplicate RR number check works.
- [ ] Supplier can be selected.
- [ ] Items can be added, edited, and removed.
- [ ] Finalize updates inventory stock correctly.
- [ ] Inventory logs are created on finalize.
- [ ] Posted RRs cannot be edited.
- [ ] Month/year filter works correctly.
- [ ] Search functionality works.
- [ ] Print functionality generates proper document.
- [ ] RLS policies work correctly.

note: map this page to its existing topbar nav menu entry
