-- 018_add_soft_delete_to_sales_inquiries.sql
-- Adds soft delete columns to sales_inquiries table

-- Add is_deleted column
ALTER TABLE sales_inquiries
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- Add deleted_at column
ALTER TABLE sales_inquiries
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Create index for faster queries on soft deleted items
CREATE INDEX IF NOT EXISTS idx_sales_inquiries_is_deleted 
ON sales_inquiries(is_deleted);

-- Create index for deleted_at for cleanup queries
CREATE INDEX IF NOT EXISTS idx_sales_inquiries_deleted_at 
ON sales_inquiries(deleted_at);

-- Optional: Add trigger to automatically set deleted_at when is_deleted changes
-- Similar to developer cockpit tables, but we handle in service for now.
-- Uncomment if needed:
-- CREATE OR REPLACE FUNCTION sales_inquiries_soft_delete()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   IF OLD.is_deleted = FALSE AND NEW.is_deleted = TRUE THEN
--     NEW.deleted_at = NOW();
--   END IF;
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
-- 
-- CREATE TRIGGER sales_inquiries_soft_delete_trigger
-- BEFORE UPDATE ON sales_inquiries
-- FOR EACH ROW
-- EXECUTE FUNCTION sales_inquiries_soft_delete();