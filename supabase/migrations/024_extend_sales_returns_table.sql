-- Extend sales_returns table with additional fields
-- This migration adds return_no, warehouse_id, and invoice_id fields

-- Add return_no field for reference tracking
ALTER TABLE sales_returns 
ADD COLUMN IF NOT EXISTS return_no VARCHAR(50) UNIQUE;

-- Add warehouse_id field to specify which warehouse receives returned items
ALTER TABLE sales_returns
ADD COLUMN IF NOT EXISTS warehouse_id TEXT;

-- Add invoice_id field to link returns to original invoices
ALTER TABLE sales_returns
ADD COLUMN IF NOT EXISTS invoice_id TEXT;

-- Create indexes for the new fields
CREATE INDEX IF NOT EXISTS idx_sales_returns_return_no ON sales_returns(return_no);
CREATE INDEX IF NOT EXISTS idx_sales_returns_warehouse_id ON sales_returns(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_sales_returns_invoice_id ON sales_returns(invoice_id);

-- Add comments to new columns
COMMENT ON COLUMN sales_returns.return_no IS 'Unique reference number for the sales return';
COMMENT ON COLUMN sales_returns.warehouse_id IS 'Warehouse where returned items are received';
COMMENT ON COLUMN sales_returns.invoice_id IS 'Reference to the original invoice for this return';

-- Update RLS policies to allow access to new columns
-- (Existing policies should handle these columns automatically as they are part of the table)
