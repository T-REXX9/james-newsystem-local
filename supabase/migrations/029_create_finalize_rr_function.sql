CREATE OR REPLACE FUNCTION finalize_receiving_report(p_rr_id UUID)
RETURNS VOID AS $$
DECLARE
    v_rr RECORD;
    v_item RECORD;
    v_wh_col TEXT;
    v_query TEXT;
BEGIN
    -- Get RR details
    SELECT * INTO v_rr FROM receiving_reports WHERE id = p_rr_id;
    
    IF v_rr IS NULL THEN
        RAISE EXCEPTION 'Receiving Report not found';
    END IF;

    IF v_rr.status != 'Draft' THEN
        RAISE EXCEPTION 'Receiving Report is not in Draft status';
    END IF;

    -- Determine warehouse column
    IF v_rr.warehouse_id = 'WH1' THEN v_wh_col := 'stock_wh1';
    ELSIF v_rr.warehouse_id = 'WH2' THEN v_wh_col := 'stock_wh2';
    ELSIF v_rr.warehouse_id = 'WH3' THEN v_wh_col := 'stock_wh3';
    ELSIF v_rr.warehouse_id = 'WH4' THEN v_wh_col := 'stock_wh4';
    ELSIF v_rr.warehouse_id = 'WH5' THEN v_wh_col := 'stock_wh5';
    ELSIF v_rr.warehouse_id = 'WH6' THEN v_wh_col := 'stock_wh6';
    ELSE
        RAISE EXCEPTION 'Invalid Warehouse ID: %. Expected WH1-WH6.', v_rr.warehouse_id;
    END IF;

    -- Loop through items
    FOR v_item IN SELECT * FROM receiving_report_items WHERE rr_id = p_rr_id LOOP
        -- Update Product Stock
        v_query := format('UPDATE products SET %I = COALESCE(%I, 0) + %L WHERE id = %L', v_wh_col, v_wh_col, v_item.qty_received, v_item.item_id);
        EXECUTE v_query;

        -- Insert Inventory Log
        INSERT INTO inventory_logs (
            item_id,
            warehouse_id,
            date,
            transaction_type,
            reference_no,
            partner,
            qty_in,
            qty_out,
            status_indicator,
            unit_price,
            processed_by,
            notes
        ) VALUES (
            v_item.item_id,
            v_rr.warehouse_id,
            v_rr.receive_date,
            'Purchase Order', 
            v_rr.rr_no,
            v_rr.supplier_name,
            v_item.qty_received,
            0,
            '+',
            v_item.unit_cost,
            auth.uid(),
            v_rr.remarks
        );
    END LOOP;

    -- Update RR Status
    UPDATE receiving_reports SET status = 'Posted' WHERE id = p_rr_id;

END;
$$ LANGUAGE plpgsql;
