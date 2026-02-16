-- 031_create_contact_persons.sql
CREATE TABLE IF NOT EXISTS public.contact_persons (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contact_id TEXT REFERENCES public.contacts(id) NOT NULL, -- contacts.id is text in existing schema
    name TEXT NOT NULL,
    position TEXT,
    mobile_number TEXT,
    email TEXT,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contact_persons ENABLE ROW LEVEL SECURITY;

-- Create Policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contact_persons' AND policyname = 'Enable all access for authenticated users') THEN
        CREATE POLICY "Enable all access for authenticated users" ON public.contact_persons FOR ALL USING (auth.role() = 'authenticated');
    END IF;
END $$;

-- Grant permissions
GRANT ALL ON public.contact_persons TO authenticated;
