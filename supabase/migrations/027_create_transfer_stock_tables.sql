-- Create branch_inventory_transfers table (replaces tblbranchinventory_transferlist)
CREATE TABLE IF NOT EXISTS branch_inventory_transfers (
    id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::TEXT,
    transfer_no VARCHAR(50) UNIQUE NOT NULL,
    transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'approved', 'deleted')),
    notes TEXT,
    processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create branch_inventory_transfer_items table (replaces tblbranchinventory_transferproducts)
CREATE TABLE IF NOT EXISTS branch_inventory_transfer_items (
    id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::TEXT,
    transfer_id TEXT NOT NULL REFERENCES branch_inventory_transfers(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    from_warehouse_id TEXT NOT NULL,
    to_warehouse_id TEXT NOT NULL,
    transfer_qty DECIMAL(12, 2) NOT NULL CHECK (transfer_qty > 0),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT different_warehouses CHECK (from_warehouse_id != to_warehouse_id)
);

-- Create indexes for branch_inventory_transfers
CREATE INDEX IF NOT EXISTS idx_branch_inventory_transfers_transfer_no ON branch_inventory_transfers(transfer_no);
CREATE INDEX IF NOT EXISTS idx_branch_inventory_transfers_status ON branch_inventory_transfers(status);
CREATE INDEX IF NOT EXISTS idx_branch_inventory_transfers_transfer_date ON branch_inventory_transfers(transfer_date);
CREATE INDEX IF NOT EXISTS idx_branch_inventory_transfers_is_deleted ON branch_inventory_transfers(is_deleted);
CREATE INDEX IF NOT EXISTS idx_branch_inventory_transfers_processed_by ON branch_inventory_transfers(processed_by);

-- Create indexes for branch_inventory_transfer_items
CREATE INDEX IF NOT EXISTS idx_branch_inventory_transfer_items_transfer_id ON branch_inventory_transfer_items(transfer_id);
CREATE INDEX IF NOT EXISTS idx_branch_inventory_transfer_items_item_id ON branch_inventory_transfer_items(item_id);
CREATE INDEX IF NOT EXISTS idx_branch_inventory_transfer_items_from_warehouse ON branch_inventory_transfer_items(from_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_branch_inventory_transfer_items_to_warehouse ON branch_inventory_transfer_items(to_warehouse_id);

-- Enable RLS on branch_inventory_transfers
ALTER TABLE branch_inventory_transfers ENABLE ROW LEVEL SECURITY;

-- RLS policies for branch_inventory_transfers
CREATE POLICY "Authenticated users can view non-deleted transfers"
    ON branch_inventory_transfers FOR SELECT
    TO authenticated
    USING (is_deleted = FALSE);

CREATE POLICY "Authenticated users can insert transfers"
    ON branch_inventory_transfers FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update transfers"
    ON branch_inventory_transfers FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users can delete transfers"
    ON branch_inventory_transfers FOR DELETE
    TO authenticated
    USING (true);

-- Enable RLS on branch_inventory_transfer_items
ALTER TABLE branch_inventory_transfer_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for branch_inventory_transfer_items
CREATE POLICY "Authenticated users can view transfer items"
    ON branch_inventory_transfer_items FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert transfer items"
    ON branch_inventory_transfer_items FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update transfer items"
    ON branch_inventory_transfer_items FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users can delete transfer items"
    ON branch_inventory_transfer_items FOR DELETE
    TO authenticated
    USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_branch_inventory_transfers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER trigger_update_branch_inventory_transfers_updated_at
    BEFORE UPDATE ON branch_inventory_transfers
    FOR EACH ROW
    EXECUTE FUNCTION update_branch_inventory_transfers_updated_at();

-- Function to generate next transfer number
CREATE OR REPLACE FUNCTION generate_transfer_no()
RETURNS TEXT AS $$
DECLARE
    next_num INTEGER;
    new_transfer_no TEXT;
BEGIN
    -- Get the highest transfer number and increment
    SELECT COALESCE(MAX(CAST(SUBSTRING(transfer_no FROM 4) AS INTEGER)), 0) + 1
    INTO next_num
    FROM branch_inventory_transfers
    WHERE transfer_no ~ '^TR-[0-9]+$';
    
    -- Format as TR-XXX
    new_transfer_no := 'TR-' || next_num;
    
    RETURN new_transfer_no;
END;
$$ LANGUAGE plpgsql;

-- Function to validate stock availability before approval
CREATE OR REPLACE FUNCTION validate_transfer_stock_availability()
RETURNS TRIGGER AS $$
DECLARE
    item_record RECORD;
    available_stock DECIMAL(12, 2);
    warehouse_stock_column TEXT;
BEGIN
    -- Only validate when status changes to 'approved'
    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
        -- Check stock availability for each item in the transfer
        FOR item_record IN 
            SELECT 
                bti.item_id,
                bti.from_warehouse_id,
                bti.transfer_qty,
                p.part_number,
                bti.to_warehouse_id
            FROM branch_inventory_transfer_items bti
            JOIN products p ON p.id = bti.item_id
            WHERE bti.transfer_id = NEW.id
        LOOP
            -- Determine which warehouse stock column to check
            warehouse_stock_column := 'stock_wh' || item_record.from_warehouse_id;
            
            -- Get current stock from products table
            EXECUTE format('SELECT %I FROM products WHERE id = $1', warehouse_stock_column)
            INTO available_stock
            USING item_record.item_id;
            
            -- Validate stock availability
            IF available_stock IS NULL OR available_stock < item_record.transfer_qty THEN
                RAISE EXCEPTION 'Insufficient stock for item % in warehouse %. Available: %, Required: %',
                    item_record.part_number,
                    item_record.from_warehouse_id,
                    COALESCE(available_stock, 0),
                    item_record.transfer_qty;
            END IF;
        END LOOP;
        
        -- Set approval metadata
        NEW.approved_by := auth.uid();
        NEW.approved_at := NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate stock before approval
CREATE TRIGGER trigger_validate_transfer_stock_availability
    BEFORE UPDATE ON branch_inventory_transfers
    FOR EACH ROW
    EXECUTE FUNCTION validate_transfer_stock_availability();

-- Function to create inventory logs when transfer is approved
CREATE OR REPLACE FUNCTION create_inventory_logs_from_transfer()
RETURNS TRIGGER AS $$
DECLARE
    item_record RECORD;
    from_warehouse_column TEXT;
    to_warehouse_column TEXT;
BEGIN
    -- Only create logs when status changes to 'approved'
    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
        -- Create inventory logs for each item
        FOR item_record IN 
            SELECT 
                bti.item_id,
                bti.from_warehouse_id,
                bti.to_warehouse_id,
                bti.transfer_qty,
                p.part_number
            FROM branch_inventory_transfer_items bti
            JOIN products p ON p.id = bti.item_id
            WHERE bti.transfer_id = NEW.id
        LOOP
            -- Create Stock Out log (from source warehouse)
            INSERT INTO inventory_logs (
                item_id,
                date,
                transaction_type,
                reference_no,
                partner,
                warehouse_id,
                qty_in,
                qty_out,
                status_indicator,
                unit_price,
                processed_by,
                notes
            ) VALUES (
                item_record.item_id,
                NEW.transfer_date,
                'Transfer Product',
                NEW.transfer_no,
                'Internal Transfer',
                item_record.from_warehouse_id,
                0,
                item_record.transfer_qty,
                '-',
                0,
                NEW.processed_by,
                'Stock out from WH' || item_record.from_warehouse_id || ' to WH' || item_record.to_warehouse_id
            );
            
            -- Create Stock In log (to destination warehouse)
            INSERT INTO inventory_logs (
                item_id,
                date,
                transaction_type,
                reference_no,
                partner,
                warehouse_id,
                qty_in,
                qty_out,
                status_indicator,
                unit_price,
                processed_by,
                notes
            ) VALUES (
                item_record.item_id,
                NEW.transfer_date,
                'Transfer Product',
                NEW.transfer_no,
                'Internal Transfer',
                item_record.to_warehouse_id,
                item_record.transfer_qty,
                0,
                '+',
                0,
                NEW.processed_by,
                'Stock in from WH' || item_record.from_warehouse_id || ' to WH' || item_record.to_warehouse_id
            );
            
            -- Update product stock levels
            from_warehouse_column := 'stock_wh' || item_record.from_warehouse_id;
            to_warehouse_column := 'stock_wh' || item_record.to_warehouse_id;
            
            -- Decrement from source warehouse
            EXECUTE format('UPDATE products SET %I = %I - $1 WHERE id = $2', 
                from_warehouse_column, from_warehouse_column)
            USING item_record.transfer_qty, item_record.item_id;
            
            -- Increment to destination warehouse
            EXECUTE format('UPDATE products SET %I = COALESCE(%I, 0) + $1 WHERE id = $2', 
                to_warehouse_column, to_warehouse_column)
            USING item_record.transfer_qty, item_record.item_id;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create inventory logs on approval
CREATE TRIGGER trigger_create_inventory_logs_from_transfer
    AFTER UPDATE ON branch_inventory_transfers
    FOR EACH ROW
    EXECUTE FUNCTION create_inventory_logs_from_transfer();

-- Comments
COMMENT ON TABLE branch_inventory_transfers IS 'Stores transfer requests for moving stock between warehouses';
COMMENT ON TABLE branch_inventory_transfer_items IS 'Stores individual items in a transfer request with source/destination warehouses';
COMMENT ON FUNCTION generate_transfer_no() IS 'Auto-generates the next transfer number in format TR-XXX';
COMMENT ON FUNCTION validate_transfer_stock_availability() IS 'Validates stock availability before approving transfer';
COMMENT ON FUNCTION create_inventory_logs_from_transfer() IS 'Creates dual inventory logs (stock out + stock in) when transfer is approved';
