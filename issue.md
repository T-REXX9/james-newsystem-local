# Invoice status reverts to draft after send/payment

## Summary
Kapag nag-send ng invoice o nag-record ng payment, nag-a-appear na `Sent/Paid` sa UI pero pag refresh bumabalik sa `draft`. Dahil dito, hindi rin nagre-record sa stock movement.

## Suspected Root Cause
May DB trigger sa invoices table na nag-e-error kaya naka-rollback ang status update:
- `supabase/migrations/025_create_inventory_log_triggers.sql` creates `trigger_invoice_inventory_log`.
- Trigger function expects `invoices.products` (JSONB) at `invoices.warehouse_id`, pero wala sa current schema (see `supabase/migrations/012_create_sales_workflow_tables.sql`).
- Result: any invoice `UPDATE` (status change to `sent` or `paid`) fails at DB level.

Additional issue: UI assumes success because `sendInvoice` / `recordPayment` does not check the update error.

## Evidence / Code Pointers
- Trigger: `supabase/migrations/025_create_inventory_log_triggers.sql`
  - Function `trigger_sales_document_inventory_log()` references `NEW.products` and `NEW.warehouse_id`.
- Invoice schema: `supabase/migrations/012_create_sales_workflow_tables.sql`
  - `invoices` table has no `products` or `warehouse_id` columns.
- Status update logic:
  - `services/invoiceService.ts` -> `sendInvoice` and `recordPayment` update `invoices.status` but ignore `error`.

## Impact
- Invoice status changes fail to persist (revert to `draft` on refresh).
- Inventory logs for invoices are not created when expected.

## Proposed Fix
Option A (simpler, aligns with current app logic):
1) Drop invoice/order slip inventory triggers that rely on missing columns.
2) Use existing app-layer log creation in `services/inventoryLogService.ts`.
3) Add error handling for invoice status updates (throw on update error).

Option B (if DB trigger is needed):
1) Add missing columns to `invoices` (`products`, `warehouse_id`) OR update trigger to use `invoice_items` table.
2) Ensure status update and inventory logging work without rollback.

## Repro Steps
1) Convert sales order to invoice.
2) In invoice view, click **Send Invoice** or **Record Payment**.
3) See status change to `Sent`/`Paid`.
4) Refresh page.
5) Status reverts to `draft`.

## Suggested Verification
- After fix, `sendInvoice` / `recordPayment` persists status in DB.
- Refresh keeps `Sent`/`Paid`.
- Stock movement shows invoice logs.
