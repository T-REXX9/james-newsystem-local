-- 017_create_recycle_bin_tables.sql
-- Creates tables for Recycle Bin system

-- Recycle Bin Items table
CREATE TABLE IF NOT EXISTS recycle_bin_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type TEXT NOT NULL, -- 'contact', 'inquiry', 'order', 'orderslip', 'invoice', etc.
  item_id TEXT NOT NULL, -- ID of the original item
  original_data JSONB NOT NULL, -- Full copy of the original item data
  deleted_by TEXT NOT NULL, -- User ID of who deleted the item
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  restore_token TEXT NOT NULL UNIQUE, -- Token for restoring the item
  expires_at TIMESTAMPTZ NOT NULL, -- When the item should be permanently deleted
  is_restored BOOLEAN DEFAULT FALSE,
  restored_at TIMESTAMPTZ,
  restored_by TEXT,
  permanent_delete_at TIMESTAMPTZ -- When the item will be permanently deleted
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_recycle_bin_items_item_type ON recycle_bin_items(item_type);
CREATE INDEX IF NOT EXISTS idx_recycle_bin_items_deleted_at ON recycle_bin_items(deleted_at);
CREATE INDEX IF NOT EXISTS idx_recycle_bin_items_expires_at ON recycle_bin_items(expires_at);
CREATE INDEX IF NOT EXISTS idx_recycle_bin_items_restore_token ON recycle_bin_items(restore_token);

-- RLS policies for recycle_bin_items
ALTER TABLE recycle_bin_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow developers to view recycle bin" ON recycle_bin_items
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('Developer', 'Owner')));

CREATE POLICY "Allow authenticated users to create recycle bin items" ON recycle_bin_items
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow developers to update recycle bin items" ON recycle_bin_items
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('Developer', 'Owner')));

CREATE POLICY "Allow developers to delete recycle bin items" ON recycle_bin_items
  FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('Developer', 'Owner')));

-- Function to generate restore token
CREATE OR REPLACE FUNCTION generate_restore_token() RETURNS TEXT AS $$
DECLARE
  token TEXT;
BEGIN
  token := encode(gen_random_bytes(32), 'hex');
  RETURN token;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate expiration time (90 days)
CREATE OR REPLACE FUNCTION calculate_expiration_time() RETURNS TIMESTAMPTZ AS $$
BEGIN
  RETURN NOW() + interval '90 days';
END;
$$ LANGUAGE plpgsql;

-- Function to calculate permanent delete time (90 days from restore)
CREATE OR REPLACE FUNCTION calculate_permanent_delete_time() RETURNS TIMESTAMPTZ AS $$
BEGIN
  RETURN NOW() + interval '90 days';
END;
$$ LANGUAGE plpgsql;

-- Trigger function for before insert
CREATE OR REPLACE FUNCTION recycle_bin_items_before_insert()
RETURNS TRIGGER AS $$
BEGIN
  NEW.restore_token := generate_restore_token();
  NEW.expires_at := calculate_expiration_time();
  NEW.permanent_delete_at := calculate_permanent_delete_time();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for before insert
CREATE TRIGGER recycle_bin_items_before_insert_trigger
BEFORE INSERT ON recycle_bin_items
FOR EACH ROW
EXECUTE FUNCTION recycle_bin_items_before_insert();

-- Function to check if item should be permanently deleted
CREATE OR REPLACE FUNCTION recycle_bin_items_check_permanent_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_restored = FALSE AND NEW.expires_at <= NOW() THEN
    NEW.permanent_delete_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for before update
CREATE TRIGGER recycle_bin_items_check_permanent_delete_trigger
BEFORE UPDATE ON recycle_bin_items
FOR EACH ROW
EXECUTE FUNCTION recycle_bin_items_check_permanent_delete();

-- Function to handle permanent deletion
CREATE OR REPLACE FUNCTION recycle_bin_items_handle_permanent_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.permanent_delete_at <= NOW() AND NEW.is_restored = FALSE THEN
    DELETE FROM recycle_bin_items WHERE id = NEW.id;
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for after update
CREATE TRIGGER recycle_bin_items_handle_permanent_deletion_trigger
AFTER UPDATE ON recycle_bin_items
FOR EACH ROW
WHEN (OLD.permanent_delete_at IS DISTINCT FROM NEW.permanent_delete_at OR OLD.is_restored IS DISTINCT FROM NEW.is_restored)
EXECUTE FUNCTION recycle_bin_items_handle_permanent_deletion();