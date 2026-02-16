-- Drop the existing constraint
ALTER TABLE public.sales_inquiries DROP CONSTRAINT IF EXISTS sales_inquiries_status_check;

-- Update existing records to match new status
UPDATE public.sales_inquiries SET status = 'approved' WHERE status = 'confirmed';

-- Add the new constraint with 'approved' instead of 'confirmed'
ALTER TABLE public.sales_inquiries
ADD CONSTRAINT sales_inquiries_status_check
CHECK (status IN ('draft', 'approved', 'converted_to_order', 'cancelled'));
