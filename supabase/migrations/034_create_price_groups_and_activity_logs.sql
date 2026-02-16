-- 034_create_price_groups_and_activity_logs.sql

-- 1. Price Groups (Special Price)
CREATE TABLE IF NOT EXISTS public.price_groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE, -- e.g. "Dealer", "Retail"
    code TEXT UNIQUE,          -- e.g. "AA", "BB"
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.price_groups ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read access for authenticated users" ON public.price_groups FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable write access for authenticated users" ON public.price_groups FOR ALL USING (auth.role() = 'authenticated');

-- 2. Activity Logs
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id),
    action TEXT NOT NULL,      -- e.g. "LOGIN", "CREATE_PO"
    entity_type TEXT,          -- e.g. "Purchase Order"
    entity_id TEXT,            -- ID of the entity affecting
    details JSONB,             -- Flexible payload
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Policies (Read only for most, Insert for system)
-- Everyone can insert (system logs actions)
CREATE POLICY "Enable insert for authenticated users" ON public.activity_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- Only admins/managers view logs? For now allow auth to view.
CREATE POLICY "Enable read access for authenticated users" ON public.activity_logs FOR SELECT USING (auth.role() = 'authenticated');

-- Grant permissions
GRANT ALL ON public.price_groups TO authenticated;
GRANT ALL ON public.activity_logs TO authenticated;
