-- Create sales_inquiries table
CREATE TABLE IF NOT EXISTS public.sales_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_no TEXT UNIQUE NOT NULL,
  contact_id TEXT NOT NULL,
  sales_date DATE NOT NULL,
  sales_person TEXT NOT NULL,
  delivery_address TEXT,
  reference_no TEXT,
  customer_reference TEXT,
  send_by TEXT,
  price_group TEXT,
  credit_limit NUMERIC DEFAULT 0,
  terms TEXT,
  promise_to_pay TEXT,
  po_number TEXT,
  remarks TEXT,
  inquiry_type TEXT,
  urgency TEXT DEFAULT 'N/A',
  urgency_date DATE,
  grand_total NUMERIC DEFAULT 0,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create sales_inquiry_items table
CREATE TABLE IF NOT EXISTS public.sales_inquiry_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID NOT NULL REFERENCES public.sales_inquiries(id) ON DELETE CASCADE,
  qty INTEGER NOT NULL DEFAULT 1,
  part_no TEXT,
  item_code TEXT,
  location TEXT,
  description TEXT,
  unit_price NUMERIC DEFAULT 0,
  amount NUMERIC DEFAULT 0,
  remark TEXT,
  approval_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sales_inquiries_contact_id ON public.sales_inquiries(contact_id);
CREATE INDEX IF NOT EXISTS idx_sales_inquiries_created_by ON public.sales_inquiries(created_by);
CREATE INDEX IF NOT EXISTS idx_sales_inquiries_created_at ON public.sales_inquiries(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_inquiry_items_inquiry_id ON public.sales_inquiry_items(inquiry_id);

-- Enable RLS for sales_inquiries table
ALTER TABLE public.sales_inquiries ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for sales_inquiries - Users can view their own inquiries
CREATE POLICY "Users can view their own inquiries"
  ON public.sales_inquiries
  FOR SELECT
  USING (auth.uid() = created_by OR (SELECT role FROM auth.users WHERE id = auth.uid())::text = 'Owner');

-- Create RLS policy for sales_inquiries - Users can insert their own inquiries
CREATE POLICY "Users can insert their own inquiries"
  ON public.sales_inquiries
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Create RLS policy for sales_inquiries - Users can update their own inquiries
CREATE POLICY "Users can update their own inquiries"
  ON public.sales_inquiries
  FOR UPDATE
  USING (auth.uid() = created_by OR (SELECT role FROM auth.users WHERE id = auth.uid())::text = 'Owner');

-- Create RLS policy for sales_inquiries - Users can delete their own inquiries
CREATE POLICY "Users can delete their own inquiries"
  ON public.sales_inquiries
  FOR DELETE
  USING (auth.uid() = created_by OR (SELECT role FROM auth.users WHERE id = auth.uid())::text = 'Owner');

-- Enable RLS for sales_inquiry_items table
ALTER TABLE public.sales_inquiry_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for sales_inquiry_items - Users can view items of their own inquiries
CREATE POLICY "Users can view items of their own inquiries"
  ON public.sales_inquiry_items
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.sales_inquiries
    WHERE id = inquiry_id
    AND (auth.uid() = created_by OR (SELECT role FROM auth.users WHERE id = auth.uid())::text = 'Owner')
  ));

-- Create RLS policy for sales_inquiry_items - Users can insert items to their own inquiries
CREATE POLICY "Users can insert items to their own inquiries"
  ON public.sales_inquiry_items
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sales_inquiries
    WHERE id = inquiry_id
    AND auth.uid() = created_by
  ));

-- Create RLS policy for sales_inquiry_items - Users can update items of their own inquiries
CREATE POLICY "Users can update items of their own inquiries"
  ON public.sales_inquiry_items
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.sales_inquiries
    WHERE id = inquiry_id
    AND (auth.uid() = created_by OR (SELECT role FROM auth.users WHERE id = auth.uid())::text = 'Owner')
  ));

-- Create RLS policy for sales_inquiry_items - Users can delete items of their own inquiries
CREATE POLICY "Users can delete items of their own inquiries"
  ON public.sales_inquiry_items
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.sales_inquiries
    WHERE id = inquiry_id
    AND (auth.uid() = created_by OR (SELECT role FROM auth.users WHERE id = auth.uid())::text = 'Owner')
  ));

-- Create trigger to update updated_at timestamp on sales_inquiries
CREATE OR REPLACE FUNCTION public.update_sales_inquiries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sales_inquiries_updated_at
  BEFORE UPDATE ON public.sales_inquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_sales_inquiries_updated_at();

-- Create trigger to update updated_at timestamp on sales_inquiry_items
CREATE OR REPLACE FUNCTION public.update_sales_inquiry_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sales_inquiry_items_updated_at
  BEFORE UPDATE ON public.sales_inquiry_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_sales_inquiry_items_updated_at();
