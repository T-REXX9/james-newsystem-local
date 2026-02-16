-- Create stock_adjustments table
CREATE TABLE IF NOT EXISTS stock_adjustments (
    id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::TEXT,
    adjustment_no VARCHAR(50) UNIQUE NOT NULL,
    adjustment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    warehouse_id TEXT NOT NULL,
    adjustment_type VARCHAR(50) NOT NULL CHECK (adjustment_type IN ('physical_count', 'damage', 'correction')),
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized')),
    processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create stock_adjustment_items table
CREATE TABLE IF NOT EXISTS stock_adjustment_items (
    id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::TEXT,
    adjustment_id TEXT NOT NULL REFERENCES stock_adjustments(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    system_qty DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    physical_qty DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    difference DECIMAL(12, 2) GENERATED ALWAYS AS (physical_qty - system_qty) STORED,
    reason TEXT
);

-- Create indexes for stock_adjustments
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_warehouse_id ON stock_adjustments(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_status ON stock_adjustments(status);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_adjustment_date ON stock_adjustments(adjustment_date);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_adjustment_no ON stock_adjustments(adjustment_no);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_adjustment_type ON stock_adjustments(adjustment_type);

-- Create indexes for stock_adjustment_items
CREATE INDEX IF NOT EXISTS idx_stock_adjustment_items_adjustment_id ON stock_adjustment_items(adjustment_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustment_items_item_id ON stock_adjustment_items(item_id);

-- Enable RLS on stock_adjustments
ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;

-- RLS policies for stock_adjustments
CREATE POLICY "Authenticated users can view stock adjustments"
    ON stock_adjustments FOR SELECT
    TO authenticated;

CREATE POLICY "Authenticated users can insert stock adjustments"
    ON stock_adjustments FOR INSERT
    TO authenticated;

CREATE POLICY "Authenticated users can update stock adjustments"
    ON stock_adjustments FOR UPDATE
    TO authenticated;

-- Enable RLS on stock_adjustment_items
ALTER TABLE stock_adjustment_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for stock_adjustment_items
CREATE POLICY "Authenticated users can view stock adjustment items"
    ON stock_adjustment_items FOR SELECT
    TO authenticated;

CREATE POLICY "Authenticated users can insert stock adjustment items"
    ON stock_adjustment_items FOR INSERT
    TO authenticated;

CREATE POLICY "Authenticated users can update stock adjustment items"
    ON stock_adjustment_items FOR UPDATE
    TO authenticated;

CREATE POLICY "Authenticated users can delete stock adjustment items"
    ON stock_adjustment_items FOR DELETE
    TO authenticated;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_stock_adjustments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER trigger_update_stock_adjustments_updated_at
    BEFORE UPDATE ON stock_adjustments
    FOR EACH ROW
    EXECUTE FUNCTION update_stock_adjustments_updated_at();

-- Comment on tables
COMMENT ON TABLE stock_adjustments IS 'Stores stock adjustment records for physical counts, damages, and corrections';
COMMENT ON TABLE stock_adjustment_items IS 'Stores individual items in a stock adjustment with system and physical quantities';
