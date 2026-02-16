-- Enable RLS on all new tables
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE couriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE remark_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvers ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_persons ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is admin/manager (optional, or just use role check in policy)
-- Assuming auth.jwt() -> user_metadata -> role exists, or joining profiles.
-- For simplicity, we often check if auth.uid() is in a list of admins, or use a claim.
-- Here we'll allow all authenticated users to READ (Select) these master tables.

-- SUPPLIERS
CREATE POLICY "Allow read access for authenticated users" ON suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write access for Managers and Owners" ON suppliers FOR ALL TO authenticated USING (
  exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('Owner', 'Manager', 'Admin', 'Developer')
  )
);

-- TEAMS
CREATE POLICY "Allow read access for authenticated users" ON teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write access for Managers and Owners" ON teams FOR ALL TO authenticated USING (
  exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('Owner', 'Manager', 'Admin', 'Developer')
  )
);

-- CUSTOMER GROUPS
CREATE POLICY "Allow read access for authenticated users" ON customer_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write access for Managers and Owners" ON customer_groups FOR ALL TO authenticated USING (
  exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('Owner', 'Manager', 'Admin', 'Developer')
  )
);

-- PRODUCT CATEGORIES
CREATE POLICY "Allow read access for authenticated users" ON product_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write access for Managers and Owners" ON product_categories FOR ALL TO authenticated USING (
  exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('Owner', 'Manager', 'Admin', 'Developer')
  )
);

-- COURIERS
CREATE POLICY "Allow read access for authenticated users" ON couriers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write access for Managers and Owners" ON couriers FOR ALL TO authenticated USING (
  exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('Owner', 'Manager', 'Admin', 'Developer')
  )
);

-- REMARK TEMPLATES
CREATE POLICY "Allow read access for authenticated users" ON remark_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write access for Managers and Owners" ON remark_templates FOR ALL TO authenticated USING (
  exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('Owner', 'Manager', 'Admin', 'Developer')
  )
);

-- APPROVERS
CREATE POLICY "Allow read access for authenticated users" ON approvers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write access for Managers and Owners" ON approvers FOR ALL TO authenticated USING (
  exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('Owner', 'Manager', 'Admin', 'Developer')
  )
);

-- CONTACT PERSONS
-- Allow read for all authenticated
CREATE POLICY "Allow read access for authenticated users" ON contact_persons FOR SELECT TO authenticated USING (true);
-- Allow write for all authenticated (Sales Agents need to add contact persons)
-- Ideally we restrict to owner of contact, but for now we trust authenticated users for contact persons management to avoid complex joins blocking valid work.
CREATE POLICY "Allow write access for authenticated users" ON contact_persons FOR ALL TO authenticated USING (true) WITH CHECK (true);
