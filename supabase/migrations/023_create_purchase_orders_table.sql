-- Create purchase_orders table
CREATE TABLE IF NOT EXISTS purchase_orders (
    id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::TEXT,
    po_no VARCHAR(50) UNIQUE NOT NULL,
    supplier_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    delivery_date DATE,
    warehouse_id TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ordered', 'delivered', 'cancelled')),
    grand_total DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create purchase_order_items table
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::TEXT,
    po_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    qty DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    unit_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    amount DECIMAL(15, 2) GENERATED ALWAYS AS (qty * unit_price) STORED,
    notes TEXT
);

-- Create indexes for purchase_orders
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_warehouse_id ON purchase_orders(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_order_date ON purchase_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_po_no ON purchase_orders(po_no);

-- Create indexes for purchase_order_items
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po_id ON purchase_order_items(po_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_item_id ON purchase_order_items(item_id);

-- Enable RLS on purchase_orders
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

-- RLS policies for purchase_orders
CREATE POLICY "Authenticated users can view purchase orders"
    ON purchase_orders FOR SELECT
    TO authenticated
    USING (NOT is_deleted);

CREATE POLICY "Authenticated users can insert purchase orders"
    ON purchase_orders FOR INSERT
    TO authenticated
    WITH CHECK (NOT is_deleted);

CREATE POLICY "Authenticated users can update purchase orders"
    ON purchase_orders FOR UPDATE
    TO authenticated
    USING (NOT is_deleted)
    WITH CHECK (NOT is_deleted);

CREATE POLICY "Authenticated users can delete purchase orders (soft delete)"
    ON purchase_orders FOR UPDATE
    TO authenticated
    USING (NOT is_deleted)
    WITH CHECK (is_deleted = TRUE);

-- Enable RLS on purchase_order_items
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for purchase_order_items
CREATE POLICY "Authenticated users can view purchase order items"
    ON purchase_order_items FOR SELECT
    TO authenticated;

CREATE POLICY "Authenticated users can insert purchase order items"
    ON purchase_order_items FOR INSERT
    TO authenticated;

CREATE POLICY "Authenticated users can update purchase order items"
    ON purchase_order_items FOR UPDATE
    TO authenticated;

CREATE POLICY "Authenticated users can delete purchase order items"
    ON purchase_order_items FOR DELETE
    TO authenticated;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_purchase_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER trigger_update_purchase_orders_updated_at
    BEFORE UPDATE ON purchase_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_purchase_orders_updated_at();

-- Comment on tables
COMMENT ON TABLE purchase_orders IS 'Stores purchase order information from suppliers';
COMMENT ON TABLE purchase_order_items IS 'Stores individual items in a purchase order';
