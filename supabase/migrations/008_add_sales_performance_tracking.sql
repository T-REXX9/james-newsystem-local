-- Add monthly_quota to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS monthly_quota DECIMAL(12, 2) DEFAULT 0;

-- Create agent_sales_summary table to track daily sales aggregations
CREATE TABLE IF NOT EXISTS public.agent_sales_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_sales DECIMAL(12, 2) NOT NULL DEFAULT 0,
  sales_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(agent_id, date)
);

-- Create indexes for fast queries
CREATE INDEX idx_agent_sales_summary_agent_id ON public.agent_sales_summary(agent_id);
CREATE INDEX idx_agent_sales_summary_date ON public.agent_sales_summary(date DESC);
CREATE INDEX idx_agent_sales_summary_agent_date ON public.agent_sales_summary(agent_id, date DESC);

-- Create agent_customer_breakdown table to track customer status distribution
CREATE TABLE IF NOT EXISTS public.agent_customer_breakdown (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  prospective_count INTEGER NOT NULL DEFAULT 0,
  active_count INTEGER NOT NULL DEFAULT 0,
  inactive_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(agent_id, date)
);

-- Create indexes for fast queries
CREATE INDEX idx_agent_customer_breakdown_agent_id ON public.agent_customer_breakdown(agent_id);
CREATE INDEX idx_agent_customer_breakdown_date ON public.agent_customer_breakdown(date DESC);
CREATE INDEX idx_agent_customer_breakdown_agent_date ON public.agent_customer_breakdown(agent_id, date DESC);

-- Create agent_top_customers table to track top customers by sales
CREATE TABLE IF NOT EXISTS public.agent_top_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  total_sales DECIMAL(12, 2) NOT NULL DEFAULT 0,
  last_purchase_date DATE,
  rank INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(agent_id, contact_id)
);

-- Create indexes for fast queries
CREATE INDEX idx_agent_top_customers_agent_id ON public.agent_top_customers(agent_id);
CREATE INDEX idx_agent_top_customers_rank ON public.agent_top_customers(agent_id, rank);
CREATE INDEX idx_agent_top_customers_agent_rank ON public.agent_top_customers(agent_id, rank ASC);

-- Enable Row Level Security (optional - can be added if RLS policies are needed)
ALTER TABLE public.agent_sales_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_customer_breakdown ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_top_customers ENABLE ROW LEVEL SECURITY;

-- Create a trigger to update the updated_at column for agent_sales_summary
CREATE OR REPLACE FUNCTION update_agent_sales_summary_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_agent_sales_summary_updated_at
BEFORE UPDATE ON public.agent_sales_summary
FOR EACH ROW
EXECUTE FUNCTION update_agent_sales_summary_updated_at();

-- Create a trigger to update the updated_at column for agent_customer_breakdown
CREATE OR REPLACE FUNCTION update_agent_customer_breakdown_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_agent_customer_breakdown_updated_at
BEFORE UPDATE ON public.agent_customer_breakdown
FOR EACH ROW
EXECUTE FUNCTION update_agent_customer_breakdown_updated_at();

-- Create a trigger to update the updated_at column for agent_top_customers
CREATE OR REPLACE FUNCTION update_agent_top_customers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_agent_top_customers_updated_at
BEFORE UPDATE ON public.agent_top_customers
FOR EACH ROW
EXECUTE FUNCTION update_agent_top_customers_updated_at();
