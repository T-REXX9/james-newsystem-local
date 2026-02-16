-- Seed 30 days of sales performance data
-- Update existing agents with monthly quotas
UPDATE public.profiles 
SET monthly_quota = CASE 
  WHEN full_name = 'Miguel Santos' THEN 100000
  WHEN full_name = 'Esther Van' THEN 120000
  WHEN full_name = 'Corbin Dallas' THEN 95000
  WHEN full_name = 'Sofia Reyes' THEN 110000
END
WHERE full_name IN ('Miguel Santos', 'Esther Van', 'Corbin Dallas', 'Sofia Reyes');

-- Generate 150 purchase records distributed across 30 days
INSERT INTO public.purchases (contact_id, amount, status, purchased_at, notes)
SELECT 
  c.id,
  (500 + (RANDOM() * 14500)::int)::decimal,
  'paid',
  NOW() - (RANDOM() * INTERVAL '30 days'),
  'Generated sales data'
FROM public.contacts c, generate_series(1, 150)
WHERE c.id IS NOT NULL
LIMIT 150;

-- Populate agent_sales_summary with daily aggregations for past 30 days
INSERT INTO public.agent_sales_summary (agent_id, date, total_sales, sales_count)
SELECT 
  p.id as agent_id,
  d.date,
  COALESCE(SUM(pu.amount), 0)::decimal as total_sales,
  COUNT(pu.id)::integer as sales_count
FROM public.profiles p
CROSS JOIN (
  SELECT (NOW()::date - (n || ' days')::interval)::date as date
  FROM generate_series(0, 29) n
) d
LEFT JOIN public.contacts c ON c.salesman = p.full_name
LEFT JOIN public.purchases pu ON pu.contact_id = c.id 
  AND pu.purchased_at::date = d.date
WHERE p.role = 'Sales Agent'
GROUP BY p.id, d.date
ON CONFLICT (agent_id, date) DO UPDATE SET 
  total_sales = EXCLUDED.total_sales,
  sales_count = EXCLUDED.sales_count;

-- Populate agent_customer_breakdown with customer status counts
INSERT INTO public.agent_customer_breakdown (agent_id, date, prospective_count, active_count, inactive_count)
SELECT 
  p.id as agent_id,
  NOW()::date as date,
  COUNT(CASE WHEN c.status = 'Prospective' THEN 1 END)::integer as prospective_count,
  COUNT(CASE WHEN c.status = 'Active' THEN 1 END)::integer as active_count,
  COUNT(CASE WHEN c.status = 'Inactive' THEN 1 END)::integer as inactive_count
FROM public.profiles p
LEFT JOIN public.contacts c ON c.salesman = p.full_name
WHERE p.role = 'Sales Agent'
GROUP BY p.id
ON CONFLICT (agent_id, date) DO UPDATE SET 
  prospective_count = EXCLUDED.prospective_count,
  active_count = EXCLUDED.active_count,
  inactive_count = EXCLUDED.inactive_count;

-- Populate agent_top_customers with top 5 customers per agent
INSERT INTO public.agent_top_customers (agent_id, contact_id, total_sales, rank)
SELECT 
  ranked.agent_id,
  ranked.contact_id,
  ranked.total_sales,
  ranked.rank
FROM (
  SELECT 
    p.id as agent_id,
    c.id as contact_id,
    COALESCE(SUM(pu.amount), 0)::decimal as total_sales,
    ROW_NUMBER() OVER (PARTITION BY p.id ORDER BY SUM(pu.amount) DESC) as rank
  FROM public.profiles p
  LEFT JOIN public.contacts c ON c.salesman = p.full_name
  LEFT JOIN public.purchases pu ON pu.contact_id = c.id
  WHERE p.role = 'Sales Agent'
  GROUP BY p.id, c.id
) ranked
WHERE ranked.rank <= 5
ON CONFLICT (agent_id, contact_id) DO UPDATE SET 
  total_sales = EXCLUDED.total_sales;
