-- 030_maintenance_schema.sql
-- Migration for Maintenance Module Tables

-- 1. Suppliers Table
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT,
    remarks TEXT,
    address TEXT,
    contact_person TEXT,
    tin TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Customer Groups Table
CREATE TABLE IF NOT EXISTS public.customer_groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    color TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Product Categories Table
CREATE TABLE IF NOT EXISTS public.product_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    parent_id UUID REFERENCES public.product_categories(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Couriers Table
CREATE TABLE IF NOT EXISTS public.couriers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    contact_number TEXT,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Remark Templates Table
CREATE TABLE IF NOT EXISTS public.remark_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT, -- e.g. 'invoice', 'purchase_order'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Teams Table
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Approvers Table
CREATE TABLE IF NOT EXISTS public.approvers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    module TEXT NOT NULL, -- 'PO', 'SO', etc.
    level INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Alter 'contacts' (Customers)
-- Add customer_group_id foreign key
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'customer_group_id') THEN
        ALTER TABLE public.contacts ADD COLUMN customer_group_id UUID REFERENCES public.customer_groups(id);
    END IF;
END $$;

-- Add 'status' only if it doesn't distinctively exist or we want to standardize it. 
-- Existing schema might handle this, but ensures we have a standard field if needed.
-- (Skipping status alteration properly as 'active', 'inactive' usually managed via soft delete or existing flags, will rely on inspection)

-- 9. Alter 'profiles' (Staff)
-- Add team_id foreign key
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'team_id') THEN
        ALTER TABLE public.profiles ADD COLUMN team_id UUID REFERENCES public.teams(id);
    END IF;
END $$;

-- Enable RLS on all new tables
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remark_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvers ENABLE ROW LEVEL SECURITY;

-- Create basic Policies (Authenticated users can view/edit for now - refine later based on Permissions)
CREATE POLICY "Enable read access for authenticated users" ON public.suppliers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable insert access for authenticated users" ON public.suppliers FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update access for authenticated users" ON public.suppliers FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete access for authenticated users" ON public.suppliers FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON public.customer_groups FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON public.customer_groups FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON public.product_categories FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON public.product_categories FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON public.couriers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON public.couriers FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON public.remark_templates FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON public.remark_templates FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON public.teams FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON public.teams FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON public.approvers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON public.approvers FOR ALL USING (auth.role() = 'authenticated');

-- Grant permissions
GRANT ALL ON public.suppliers TO authenticated;
GRANT ALL ON public.customer_groups TO authenticated;
GRANT ALL ON public.product_categories TO authenticated;
GRANT ALL ON public.couriers TO authenticated;
GRANT ALL ON public.remark_templates TO authenticated;
GRANT ALL ON public.teams TO authenticated;
GRANT ALL ON public.approvers TO authenticated;
