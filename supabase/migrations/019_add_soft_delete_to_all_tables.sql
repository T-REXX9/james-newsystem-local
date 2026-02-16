-- 019_add_soft_delete_to_all_tables.sql
-- Adds soft delete columns to all relevant tables

-- sales_orders table
ALTER TABLE sales_orders
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

ALTER TABLE sales_orders
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_sales_orders_is_deleted 
ON sales_orders(is_deleted);

CREATE INDEX IF NOT EXISTS idx_sales_orders_deleted_at 
ON sales_orders(deleted_at);

-- order_slips table
ALTER TABLE order_slips
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

ALTER TABLE order_slips
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_order_slips_is_deleted 
ON order_slips(is_deleted);

CREATE INDEX IF NOT EXISTS idx_order_slips_deleted_at 
ON order_slips(deleted_at);

-- invoices table
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_invoices_is_deleted 
ON invoices(is_deleted);

CREATE INDEX IF NOT EXISTS idx_invoices_deleted_at 
ON invoices(deleted_at);

-- tasks table
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tasks_is_deleted 
ON tasks(is_deleted);

CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at 
ON tasks(deleted_at);

-- products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_products_is_deleted 
ON products(is_deleted);

CREATE INDEX IF NOT EXISTS idx_products_deleted_at 
ON products(deleted_at);

-- team_messages table
ALTER TABLE team_messages
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

ALTER TABLE team_messages
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_team_messages_is_deleted 
ON team_messages(is_deleted);

CREATE INDEX IF NOT EXISTS idx_team_messages_deleted_at 
ON team_messages(deleted_at);

-- notifications table
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_notifications_is_deleted 
ON notifications(is_deleted);

CREATE INDEX IF NOT EXISTS idx_notifications_deleted_at 
ON notifications(deleted_at);

-- contacts table
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_contacts_is_deleted 
ON contacts(is_deleted);

CREATE INDEX IF NOT EXISTS idx_contacts_deleted_at 
ON contacts(deleted_at);