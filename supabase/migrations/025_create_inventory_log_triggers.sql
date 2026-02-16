-- Create inventory log triggers for automatic inventory tracking
-- This migration creates 5 trigger functions for inventory logging

-- ============================================
-- TRIGGER FUNCTION 1: Purchase Order Delivery
-- ============================================
CREATE OR REPLACE FUNCTION trigger_po_delivery_inventory_log()
RETURNS TRIGGER AS $$
DECLARE
    po_item RECORD;
    warehouse_name TEXT;
BEGIN
    -- Only trigger when status changes to 'delivered' and was not 'delivered' before
    IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
        -- Get the warehouse name from the purchase order
        warehouse_name := NEW.warehouse_id;
        
        -- Iterate through all items in the purchase order
        FOR po_item IN 
            SELECT poi.item_id, poi.qty, p.name
            FROM purchase_order_items poi
            JOIN products p ON poi.item_id = p.id
            WHERE poi.po_id = NEW.id
        LOOP
            -- Insert inventory log for stock in
            INSERT INTO inventory_logs (
                transaction_id,
                transaction_type,
                transaction_date,
                item_id,
                item_name,
                warehouse_id,
                qty_in,
                qty_out,
                status_indicator,
                notes,
                created_at
            ) VALUES (
                NEW.id,
                'Purchase Order',
                NOW(),
                po_item.item_id,
                po_item.name,
                warehouse_name,
                po_item.qty,
                0,
                '+',
                'PO: ' || NEW.po_no || ' - Delivered',
                NOW()
            );
            
            -- Update product stock level based on warehouse name
            IF warehouse_name = 'WH1' THEN
                UPDATE products 
                SET stock_wh1 = stock_wh1 + po_item.qty,
                    updated_at = NOW()
                WHERE id = po_item.item_id;
            ELSIF warehouse_name = 'WH2' THEN
                UPDATE products 
                SET stock_wh2 = stock_wh2 + po_item.qty,
                    updated_at = NOW()
                WHERE id = po_item.item_id;
            ELSIF warehouse_name = 'WH3' THEN
                UPDATE products 
                SET stock_wh3 = stock_wh3 + po_item.qty,
                    updated_at = NOW()
                WHERE id = po_item.item_id;
            ELSIF warehouse_name = 'WH4' THEN
                UPDATE products 
                SET stock_wh4 = stock_wh4 + po_item.qty,
                    updated_at = NOW()
                WHERE id = po_item.item_id;
            ELSIF warehouse_name = 'WH5' THEN
                UPDATE products 
                SET stock_wh5 = stock_wh5 + po_item.qty,
                    updated_at = NOW()
                WHERE id = po_item.item_id;
            ELSIF warehouse_name = 'WH6' THEN
                UPDATE products 
                SET stock_wh6 = stock_wh6 + po_item.qty,
                    updated_at = NOW()
                WHERE id = po_item.item_id;
            END IF;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for purchase orders
DROP TRIGGER IF EXISTS trigger_po_delivery_inventory_log ON purchase_orders;
CREATE TRIGGER trigger_po_delivery_inventory_log
    AFTER UPDATE ON purchase_orders
    FOR EACH ROW
    EXECUTE FUNCTION trigger_po_delivery_inventory_log();


-- ============================================
-- TRIGGER FUNCTION 2: Sales Document (Invoice & Order Slip)
-- ============================================
CREATE OR REPLACE FUNCTION trigger_sales_document_inventory_log()
RETURNS TRIGGER AS $$
DECLARE
    item RECORD;
    warehouse_name TEXT;
    transaction_type_val TEXT;
    ref_no TEXT;
BEGIN
    -- Check if this is an invoice update
    IF TG_TABLE_NAME = 'invoices' THEN
        -- Only trigger when status changes to 'sent' or 'paid'
        IF (NEW.status = 'sent' OR NEW.status = 'paid') AND 
           (OLD.status != 'sent' AND OLD.status != 'paid') THEN
            transaction_type_val := 'Invoice';
            ref_no := COALESCE(NEW.invoice_no, CAST(NEW.id AS TEXT));
            warehouse_name := NEW.warehouse_id;
            
            -- Iterate through invoice items (assuming JSONB products field)
            FOR item IN 
                SELECT 
                    (item_data->>'id')::TEXT as item_id,
                    (item_data->>'qty')::DECIMAL as qty,
                    (item_data->>'name') as name
                FROM jsonb_array_elements(NEW.products) as item_data
            LOOP
                -- Insert inventory log for stock out
                INSERT INTO inventory_logs (
                    transaction_id,
                    transaction_type,
                    transaction_date,
                    item_id,
                    item_name,
                    warehouse_id,
                    qty_in,
                    qty_out,
                    status_indicator,
                    notes,
                    created_at
                ) VALUES (
                    NEW.id,
                    transaction_type_val,
                    NOW(),
                    item.item_id,
                    item.name,
                    warehouse_name,
                    0,
                    item.qty,
                    '-',
                    'Invoice: ' || ref_no || ' - ' || NEW.status,
                    NOW()
                );
                
                -- Update product stock level based on warehouse name
                IF warehouse_name = 'WH1' THEN
                    UPDATE products 
                    SET stock_wh1 = stock_wh1 - item.qty,
                        updated_at = NOW()
                    WHERE id = item.item_id;
                ELSIF warehouse_name = 'WH2' THEN
                    UPDATE products 
                    SET stock_wh2 = stock_wh2 - item.qty,
                        updated_at = NOW()
                    WHERE id = item.item_id;
                ELSIF warehouse_name = 'WH3' THEN
                    UPDATE products 
                    SET stock_wh3 = stock_wh3 - item.qty,
                        updated_at = NOW()
                    WHERE id = item.item_id;
                ELSIF warehouse_name = 'WH4' THEN
                    UPDATE products 
                    SET stock_wh4 = stock_wh4 - item.qty,
                        updated_at = NOW()
                    WHERE id = item.item_id;
                ELSIF warehouse_name = 'WH5' THEN
                    UPDATE products 
                    SET stock_wh5 = stock_wh5 - item.qty,
                        updated_at = NOW()
                    WHERE id = item.item_id;
                ELSIF warehouse_name = 'WH6' THEN
                    UPDATE products 
                    SET stock_wh6 = stock_wh6 - item.qty,
                        updated_at = NOW()
                    WHERE id = item.item_id;
                END IF;
            END LOOP;
        END IF;
    
    -- Check if this is an order slip update
    ELSIF TG_TABLE_NAME = 'order_slips' THEN
        -- Only trigger when status changes to 'finalized'
        IF NEW.status = 'finalized' AND OLD.status != 'finalized' THEN
            transaction_type_val := 'Order Slip';
            ref_no := COALESCE(NEW.slip_no, CAST(NEW.id AS TEXT));
            warehouse_name := NEW.warehouse_id;
            
            -- Iterate through order slip items (assuming JSONB products field)
            FOR item IN 
                SELECT 
                    (item_data->>'id')::TEXT as item_id,
                    (item_data->>'qty')::DECIMAL as qty,
                    (item_data->>'name') as name
                FROM jsonb_array_elements(NEW.products) as item_data
            LOOP
                -- Insert inventory log for stock out
                INSERT INTO inventory_logs (
                    transaction_id,
                    transaction_type,
                    transaction_date,
                    item_id,
                    item_name,
                    warehouse_id,
                    qty_in,
                    qty_out,
                    status_indicator,
                    notes,
                    created_at
                ) VALUES (
                    NEW.id,
                    transaction_type_val,
                    NOW(),
                    item.item_id,
                    item.name,
                    warehouse_name,
                    0,
                    item.qty,
                    '-',
                    'Order Slip: ' || ref_no || ' - Finalized',
                    NOW()
                );
                
                -- Update product stock level based on warehouse name
                IF warehouse_name = 'WH1' THEN
                    UPDATE products 
                    SET stock_wh1 = stock_wh1 - item.qty,
                        updated_at = NOW()
                    WHERE id = item.item_id;
                ELSIF warehouse_name = 'WH2' THEN
                    UPDATE products 
                    SET stock_wh2 = stock_wh2 - item.qty,
                        updated_at = NOW()
                    WHERE id = item.item_id;
                ELSIF warehouse_name = 'WH3' THEN
                    UPDATE products 
                    SET stock_wh3 = stock_wh3 - item.qty,
                        updated_at = NOW()
                    WHERE id = item.item_id;
                ELSIF warehouse_name = 'WH4' THEN
                    UPDATE products 
                    SET stock_wh4 = stock_wh4 - item.qty,
                        updated_at = NOW()
                    WHERE id = item.item_id;
                ELSIF warehouse_name = 'WH5' THEN
                    UPDATE products 
                    SET stock_wh5 = stock_wh5 - item.qty,
                        updated_at = NOW()
                    WHERE id = item.item_id;
                ELSIF warehouse_name = 'WH6' THEN
                    UPDATE products 
                    SET stock_wh6 = stock_wh6 - item.qty,
                        updated_at = NOW()
                    WHERE id = item.item_id;
                END IF;
            END LOOP;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for invoices
DROP TRIGGER IF EXISTS trigger_invoice_inventory_log ON invoices;
CREATE TRIGGER trigger_invoice_inventory_log
    AFTER UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION trigger_sales_document_inventory_log();

-- Create trigger for order slips
DROP TRIGGER IF EXISTS trigger_order_slip_inventory_log ON order_slips;
CREATE TRIGGER trigger_order_slip_inventory_log
    AFTER UPDATE ON order_slips
    FOR EACH ROW
    EXECUTE FUNCTION trigger_sales_document_inventory_log();


-- ============================================
-- TRIGGER FUNCTION 3: Stock Adjustment Finalization
-- ============================================
CREATE OR REPLACE FUNCTION trigger_stock_adjustment_inventory_log()
RETURNS TRIGGER AS $$
DECLARE
    adj_item RECORD;
    warehouse_name TEXT;
    qty_diff DECIMAL;
BEGIN
    -- Only trigger when status changes to 'finalized' and was not 'finalized' before
    IF NEW.status = 'finalized' AND OLD.status != 'finalized' THEN
        -- Get the warehouse name from the stock adjustment
        warehouse_name := NEW.warehouse_id;
        
        -- Iterate through all items in the stock adjustment
        FOR adj_item IN 
            SELECT sai.item_id, sai.difference, p.name
            FROM stock_adjustment_items sai
            JOIN products p ON sai.item_id = p.id
            WHERE sai.adjustment_id = NEW.id
              AND sai.difference != 0
        LOOP
            qty_diff := adj_item.difference;
            
            -- Determine if it's a stock in or stock out
            IF qty_diff > 0 THEN
                -- Stock In (physical count > system count)
                INSERT INTO inventory_logs (
                    transaction_id,
                    transaction_type,
                    transaction_date,
                    item_id,
                    item_name,
                    warehouse_id,
                    qty_in,
                    qty_out,
                    status_indicator,
                    notes,
                    created_at
                ) VALUES (
                    NEW.id,
                    'Stock Adjustment',
                    NOW(),
                    adj_item.item_id,
                    adj_item.name,
                    warehouse_name,
                    qty_diff,
                    0,
                    '+',
                    'Adjustment: ' || NEW.adjustment_no || ' - Type: ' || NEW.adjustment_type,
                    NOW()
                );
            ELSIF qty_diff < 0 THEN
                -- Stock Out (physical count < system count)
                INSERT INTO inventory_logs (
                    transaction_id,
                    transaction_type,
                    transaction_date,
                    item_id,
                    item_name,
                    warehouse_id,
                    qty_in,
                    qty_out,
                    status_indicator,
                    notes,
                    created_at
                ) VALUES (
                    NEW.id,
                    'Stock Adjustment',
                    NOW(),
                    adj_item.item_id,
                    adj_item.name,
                    warehouse_name,
                    0,
                    ABS(qty_diff),
                    '-',
                    'Adjustment: ' || NEW.adjustment_no || ' - Type: ' || NEW.adjustment_type,
                    NOW()
                );
            END IF;
            
            -- Update product stock level based on warehouse name
            IF warehouse_name = 'WH1' THEN
                UPDATE products 
                SET stock_wh1 = stock_wh1 + qty_diff,
                    updated_at = NOW()
                WHERE id = adj_item.item_id;
            ELSIF warehouse_name = 'WH2' THEN
                UPDATE products 
                SET stock_wh2 = stock_wh2 + qty_diff,
                    updated_at = NOW()
                WHERE id = adj_item.item_id;
            ELSIF warehouse_name = 'WH3' THEN
                UPDATE products 
                SET stock_wh3 = stock_wh3 + qty_diff,
                    updated_at = NOW()
                WHERE id = adj_item.item_id;
            ELSIF warehouse_name = 'WH4' THEN
                UPDATE products 
                SET stock_wh4 = stock_wh4 + qty_diff,
                    updated_at = NOW()
                WHERE id = adj_item.item_id;
            ELSIF warehouse_name = 'WH5' THEN
                UPDATE products 
                SET stock_wh5 = stock_wh5 + qty_diff,
                    updated_at = NOW()
                WHERE id = adj_item.item_id;
            ELSIF warehouse_name = 'WH6' THEN
                UPDATE products 
                SET stock_wh6 = stock_wh6 + qty_diff,
                    updated_at = NOW()
                WHERE id = adj_item.item_id;
            END IF;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for stock adjustments
DROP TRIGGER IF EXISTS trigger_stock_adjustment_inventory_log ON stock_adjustments;
CREATE TRIGGER trigger_stock_adjustment_inventory_log
    AFTER UPDATE ON stock_adjustments
    FOR EACH ROW
    EXECUTE FUNCTION trigger_stock_adjustment_inventory_log();


-- ============================================
-- TRIGGER FUNCTION 4: Sales Return Processing
-- ============================================
CREATE OR REPLACE FUNCTION trigger_sales_return_inventory_log()
RETURNS TRIGGER AS $$
DECLARE
    return_item RECORD;
    warehouse_name TEXT;
    return_no_val TEXT;
BEGIN
    -- Only trigger when status changes to 'processed' and was not 'processed' before
    IF NEW.status = 'processed' AND OLD.status != 'processed' THEN
        -- Get the warehouse name and return_no from the sales return
        warehouse_name := NEW.warehouse_id;
        return_no_val := COALESCE(NEW.return_no, CAST(NEW.id AS TEXT));
        
        -- Iterate through all items in sales return (assuming JSONB products field)
        FOR return_item IN 
            SELECT 
                (item_data->>'id')::TEXT as item_id,
                (item_data->>'qty')::DECIMAL as qty,
                (item_data->>'name') as name
            FROM jsonb_array_elements(NEW.products) as item_data
        LOOP
            -- Insert inventory log for stock in (returned items)
            INSERT INTO inventory_logs (
                transaction_id,
                transaction_type,
                transaction_date,
                item_id,
                item_name,
                warehouse_id,
                qty_in,
                qty_out,
                status_indicator,
                notes,
                created_at
            ) VALUES (
                NEW.id,
                'Credit Memo',
                NOW(),
                return_item.item_id,
                return_item.name,
                warehouse_name,
                return_item.qty,
                0,
                '+',
                'Return: ' || return_no_val || ' - Processed',
                NOW()
            );
            
            -- Update product stock level based on warehouse name
            IF warehouse_name = 'WH1' THEN
                UPDATE products 
                SET stock_wh1 = stock_wh1 + return_item.qty,
                    updated_at = NOW()
                WHERE id = return_item.item_id;
            ELSIF warehouse_name = 'WH2' THEN
                UPDATE products 
                SET stock_wh2 = stock_wh2 + return_item.qty,
                    updated_at = NOW()
                WHERE id = return_item.item_id;
            ELSIF warehouse_name = 'WH3' THEN
                UPDATE products 
                SET stock_wh3 = stock_wh3 + return_item.qty,
                    updated_at = NOW()
                WHERE id = return_item.item_id;
            ELSIF warehouse_name = 'WH4' THEN
                UPDATE products 
                SET stock_wh4 = stock_wh4 + return_item.qty,
                    updated_at = NOW()
                WHERE id = return_item.item_id;
            ELSIF warehouse_name = 'WH5' THEN
                UPDATE products 
                SET stock_wh5 = stock_wh5 + return_item.qty,
                    updated_at = NOW()
                WHERE id = return_item.item_id;
            ELSIF warehouse_name = 'WH6' THEN
                UPDATE products 
                SET stock_wh6 = stock_wh6 + return_item.qty,
                    updated_at = NOW()
                WHERE id = return_item.item_id;
            END IF;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for sales returns
DROP TRIGGER IF EXISTS trigger_sales_return_inventory_log ON sales_returns;
CREATE TRIGGER trigger_sales_return_inventory_log
    AFTER UPDATE ON sales_returns
    FOR EACH ROW
    EXECUTE FUNCTION trigger_sales_return_inventory_log();


-- ============================================
-- TRIGGER FUNCTION 5: Initial Stock on Product Creation
-- ============================================
CREATE OR REPLACE FUNCTION trigger_initial_stock_inventory_log()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if any warehouse has opening stock
    IF NEW.stock_wh1 > 0 THEN
        INSERT INTO inventory_logs (
            transaction_id,
            transaction_type,
            transaction_date,
            item_id,
            item_name,
            warehouse_id,
            qty_in,
            qty_out,
            status_indicator,
            notes,
            created_at
        ) VALUES (
            NEW.id,
            'Stock Adjustment',
            NOW(),
            NEW.id,
            NEW.name,
            'WH1',
            NEW.stock_wh1,
            0,
            '+',
            'Opening Stock - Warehouse 1',
            NOW()
        );
    END IF;
    
    IF NEW.stock_wh2 > 0 THEN
        INSERT INTO inventory_logs (
            transaction_id,
            transaction_type,
            transaction_date,
            item_id,
            item_name,
            warehouse_id,
            qty_in,
            qty_out,
            status_indicator,
            notes,
            created_at
        ) VALUES (
            NEW.id,
            'Stock Adjustment',
            NOW(),
            NEW.id,
            NEW.name,
            'WH2',
            NEW.stock_wh2,
            0,
            '+',
            'Opening Stock - Warehouse 2',
            NOW()
        );
    END IF;
    
    IF NEW.stock_wh3 > 0 THEN
        INSERT INTO inventory_logs (
            transaction_id,
            transaction_type,
            transaction_date,
            item_id,
            item_name,
            warehouse_id,
            qty_in,
            qty_out,
            status_indicator,
            notes,
            created_at
        ) VALUES (
            NEW.id,
            'Stock Adjustment',
            NOW(),
            NEW.id,
            NEW.name,
            'WH3',
            NEW.stock_wh3,
            0,
            '+',
            'Opening Stock - Warehouse 3',
            NOW()
        );
    END IF;
    
    IF NEW.stock_wh4 > 0 THEN
        INSERT INTO inventory_logs (
            transaction_id,
            transaction_type,
            transaction_date,
            item_id,
            item_name,
            warehouse_id,
            qty_in,
            qty_out,
            status_indicator,
            notes,
            created_at
        ) VALUES (
            NEW.id,
            'Stock Adjustment',
            NOW(),
            NEW.id,
            NEW.name,
            'WH4',
            NEW.stock_wh4,
            0,
            '+',
            'Opening Stock - Warehouse 4',
            NOW()
        );
    END IF;
    
    IF NEW.stock_wh5 > 0 THEN
        INSERT INTO inventory_logs (
            transaction_id,
            transaction_type,
            transaction_date,
            item_id,
            item_name,
            warehouse_id,
            qty_in,
            qty_out,
            status_indicator,
            notes,
            created_at
        ) VALUES (
            NEW.id,
            'Stock Adjustment',
            NOW(),
            NEW.id,
            NEW.name,
            'WH5',
            NEW.stock_wh5,
            0,
            '+',
            'Opening Stock - Warehouse 5',
            NOW()
        );
    END IF;
    
    IF NEW.stock_wh6 > 0 THEN
        INSERT INTO inventory_logs (
            transaction_id,
            transaction_type,
            transaction_date,
            item_id,
            item_name,
            warehouse_id,
            qty_in,
            qty_out,
            status_indicator,
            notes,
            created_at
        ) VALUES (
            NEW.id,
            'Stock Adjustment',
            NOW(),
            NEW.id,
            NEW.name,
            'WH6',
            NEW.stock_wh6,
            0,
            '+',
            'Opening Stock - Warehouse 6',
            NOW()
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for products
DROP TRIGGER IF EXISTS trigger_initial_stock_inventory_log ON products;
CREATE TRIGGER trigger_initial_stock_inventory_log
    AFTER INSERT ON products
    FOR EACH ROW
    EXECUTE FUNCTION trigger_initial_stock_inventory_log();

-- Add comments for documentation
COMMENT ON FUNCTION trigger_po_delivery_inventory_log() IS 'Logs inventory when purchase order status changes to delivered';
COMMENT ON FUNCTION trigger_sales_document_inventory_log() IS 'Logs inventory when invoice or order slip is finalized';
COMMENT ON FUNCTION trigger_stock_adjustment_inventory_log() IS 'Logs inventory when stock adjustment is finalized';
COMMENT ON FUNCTION trigger_sales_return_inventory_log() IS 'Logs inventory when sales return is processed';
COMMENT ON FUNCTION trigger_initial_stock_inventory_log() IS 'Logs initial opening stock when product is created';
