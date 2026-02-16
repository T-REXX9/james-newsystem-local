-- Add status column to sales_inquiries
ALTER TABLE public.sales_inquiries
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';

-- Ensure status values remain consistent
ALTER TABLE public.sales_inquiries
ADD CONSTRAINT sales_inquiries_status_check
CHECK (status IN ('draft', 'confirmed', 'converted_to_order', 'cancelled'));

-- Create index on sales inquiry status
CREATE INDEX IF NOT EXISTS idx_sales_inquiries_status ON public.sales_inquiries(status);

-- Sales Orders table
CREATE TABLE IF NOT EXISTS public.sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no TEXT UNIQUE NOT NULL,
  inquiry_id UUID REFERENCES public.sales_inquiries(id) ON DELETE SET NULL,
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
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.sales_orders
ADD CONSTRAINT sales_orders_status_check
CHECK (status IN ('pending', 'confirmed', 'converted_to_document', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_sales_orders_contact_id ON public.sales_orders(contact_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON public.sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_inquiry_id ON public.sales_orders(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_created_at ON public.sales_orders(created_at);

-- Sales Order Items
CREATE TABLE IF NOT EXISTS public.sales_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_sales_order_items_order_id ON public.sales_order_items(order_id);

-- Order Slips table
CREATE TABLE IF NOT EXISTS public.order_slips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slip_no TEXT UNIQUE NOT NULL,
  order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
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
  status TEXT NOT NULL DEFAULT 'draft',
  printed_at TIMESTAMPTZ,
  printed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.order_slips
ADD CONSTRAINT order_slips_status_check
CHECK (status IN ('draft', 'finalized', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_order_slips_order_id ON public.order_slips(order_id);
CREATE INDEX IF NOT EXISTS idx_order_slips_contact_id ON public.order_slips(contact_id);
CREATE INDEX IF NOT EXISTS idx_order_slips_status ON public.order_slips(status);
CREATE INDEX IF NOT EXISTS idx_order_slips_created_at ON public.order_slips(created_at);

-- Order Slip Items
CREATE TABLE IF NOT EXISTS public.order_slip_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_slip_id UUID NOT NULL REFERENCES public.order_slips(id) ON DELETE CASCADE,
  qty INTEGER NOT NULL DEFAULT 1,
  part_no TEXT,
  item_code TEXT,
  location TEXT,
  description TEXT,
  unit_price NUMERIC DEFAULT 0,
  amount NUMERIC DEFAULT 0,
  remark TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_slip_items_slip_id ON public.order_slip_items(order_slip_id);

-- Invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no TEXT UNIQUE NOT NULL,
  order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
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
  status TEXT NOT NULL DEFAULT 'draft',
  due_date DATE,
  payment_date DATE,
  payment_method TEXT,
  printed_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.invoices
ADD CONSTRAINT invoices_status_check
CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON public.invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_contact_id ON public.invoices(contact_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON public.invoices(created_at);

-- Invoice Items
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  qty INTEGER NOT NULL DEFAULT 1,
  part_no TEXT,
  item_code TEXT,
  description TEXT,
  unit_price NUMERIC DEFAULT 0,
  amount NUMERIC DEFAULT 0,
  vat_rate NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);

-- Enable RLS and policies for sales_orders
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_slips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_slip_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- Helper policy clauses
CREATE POLICY "Users can view their sales orders"
  ON public.sales_orders
  FOR SELECT
  USING (auth.uid() = created_by OR (SELECT role FROM auth.users WHERE id = auth.uid())::text IN ('Owner','Manager'));

CREATE POLICY "Users can insert sales orders"
  ON public.sales_orders
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their sales orders"
  ON public.sales_orders
  FOR UPDATE
  USING (auth.uid() = created_by OR (SELECT role FROM auth.users WHERE id = auth.uid())::text IN ('Owner','Manager'));

CREATE POLICY "Users can delete their sales orders"
  ON public.sales_orders
  FOR DELETE
  USING (auth.uid() = created_by OR (SELECT role FROM auth.users WHERE id = auth.uid())::text = 'Owner');

CREATE POLICY "Users can view their sales order items"
  ON public.sales_order_items
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.sales_orders
    WHERE id = order_id
    AND (auth.uid() = created_by OR (SELECT role FROM auth.users WHERE id = auth.uid())::text IN ('Owner','Manager'))
  ));

CREATE POLICY "Users can modify their sales order items"
  ON public.sales_order_items
  USING (EXISTS (
    SELECT 1 FROM public.sales_orders
    WHERE id = order_id
    AND (auth.uid() = created_by OR (SELECT role FROM auth.users WHERE id = auth.uid())::text IN ('Owner','Manager'))
  ));

CREATE POLICY "Users can insert sales order items"
  ON public.sales_order_items
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sales_orders
    WHERE id = order_id
    AND auth.uid() = created_by
  ));

-- Order slip policies
CREATE POLICY "Users can view their order slips"
  ON public.order_slips
  FOR SELECT
  USING (auth.uid() = created_by OR (SELECT role FROM auth.users WHERE id = auth.uid())::text IN ('Owner','Manager','Finance'));

CREATE POLICY "Users can insert order slips"
  ON public.order_slips
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their order slips"
  ON public.order_slips
  FOR UPDATE
  USING (auth.uid() = created_by OR (SELECT role FROM auth.users WHERE id = auth.uid())::text IN ('Owner','Manager'));

CREATE POLICY "Users can view order slip items"
  ON public.order_slip_items
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.order_slips
    WHERE id = order_slip_id
    AND (auth.uid() = created_by OR (SELECT role FROM auth.users WHERE id = auth.uid())::text IN ('Owner','Manager','Finance'))
  ));

CREATE POLICY "Users can modify order slip items"
  ON public.order_slip_items
  USING (EXISTS (
    SELECT 1 FROM public.order_slips
    WHERE id = order_slip_id
    AND (auth.uid() = created_by OR (SELECT role FROM auth.users WHERE id = auth.uid())::text IN ('Owner','Manager'))
  ));

-- Invoice policies
CREATE POLICY "Users can view invoices"
  ON public.invoices
  FOR SELECT
  USING (auth.uid() = created_by OR (SELECT role FROM auth.users WHERE id = auth.uid())::text IN ('Owner','Manager','Finance'));

CREATE POLICY "Users can insert invoices"
  ON public.invoices
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update invoices"
  ON public.invoices
  FOR UPDATE
  USING (auth.uid() = created_by OR (SELECT role FROM auth.users WHERE id = auth.uid())::text IN ('Owner','Manager','Finance'));

CREATE POLICY "Users can view invoice items"
  ON public.invoice_items
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.invoices
    WHERE id = invoice_id
    AND (auth.uid() = created_by OR (SELECT role FROM auth.users WHERE id = auth.uid())::text IN ('Owner','Manager','Finance'))
  ));

CREATE POLICY "Users can insert invoice items"
  ON public.invoice_items
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.invoices
    WHERE id = invoice_id
    AND auth.uid() = created_by
  ));

CREATE POLICY "Users can modify invoice items"
  ON public.invoice_items
  USING (EXISTS (
    SELECT 1 FROM public.invoices
    WHERE id = invoice_id
    AND (auth.uid() = created_by OR (SELECT role FROM auth.users WHERE id = auth.uid())::text IN ('Owner','Manager','Finance'))
  ));

-- Update triggers
CREATE OR REPLACE FUNCTION public.update_sales_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sales_orders_updated_at
  BEFORE UPDATE ON public.sales_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_sales_orders_updated_at();

CREATE OR REPLACE FUNCTION public.update_sales_order_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sales_order_items_updated_at
  BEFORE UPDATE ON public.sales_order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_sales_order_items_updated_at();

CREATE OR REPLACE FUNCTION public.update_order_slips_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_order_slips_updated_at
  BEFORE UPDATE ON public.order_slips
  FOR EACH ROW
  EXECUTE FUNCTION public.update_order_slips_updated_at();

CREATE OR REPLACE FUNCTION public.update_order_slip_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_order_slip_items_updated_at
  BEFORE UPDATE ON public.order_slip_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_order_slip_items_updated_at();

CREATE OR REPLACE FUNCTION public.update_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_invoices_updated_at();

CREATE OR REPLACE FUNCTION public.update_invoice_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_invoice_items_updated_at
  BEFORE UPDATE ON public.invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_invoice_items_updated_at();
