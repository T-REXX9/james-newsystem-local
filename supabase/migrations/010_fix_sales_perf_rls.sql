-- Enable read access for authenticated and anon users on sales performance tables

-- Policy for agent_sales_summary
CREATE POLICY "Enable read access for all users" ON public.agent_sales_summary
FOR SELECT USING (true);

-- Policy for agent_customer_breakdown
CREATE POLICY "Enable read access for all users" ON public.agent_customer_breakdown
FOR SELECT USING (true);

-- Policy for agent_top_customers
CREATE POLICY "Enable read access for all users" ON public.agent_top_customers
FOR SELECT USING (true);
