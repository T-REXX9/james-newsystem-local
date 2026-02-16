-- Add item_id foreign key to sales_inquiry_items, sales_order_items, order_slip_items, and invoice_items
-- This migration fixes inventory logs by ensuring item_id is stored for stock movement tracking

-- Add item_id to sales_inquiry_items
ALTER TABLE public.sales_inquiry_items
ADD COLUMN IF NOT EXISTS item_id TEXT REFERENCES products(id) ON DELETE SET NULL;

-- Add item_id to sales_order_items
ALTER TABLE public.sales_order_items
ADD COLUMN IF NOT EXISTS item_id TEXT REFERENCES products(id) ON DELETE SET NULL;

-- Add item_id to order_slip_items  
ALTER TABLE public.order_slip_items
ADD COLUMN IF NOT EXISTS item_id TEXT REFERENCES products(id) ON DELETE SET NULL;

-- Add item_id to invoice_items
ALTER TABLE public.invoice_items
ADD COLUMN IF NOT EXISTS item_id TEXT REFERENCES products(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sales_inquiry_items_item_id ON public.sales_inquiry_items(item_id);
CREATE INDEX IF NOT EXISTS idx_sales_order_items_item_id ON public.sales_order_items(item_id);
CREATE INDEX IF NOT EXISTS idx_order_slip_items_item_id ON public.order_slip_items(item_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_item_id ON public.invoice_items(item_id);

-- Update RLS policies to include item_id in select policies
-- Sales inquiry items policy update
CREATE OR REPLACE POLICY "Users can view their sales inquiry items"
  ON public.sales_inquiry_items
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.sales_inquiries
    WHERE id = inquiry_id
    AND (auth.uid() = created_by OR (SELECT role FROM auth.users WHERE id = auth.uid())::text IN ('Owner','Manager'))
  ));

-- Sales order items policy update
CREATE OR REPLACE POLICY "Users can view their sales order items"
  ON public.sales_order_items
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.sales_orders
    WHERE id = order_id
    AND (auth.uid() = created_by OR (SELECT role FROM auth.users WHERE id = auth.uid())::text IN ('Owner','Manager'))
  ));

-- Order slip items policy update  
CREATE OR REPLACE POLICY "Users can view order slip items"
  ON public.order_slip_items
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.order_slips
    WHERE id = order_slip_id
    AND (auth.uid() = created_by OR (SELECT role FROM auth.users WHERE id = auth.uid())::text IN ('Owner','Manager','Finance'))
  ));

-- Invoice items policy update
CREATE OR REPLACE POLICY "Users can view invoice items"
  ON public.invoice_items
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.invoices
    WHERE id = invoice_id
    AND (auth.uid() = created_by OR (SELECT role FROM auth.users WHERE id = auth.uid())::text IN ('Owner','Manager','Finance'))
  ));

-- Comment on the purpose of these columns
COMMENT ON COLUMN public.sales_inquiry_items.item_id IS 'Foreign key to products table for inventory tracking';
COMMENT ON COLUMN public.sales_order_items.item_id IS 'Foreign key to products table for inventory tracking';
COMMENT ON COLUMN public.order_slip_items.item_id IS 'Foreign key to products table for inventory tracking';
COMMENT ON COLUMN public.invoice_items.item_id IS 'Foreign key to products table for inventory tracking';
