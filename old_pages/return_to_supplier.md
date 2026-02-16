# Return to Supplier - Implementation Guide

## Overview
Build a fully functional **Return to Supplier** page that handles the return of goods back to suppliers. This page manages returns of items that were received through a Receiving Report (RR) but need to be sent back due to defects, wrong items, overstock, or other reasons.

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
   - Return tables (look for `returns`, `return_items`, `delivery_return`)
   - Receiving report tables (for RR reference)
   - Supplier tables
   - Inventory log tables (for stock updates)
3. **Check existing policies**: Query `pg_policies` to understand current RLS rules.
4. **Generate TypeScript types**: Use `mcp_supabase-mcp-server_generate_typescript_types` to get accurate type definitions.

### Schema Discovery Queries
```sql
-- Find relevant tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name ILIKE ANY(ARRAY['%return%', '%delivery%', '%receiv%', '%supplier%']);

-- Get column details for discovered tables
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = '<TABLE_NAME>';

-- Check for return type columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name ILIKE '%return%' 
AND column_name ILIKE '%type%';

-- Check existing RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies WHERE schemaname = 'public';
```

---

## Page Purpose
Manage the process of returning goods to suppliers, tracking what items are being returned, the reason for return, and the credit or refund expected. This reduces inventory and creates a record for supplier reconciliation.

---

## Features to Implement

### 1. Return to Supplier List View
- **List of all Returns**: Display all supplier returns with columns:
  - Return Number (auto-generated)
  - Date Created
  - Supplier Name
  - RR Reference (source receiving report)
  - Status (Pending, Posted)
  - Total Amount
- **Month Filter**: Filter list by creation month.
- **Create New Return Button**: Opens form to create a new return.
- **Delete Return Button**: Remove pending returns.

### 2. Create Return to Supplier
- **Auto-generated Return Number**: Sequential numbering.
- **Return Type Selection**: Select "Purchase" to return to supplier.
- **RR Reference Selection**: Dropdown of receiving reports to return from.
- **RR Selection Auto-fills**:
  - Supplier information
  - PO reference
  - Available items to return

### 3. View/Edit Return Record
- **Header Information**:
  - Return Number, Date, Status
  - Supplier details
  - RR Reference
  - PO Number
  - Remarks
- **Item Selection** (for adding items):
  - Dropdown showing items from the selected RR
  - Shows available quantity (original minus already returned)
  - Unit type selection (per unit or per piece)
  - Quantity to return
  - Return reason/status (Defective, Wrong Item, Overstock, etc.)
  - Remarks
- **Return Items Table**:
  - Item Code
  - Part Number
  - Description
  - Quantity Returned
  - Unit Cost
  - Total Amount
  - Return Reason
  - Actions (Delete)
- **Workflow Actions**:
  - **Finalize Button**: Post the return and update inventory.
  - **Cancel Button**: Cancel the return.
- **Print Button**: Generate printable return document.

### 4. Inventory Update on Finalize
- When return is finalized:
  - Reduce inventory stock quantities (subtract returned quantities).
  - Create inventory log entries (stock out).
  - Mark return as "Posted".

---

## Frontend Implementation

### Component Structure
```
src/
├── pages/
│   └── ReturnToSupplier/
│       ├── index.tsx                    # Main page with list
│       ├── ReturnToSupplierList.tsx     # Return list table
│       ├── ReturnToSupplierView.tsx     # View/Edit single return
│       ├── ReturnToSupplierNew.tsx      # Create new return
│       └── ReturnToSupplierPrint.tsx    # Print view
├── services/
│   └── returnToSupplierService.ts       # Supabase queries
└── types/
    └── returnToSupplier.types.ts        # TypeScript interfaces
```

### Service Layer Requirements
Create a service file that:
1. Fetches list of all supplier returns with filtering.
2. Creates new return records.
3. Fetches receiving reports for selection.
4. Gets items from selected RR with available quantities.
5. Adds/deletes items on a return.
6. Calculates already-returned quantities for each item.
7. Finalizes return (updates inventory).
8. Creates inventory log entries (stock out).

---

## Backend Implementation

### Migration Requirements
**All database changes MUST be done via migration files** using `mcp_supabase-mcp-server_apply_migration`.

After schema discovery, if necessary tables do not exist, create migrations for:

1. **Supplier Returns Table** (if not exists):
   - Return number, reference number
   - Return type (should be 'purchase' for supplier returns)
   - RR reference
   - Supplier reference
   - Status (Pending, Posted)
   - Date, remarks
   - Total amount

2. **Supplier Return Items Table** (if not exists):
   - Reference to return
   - Item reference
   - Quantity returned
   - Unit cost
   - Return reason/status
   - Remarks

3. **RLS Policies**:
   - Enable RLS on return tables
   - Allow authenticated users to manage returns

### Example Migration Structure
```sql
-- Migration: create_supplier_return_tables

-- Supplier Returns Header
CREATE TABLE IF NOT EXISTS supplier_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number VARCHAR(20) NOT NULL UNIQUE,
  reference_no VARCHAR(50) NOT NULL UNIQUE,
  return_type VARCHAR(20) DEFAULT 'purchase',
  rr_reference VARCHAR(50),
  supplier_id UUID REFERENCES suppliers(id),
  supplier_name VARCHAR(100),
  po_number VARCHAR(50),
  status VARCHAR(20) DEFAULT 'Pending',
  grand_total DECIMAL(10,2) DEFAULT 0,
  remarks TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  posted_at TIMESTAMPTZ
);

-- Supplier Return Items
CREATE TABLE IF NOT EXISTS supplier_return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID REFERENCES supplier_returns(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),
  item_code VARCHAR(50),
  part_number VARCHAR(50),
  description TEXT,
  quantity_returned INTEGER NOT NULL,
  unit_cost DECIMAL(10,2),
  total_amount DECIMAL(10,2),
  return_status VARCHAR(50), -- Defective, Wrong Item, etc.
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE supplier_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_return_items ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can manage supplier returns" ON supplier_returns
  FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage return items" ON supplier_return_items
  FOR ALL TO authenticated USING (true);

-- Function to finalize supplier return
CREATE OR REPLACE FUNCTION finalize_supplier_return(p_return_id UUID)
RETURNS VOID AS $$
DECLARE
  v_item RECORD;
  v_return_number VARCHAR(50);
BEGIN
  -- Get return number
  SELECT return_number INTO v_return_number FROM supplier_returns WHERE id = p_return_id;
  
  -- Update status
  UPDATE supplier_returns SET status = 'Posted', posted_at = NOW() WHERE id = p_return_id;
  
  -- Create inventory logs for each item (stock out)
  FOR v_item IN SELECT * FROM supplier_return_items WHERE return_id = p_return_id LOOP
    INSERT INTO inventory_logs (
      item_id, 
      transaction_type, 
      quantity_out, 
      reference_no,
      notes,
      created_at
    ) VALUES (
      v_item.item_id,
      'supplier_return',
      v_item.quantity_returned,
      v_return_number,
      v_item.return_status,
      NOW()
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Workflow

1. **User opens page** → Return list displays with filter controls.
2. **User clicks "Create New"** → New return form opens.
3. **User selects return type** → "Purchase" for supplier return.
4. **User selects RR** → System loads RR details and available items.
5. **User adds items to return**:
   - Selects item from RR
   - Enters quantity (limited by available qty)
   - Selects return reason
   - Adds remarks if needed
6. **User saves return** → Return created in "Pending" status.
7. **User finalizes return**:
   - Inventory quantities are reduced (stock out).
   - Inventory logs are created.
   - Status changes to "Posted".
8. **Return is locked** → Posted returns cannot be edited.

---

## Available Quantity Calculation
```typescript
// Calculate how many items can still be returned from an RR
const getAvailableQuantity = (
  originalQty: number,        // Quantity in the RR
  alreadyReturnedQty: number  // Sum of quantities already returned for this item
): number => {
  return originalQty - alreadyReturnedQty;
};
```

---

## Return Reasons/Statuses
- Defective
- Wrong Item
- Damaged in Transit
- Overstock
- Quality Issue
- Expired
- Other

---

## Validation & Error Handling
- Validate that RR is selected before adding items.
- Validate that return quantity does not exceed available quantity.
- Validate that at least one item is added before finalizing.
- Prevent returning more than was received.
- Prevent editing of posted returns.
- Confirm before finalizing (action cannot be undone).
- Display loading states during operations.
- Show error messages if operations fail.

---

## Testing Checklist
- [ ] Return number auto-generates correctly.
- [ ] RR selection populates supplier info correctly.
- [ ] Only items from selected RR are available.
- [ ] Available quantity calculation is correct.
- [ ] Cannot return more than available quantity.
- [ ] Return reason can be selected.
- [ ] Finalize reduces inventory correctly.
- [ ] Inventory logs are created (stock out).
- [ ] Posted returns cannot be edited.
- [ ] Month filter works correctly.
- [ ] Print functionality generates proper document.
- [ ] Grand total calculates correctly.

note: map this page to its existing topbar nav menu entry
