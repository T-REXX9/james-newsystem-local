-- Add related_transactions field to incident_reports table
-- This field will store an array of transaction references (invoices, order slips, inquiries, etc.)

ALTER TABLE public.incident_reports
ADD COLUMN IF NOT EXISTS related_transactions JSONB DEFAULT '[]'::jsonb;

-- Add index for faster queries on related_transactions
CREATE INDEX IF NOT EXISTS idx_incident_reports_related_transactions 
ON public.incident_reports USING GIN (related_transactions);

-- Comment explaining the structure
COMMENT ON COLUMN public.incident_reports.related_transactions IS 
'Array of transaction references in format: [{transaction_type: "invoice"|"order_slip"|"sales_order"|"sales_inquiry"|"purchase_history", transaction_id: UUID, transaction_number: TEXT, transaction_date: DATE}]';

