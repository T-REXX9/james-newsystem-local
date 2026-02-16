-- Create inventory_logs table
CREATE TABLE IF NOT EXISTS inventory_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  transaction_type TEXT NOT NULL CHECK (
    transaction_type IN ('Purchase Order', 'Invoice', 'Order Slip', 'Transfer Receipt', 'Credit Memo', 'Stock Adjustment')
  ),
  reference_no TEXT NOT NULL,
  partner TEXT NOT NULL,
  warehouse_id TEXT NOT NULL,
  qty_in INTEGER NOT NULL DEFAULT 0,
  qty_out INTEGER NOT NULL DEFAULT 0,
  status_indicator CHAR(1) NOT NULL CHECK (status_indicator IN ('+', '-')),
  unit_price NUMERIC NOT NULL DEFAULT 0,
  processed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT inventory_logs_qty_check CHECK (
    (qty_in > 0 AND qty_out = 0) OR (qty_out > 0 AND qty_in = 0)
  )
);

-- Create indexes
CREATE INDEX idx_inventory_logs_item_id ON inventory_logs(item_id);
CREATE INDEX idx_inventory_logs_warehouse_id ON inventory_logs(warehouse_id);
CREATE INDEX idx_inventory_logs_date ON inventory_logs(date);
CREATE INDEX idx_inventory_logs_transaction_type ON inventory_logs(transaction_type);
CREATE INDEX idx_inventory_logs_is_deleted ON inventory_logs(is_deleted);

-- Enable Row Level Security
ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- SELECT: All authenticated users can view non-deleted logs
CREATE POLICY "inventory_logs_select_policy"
  ON inventory_logs FOR SELECT
  TO authenticated
  USING (is_deleted = FALSE);

-- INSERT: Authenticated users can create logs
CREATE POLICY "inventory_logs_insert_policy"
  ON inventory_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- UPDATE: Authenticated users can update their own logs
CREATE POLICY "inventory_logs_update_policy"
  ON inventory_logs FOR UPDATE
  TO authenticated
  USING (processed_by = auth.uid())
  WITH CHECK (processed_by = auth.uid());

-- DELETE: Only Owner/Developer can soft delete
CREATE POLICY "inventory_logs_delete_policy"
  ON inventory_logs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND (role = 'Owner' OR role = 'Developer')
    )
  );
