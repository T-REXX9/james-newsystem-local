-- 020_add_soft_delete_rls_policies.sql
-- Adds RLS policies to enforce soft delete filtering for regular users
-- Owner and Developer roles can see deleted items for recycle bin functionality

-- Enable RLS on tables (should already be enabled, but just in case)
DO $$ 
BEGIN
    -- Ensure RLS is enabled for tables with soft delete
    EXECUTE 'ALTER TABLE IF EXISTS sales_orders ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE IF EXISTS order_slips ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE IF EXISTS invoices ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE IF EXISTS tasks ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE IF EXISTS products ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE IF EXISTS team_messages ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE IF EXISTS notifications ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE IF EXISTS contacts ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE IF EXISTS sales_inquiries ENABLE ROW LEVEL SECURITY';
EXCEPTION
    WHEN undefined_table THEN
        NULL; -- Table might not exist yet, ignore
END $$;

-- Drop existing policies if they exist (clean slate)
DO $$ 
BEGIN
    -- Drop policies for sales_orders
    DROP POLICY IF EXISTS "Regular users see non-deleted sales orders" ON sales_orders;
    DROP POLICY IF EXISTS "Owners and Developers see all sales orders" ON sales_orders;
    
    -- Drop policies for order_slips
    DROP POLICY IF EXISTS "Regular users see non-deleted order slips" ON order_slips;
    DROP POLICY IF EXISTS "Owners and Developers see all order slips" ON order_slips;
    
    -- Drop policies for invoices
    DROP POLICY IF EXISTS "Regular users see non-deleted invoices" ON invoices;
    DROP POLICY IF EXISTS "Owners and Developers see all invoices" ON invoices;
    
    -- Drop policies for tasks
    DROP POLICY IF EXISTS "Regular users see non-deleted tasks" ON tasks;
    DROP POLICY IF EXISTS "Owners and Developers see all tasks" ON tasks;
    
    -- Drop policies for products
    DROP POLICY IF EXISTS "Regular users see non-deleted products" ON products;
    DROP POLICY IF EXISTS "Owners and Developers see all products" ON products;
    
    -- Drop policies for team_messages
    DROP POLICY IF EXISTS "Regular users see non-deleted team messages" ON team_messages;
    DROP POLICY IF EXISTS "Owners and Developers see all team messages" ON team_messages;
    
    -- Drop policies for notifications
    DROP POLICY IF EXISTS "Regular users see non-deleted notifications" ON notifications;
    DROP POLICY IF EXISTS "Owners and Developers see all notifications" ON notifications;
    
    -- Drop policies for contacts
    DROP POLICY IF EXISTS "Regular users see non-deleted contacts" ON contacts;
    DROP POLICY IF EXISTS "Owners and Developers see all contacts" ON contacts;
    
    -- Drop policies for sales_inquiries
    DROP POLICY IF EXISTS "Regular users see non-deleted sales inquiries" ON sales_inquiries;
    DROP POLICY IF EXISTS "Owners and Developers see all sales inquiries" ON sales_inquiries;
EXCEPTION
    WHEN undefined_object THEN
        NULL; -- Policy might not exist, ignore
END $$;

-- Helper function to check if user is Owner or Developer
CREATE OR REPLACE FUNCTION is_owner_or_developer(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role
    FROM profiles
    WHERE id = user_id;
    
    RETURN user_role IN ('Owner', 'Developer');
END;
$$;

-- Create policies for sales_orders
CREATE POLICY "Regular users see non-deleted sales orders"
ON sales_orders
FOR SELECT
USING (
    (is_deleted = false AND auth.uid() IS NOT NULL)
    OR is_owner_or_developer(auth.uid())
);

CREATE POLICY "Regular users insert sales orders"
ON sales_orders
FOR INSERT
WITH CHECK (
    auth.uid() IS NOT NULL
);

CREATE POLICY "Regular users update non-deleted sales orders"
ON sales_orders
FOR UPDATE
USING (
    (is_deleted = false AND auth.uid() IS NOT NULL)
    OR is_owner_or_developer(auth.uid())
)
WITH CHECK (
    (is_deleted = false AND auth.uid() IS NOT NULL)
    OR is_owner_or_developer(auth.uid())
);

CREATE POLICY "Regular users delete sales orders (soft delete)"
ON sales_orders
FOR DELETE
USING (
    auth.uid() IS NOT NULL
    OR is_owner_or_developer(auth.uid())
);

CREATE POLICY "Owners and Developers see all sales orders"
ON sales_orders
FOR ALL
USING (
    is_owner_or_developer(auth.uid())
);

-- Create policies for order_slips
CREATE POLICY "Regular users see non-deleted order slips"
ON order_slips
FOR SELECT
USING (
    (is_deleted = false AND auth.uid() IS NOT NULL)
    OR is_owner_or_developer(auth.uid())
);

CREATE POLICY "Regular users insert order slips"
ON order_slips
FOR INSERT
WITH CHECK (
    auth.uid() IS NOT NULL
);

CREATE POLICY "Regular users update non-deleted order slips"
ON order_slips
FOR UPDATE
USING (
    (is_deleted = false AND auth.uid() IS NOT NULL)
    OR is_owner_or_developer(auth.uid())
)
WITH CHECK (
    (is_deleted = false AND auth.uid() IS NOT NULL)
    OR is_owner_or_developer(auth.uid())
);

CREATE POLICY "Regular users delete order slips (soft delete)"
ON order_slips
FOR DELETE
USING (
    auth.uid() IS NOT NULL
    OR is_owner_or_developer(auth.uid())
);

CREATE POLICY "Owners and Developers see all order slips"
ON order_slips
FOR ALL
USING (
    is_owner_or_developer(auth.uid())
);

-- Create policies for invoices
CREATE POLICY "Regular users see non-deleted invoices"
ON invoices
FOR SELECT
USING (
    (is_deleted = false AND auth.uid() IS NOT NULL)
    OR is_owner_or_developer(auth.uid())
);

CREATE POLICY "Regular users insert invoices"
ON invoices
FOR INSERT
WITH CHECK (
    auth.uid() IS NOT NULL
);

CREATE POLICY "Regular users update non-deleted invoices"
ON invoices
FOR UPDATE
USING (
    (is_deleted = false AND auth.uid() IS NOT NULL)
    OR is_owner_or_developer(auth.uid())
)
WITH CHECK (
    (is_deleted = false AND auth.uid() IS NOT NULL)
    OR is_owner_or_developer(auth.uid())
);

CREATE POLICY "Regular users delete invoices (soft delete)"
ON invoices
FOR DELETE
USING (
    auth.uid() IS NOT NULL
    OR is_owner_or_developer(auth.uid())
);

CREATE POLICY "Owners and Developers see all invoices"
ON invoices
FOR ALL
USING (
    is_owner_or_developer(auth.uid())
);

-- Create policies for tasks
CREATE POLICY "Regular users see non-deleted tasks"
ON tasks
FOR SELECT
USING (
    (is_deleted = false AND auth.uid() IS NOT NULL)
    OR is_owner_or_developer(auth.uid())
);

CREATE POLICY "Regular users insert tasks"
ON tasks
FOR INSERT
WITH CHECK (
    auth.uid() IS NOT NULL
);

CREATE POLICY "Regular users update non-deleted tasks"
ON tasks
FOR UPDATE
USING (
    (is_deleted = false AND auth.uid() IS NOT NULL)
    OR is_owner_or_developer(auth.uid())
)
WITH CHECK (
    (is_deleted = false AND auth.uid() IS NOT NULL)
    OR is_owner_or_developer(auth.uid())
);

CREATE POLICY "Regular users delete tasks (soft delete)"
ON tasks
FOR DELETE
USING (
    auth.uid() IS NOT NULL
    OR is_owner_or_developer(auth.uid())
);

CREATE POLICY "Owners and Developers see all tasks"
ON tasks
FOR ALL
USING (
    is_owner_or_developer(auth.uid())
);

-- Create policies for products
CREATE POLICY "Regular users see non-deleted products"
ON products
FOR SELECT
USING (
    (is_deleted = false AND auth.uid() IS NOT NULL)
    OR is_owner_or_developer(auth.uid())
);

CREATE POLICY "Regular users insert products"
ON products
FOR INSERT
WITH CHECK (
    auth.uid() IS NOT NULL
);

CREATE POLICY "Regular users update non-deleted products"
ON products
FOR UPDATE
USING (
    (is_deleted = false AND auth.uid() IS NOT NULL)
    OR is_owner_or_developer(auth.uid())
)
WITH CHECK (
    (is_deleted = false AND auth.uid() IS NOT NULL)
    OR is_owner_or_developer(auth.uid())
);

CREATE POLICY "Regular users delete products (soft delete)"
ON products
FOR DELETE
USING (
    auth.uid() IS NOT NULL
    OR is_owner_or_developer(auth.uid())
);

CREATE POLICY "Owners and Developers see all products"
ON products
FOR ALL
USING (
    is_owner_or_developer(auth.uid())
);

-- Create policies for team_messages
CREATE POLICY "Regular users see non-deleted team messages"
ON team_messages
FOR SELECT
USING (
    (is_deleted = false AND auth.uid() IS NOT NULL)
    OR is_owner_or_developer(auth.uid())
);

CREATE POLICY "Regular users insert team messages"
ON team_messages
FOR INSERT
WITH CHECK (
    auth.uid() IS NOT NULL
);

CREATE POLICY "Regular users update non-deleted team messages"
ON team_messages
FOR UPDATE
USING (
    (is_deleted = false AND auth.uid() IS NOT NULL)
    OR is_owner_or_developer(auth.uid())
)
WITH CHECK (
    (is_deleted = false AND auth.uid() IS NOT NULL)
    OR is_owner_or_developer(auth.uid())
);

CREATE POLICY "Regular users delete team messages (soft delete)"
ON team_messages
FOR DELETE
USING (
    auth.uid() IS NOT NULL
    OR is_owner_or_developer(auth.uid())
);

CREATE POLICY "Owners and Developers see all team messages"
ON team_messages
FOR ALL
USING (
    is_owner_or_developer(auth.uid())
);

-- Create policies for notifications
-- Notifications are already user-specific (recipient_id), but we still need soft delete filtering
CREATE POLICY "Regular users see non-deleted notifications"
ON notifications
FOR SELECT
USING (
    (is_deleted = false AND recipient_id = auth.uid())
    OR is_owner_or_developer(auth.uid())
);

CREATE POLICY "Regular users insert notifications"
ON notifications
FOR INSERT
WITH CHECK (
    auth.uid() IS NOT NULL
);

CREATE POLICY "Regular users update non-deleted notifications"
ON notifications
FOR UPDATE
USING (
    (is_deleted = false AND (recipient_id = auth.uid() OR auth.uid() IS NOT NULL))
    OR is_owner_or_developer(auth.uid())
)
WITH CHECK (
    (is_deleted = false AND (recipient_id = auth.uid() OR auth.uid() IS NOT NULL))
    OR is_owner_or_developer(auth.uid())
);

CREATE POLICY "Regular users delete notifications (soft delete)"
ON notifications
FOR DELETE
USING (
    (recipient_id = auth.uid() OR auth.uid() IS NOT NULL)
    OR is_owner_or_developer(auth.uid())
);

CREATE POLICY "Owners and Developers see all notifications"
ON notifications
FOR ALL
USING (
    is_owner_or_developer(auth.uid())
);

-- Create policies for contacts
CREATE POLICY "Regular users see non-deleted contacts"
ON contacts
FOR SELECT
USING (
    (is_deleted = false AND auth.uid() IS NOT NULL)
    OR is_owner_or_developer(auth.uid())
);

CREATE POLICY "Regular users insert contacts"
ON contacts
FOR INSERT
WITH CHECK (
    auth.uid() IS NOT NULL
);

CREATE POLICY "Regular users update non-deleted contacts"
ON contacts
FOR UPDATE
USING (
    (is_deleted = false AND auth.uid() IS NOT NULL)
    OR is_owner_or_developer(auth.uid())
)
WITH CHECK (
    (is_deleted = false AND auth.uid() IS NOT NULL)
    OR is_owner_or_developer(auth.uid())
);

CREATE POLICY "Regular users delete contacts (soft delete)"
ON contacts
FOR DELETE
USING (
    auth.uid() IS NOT NULL
    OR is_owner_or_developer(auth.uid())
);

CREATE POLICY "Owners and Developers see all contacts"
ON contacts
FOR ALL
USING (
    is_owner_or_developer(auth.uid())
);

-- Create policies for sales_inquiries
CREATE POLICY "Regular users see non-deleted sales inquiries"
ON sales_inquiries
FOR SELECT
USING (
    (is_deleted = false AND auth.uid() IS NOT NULL)
    OR is_owner_or_developer(auth.uid())
);

CREATE POLICY "Regular users insert sales inquiries"
ON sales_inquiries
FOR INSERT
WITH CHECK (
    auth.uid() IS NOT NULL
);

CREATE POLICY "Regular users update non-deleted sales inquiries"
ON sales_inquiries
FOR UPDATE
USING (
    (is_deleted = false AND auth.uid() IS NOT NULL)
    OR is_owner_or_developer(auth.uid())
)
WITH CHECK (
    (is_deleted = false AND auth.uid() IS NOT NULL)
    OR is_owner_or_developer(auth.uid())
);

CREATE POLICY "Regular users delete sales inquiries (soft delete)"
ON sales_inquiries
FOR DELETE
USING (
    auth.uid() IS NOT NULL
    OR is_owner_or_developer(auth.uid())
);

CREATE POLICY "Owners and Developers see all sales inquiries"
ON sales_inquiries
FOR ALL
USING (
    is_owner_or_developer(auth.uid())
);