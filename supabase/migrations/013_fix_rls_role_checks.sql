-- Fix RLS policies for sales_inquiries
DROP POLICY IF EXISTS "Users can view their own inquiries" ON public.sales_inquiries;
DROP POLICY IF EXISTS "Users can insert their own inquiries" ON public.sales_inquiries;
DROP POLICY IF EXISTS "Users can update their own inquiries" ON public.sales_inquiries;
DROP POLICY IF EXISTS "Users can delete their own inquiries" ON public.sales_inquiries;

CREATE POLICY "Users can view their own inquiries"
  ON public.sales_inquiries
  FOR SELECT
  USING (
    auth.uid() = created_by 
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role = 'Owner'
    )
  );

CREATE POLICY "Users can insert their own inquiries"
  ON public.sales_inquiries
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own inquiries"
  ON public.sales_inquiries
  FOR UPDATE
  USING (
    auth.uid() = created_by 
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role = 'Owner'
    )
  );

CREATE POLICY "Users can delete their own inquiries"
  ON public.sales_inquiries
  FOR DELETE
  USING (
    auth.uid() = created_by 
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role = 'Owner'
    )
  );

-- Fix RLS policies for sales_inquiry_items
DROP POLICY IF EXISTS "Users can view items of their own inquiries" ON public.sales_inquiry_items;
DROP POLICY IF EXISTS "Users can insert items to their own inquiries" ON public.sales_inquiry_items;
DROP POLICY IF EXISTS "Users can update items of their own inquiries" ON public.sales_inquiry_items;
DROP POLICY IF EXISTS "Users can delete items of their own inquiries" ON public.sales_inquiry_items;

CREATE POLICY "Users can view items of their own inquiries"
  ON public.sales_inquiry_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sales_inquiries
      WHERE id = inquiry_id
      AND (
        auth.uid() = created_by 
        OR EXISTS (
          SELECT 1 FROM public.profiles 
          WHERE id = auth.uid() 
          AND role = 'Owner'
        )
      )
    )
  );

CREATE POLICY "Users can insert items to their own inquiries"
  ON public.sales_inquiry_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sales_inquiries
      WHERE id = inquiry_id
      AND auth.uid() = created_by
    )
  );

CREATE POLICY "Users can update items of their own inquiries"
  ON public.sales_inquiry_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.sales_inquiries
      WHERE id = inquiry_id
      AND (
        auth.uid() = created_by 
        OR EXISTS (
          SELECT 1 FROM public.profiles 
          WHERE id = auth.uid() 
          AND role = 'Owner'
        )
      )
    )
  );

CREATE POLICY "Users can delete items of their own inquiries"
  ON public.sales_inquiry_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.sales_inquiries
      WHERE id = inquiry_id
      AND (
        auth.uid() = created_by 
        OR EXISTS (
          SELECT 1 FROM public.profiles 
          WHERE id = auth.uid() 
          AND role = 'Owner'
        )
      )
    )
  );

-- Fix RLS policies for sales_orders
DROP POLICY IF EXISTS "Users can view their sales orders" ON public.sales_orders;
DROP POLICY IF EXISTS "Users can insert sales orders" ON public.sales_orders;
DROP POLICY IF EXISTS "Users can update their sales orders" ON public.sales_orders;
DROP POLICY IF EXISTS "Users can delete their sales orders" ON public.sales_orders;

CREATE POLICY "Users can view their sales orders"
  ON public.sales_orders
  FOR SELECT
  USING (
    auth.uid() = created_by 
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('Owner', 'Manager')
    )
  );

CREATE POLICY "Users can insert sales orders"
  ON public.sales_orders
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their sales orders"
  ON public.sales_orders
  FOR UPDATE
  USING (
    auth.uid() = created_by 
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('Owner', 'Manager')
    )
  );

CREATE POLICY "Users can delete their sales orders"
  ON public.sales_orders
  FOR DELETE
  USING (
    auth.uid() = created_by 
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role = 'Owner'
    )
  );

-- Fix RLS policies for sales_order_items
DROP POLICY IF EXISTS "Users can view their sales order items" ON public.sales_order_items;
DROP POLICY IF EXISTS "Users can modify their sales order items" ON public.sales_order_items;
DROP POLICY IF EXISTS "Users can insert sales order items" ON public.sales_order_items;

CREATE POLICY "Users can view their sales order items"
  ON public.sales_order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sales_orders
      WHERE id = order_id
      AND (
        auth.uid() = created_by 
        OR EXISTS (
          SELECT 1 FROM public.profiles 
          WHERE id = auth.uid() 
          AND role IN ('Owner', 'Manager')
        )
      )
    )
  );

CREATE POLICY "Users can modify their sales order items"
  ON public.sales_order_items
  USING (
    EXISTS (
      SELECT 1 FROM public.sales_orders
      WHERE id = order_id
      AND (
        auth.uid() = created_by 
        OR EXISTS (
          SELECT 1 FROM public.profiles 
          WHERE id = auth.uid() 
          AND role IN ('Owner', 'Manager')
        )
      )
    )
  );

CREATE POLICY "Users can insert sales order items"
  ON public.sales_order_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sales_orders
      WHERE id = order_id
      AND auth.uid() = created_by
    )
  );

-- Fix RLS policies for order_slips
DROP POLICY IF EXISTS "Users can view their order slips" ON public.order_slips;
DROP POLICY IF EXISTS "Users can insert order slips" ON public.order_slips;
DROP POLICY IF EXISTS "Users can update their order slips" ON public.order_slips;

CREATE POLICY "Users can view their order slips"
  ON public.order_slips
  FOR SELECT
  USING (
    auth.uid() = created_by 
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('Owner', 'Manager', 'Finance')
    )
  );

CREATE POLICY "Users can insert order slips"
  ON public.order_slips
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their order slips"
  ON public.order_slips
  FOR UPDATE
  USING (
    auth.uid() = created_by 
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('Owner', 'Manager')
    )
  );

-- Fix RLS policies for order_slip_items
DROP POLICY IF EXISTS "Users can view order slip items" ON public.order_slip_items;
DROP POLICY IF EXISTS "Users can modify order slip items" ON public.order_slip_items;

CREATE POLICY "Users can view order slip items"
  ON public.order_slip_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.order_slips
      WHERE id = order_slip_id
      AND (
        auth.uid() = created_by 
        OR EXISTS (
          SELECT 1 FROM public.profiles 
          WHERE id = auth.uid() 
          AND role IN ('Owner', 'Manager', 'Finance')
        )
      )
    )
  );

CREATE POLICY "Users can modify order slip items"
  ON public.order_slip_items
  USING (
    EXISTS (
      SELECT 1 FROM public.order_slips
      WHERE id = order_slip_id
      AND (
        auth.uid() = created_by 
        OR EXISTS (
          SELECT 1 FROM public.profiles 
          WHERE id = auth.uid() 
          AND role IN ('Owner', 'Manager')
        )
      )
    )
  );

-- Fix RLS policies for invoices
DROP POLICY IF EXISTS "Users can view invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can insert invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can update invoices" ON public.invoices;

CREATE POLICY "Users can view invoices"
  ON public.invoices
  FOR SELECT
  USING (
    auth.uid() = created_by 
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('Owner', 'Manager', 'Finance')
    )
  );

CREATE POLICY "Users can insert invoices"
  ON public.invoices
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update invoices"
  ON public.invoices
  FOR UPDATE
  USING (
    auth.uid() = created_by 
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('Owner', 'Manager', 'Finance')
    )
  );

-- Fix RLS policies for invoice_items
DROP POLICY IF EXISTS "Users can view invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Users can insert invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Users can modify invoice items" ON public.invoice_items;

CREATE POLICY "Users can view invoice items"
  ON public.invoice_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices
      WHERE id = invoice_id
      AND (
        auth.uid() = created_by 
        OR EXISTS (
          SELECT 1 FROM public.profiles 
          WHERE id = auth.uid() 
          AND role IN ('Owner', 'Manager', 'Finance')
        )
      )
    )
  );

CREATE POLICY "Users can insert invoice items"
  ON public.invoice_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices
      WHERE id = invoice_id
      AND auth.uid() = created_by
    )
  );

CREATE POLICY "Users can modify invoice items"
  ON public.invoice_items
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices
      WHERE id = invoice_id
      AND (
        auth.uid() = created_by 
        OR EXISTS (
          SELECT 1 FROM public.profiles 
          WHERE id = auth.uid() 
          AND role IN ('Owner', 'Manager', 'Finance')
        )
      )
    )
  );
