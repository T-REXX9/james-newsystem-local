-- Atomic create RPCs for Receiving Reports and Return-to-Supplier transactions.
-- These functions ensure header + line inserts happen in a single DB transaction.

CREATE SEQUENCE IF NOT EXISTS receiving_report_no_seq START 1;
CREATE SEQUENCE IF NOT EXISTS supplier_return_no_seq START 1;

CREATE OR REPLACE FUNCTION generate_receiving_report_no()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_year TEXT;
    v_next BIGINT;
BEGIN
    v_year := to_char(CURRENT_DATE, 'YY');
    v_next := nextval('receiving_report_no_seq');
    RETURN 'RR-' || v_year || lpad(v_next::TEXT, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION generate_supplier_return_no()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_year TEXT;
    v_next BIGINT;
BEGIN
    v_year := to_char(CURRENT_DATE, 'YYYY');
    v_next := nextval('supplier_return_no_seq');
    RETURN 'RTS-' || v_year || '-' || lpad(v_next::TEXT, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION create_receiving_report_with_items(
    p_rr_no TEXT DEFAULT NULL,
    p_receive_date DATE DEFAULT NULL,
    p_supplier_id TEXT DEFAULT NULL,
    p_supplier_name TEXT DEFAULT NULL,
    p_po_no TEXT DEFAULT NULL,
    p_remarks TEXT DEFAULT NULL,
    p_warehouse_id TEXT DEFAULT NULL,
    p_status TEXT DEFAULT 'Draft',
    p_items JSONB DEFAULT '[]'::JSONB
)
RETURNS receiving_reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rr_no TEXT;
    v_grand_total NUMERIC := 0;
    v_report receiving_reports%ROWTYPE;
    v_item JSONB;
BEGIN
    IF p_receive_date IS NULL THEN
        RAISE EXCEPTION 'Receive date is required';
    END IF;

    IF p_supplier_id IS NULL OR btrim(p_supplier_id) = '' THEN
        RAISE EXCEPTION 'Supplier is required';
    END IF;

    IF p_warehouse_id IS NULL OR btrim(p_warehouse_id) = '' THEN
        RAISE EXCEPTION 'Warehouse is required';
    END IF;

    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'At least one receiving item is required';
    END IF;

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
    LOOP
        IF COALESCE(NULLIF(btrim(v_item->>'item_id'), ''), '') = '' THEN
            RAISE EXCEPTION 'Each receiving item must include item_id';
        END IF;
        IF COALESCE((v_item->>'qty_received')::NUMERIC, 0) <= 0 THEN
            RAISE EXCEPTION 'qty_received must be greater than 0';
        END IF;
    END LOOP;

    v_rr_no := NULLIF(btrim(COALESCE(p_rr_no, '')), '');
    IF v_rr_no IS NULL THEN
        v_rr_no := generate_receiving_report_no();
    END IF;

    SELECT COALESCE(
        SUM(
            COALESCE(
                (item->>'total_amount')::NUMERIC,
                COALESCE((item->>'qty_received')::NUMERIC, 0) * COALESCE((item->>'unit_cost')::NUMERIC, 0)
            )
        ),
        0
    )
    INTO v_grand_total
    FROM jsonb_array_elements(p_items) item;

    INSERT INTO receiving_reports (
        rr_no,
        receive_date,
        supplier_id,
        supplier_name,
        po_no,
        remarks,
        warehouse_id,
        grand_total,
        status,
        received_by
    )
    VALUES (
        v_rr_no,
        p_receive_date,
        p_supplier_id,
        p_supplier_name,
        p_po_no,
        p_remarks,
        p_warehouse_id,
        v_grand_total,
        COALESCE(NULLIF(p_status, ''), 'Draft'),
        auth.uid()
    )
    RETURNING * INTO v_report;

    INSERT INTO receiving_report_items (
        rr_id,
        item_id,
        item_code,
        part_no,
        description,
        qty_received,
        unit_cost,
        total_amount,
        qty_ordered,
        qty_returned
    )
    SELECT
        v_report.id,
        NULLIF(btrim(item->>'item_id'), ''),
        NULLIF(btrim(item->>'item_code'), ''),
        NULLIF(btrim(item->>'part_no'), ''),
        NULLIF(btrim(item->>'description'), ''),
        COALESCE((item->>'qty_received')::NUMERIC, 0),
        COALESCE((item->>'unit_cost')::NUMERIC, 0),
        COALESCE(
            (item->>'total_amount')::NUMERIC,
            COALESCE((item->>'qty_received')::NUMERIC, 0) * COALESCE((item->>'unit_cost')::NUMERIC, 0)
        ),
        COALESCE((item->>'qty_ordered')::NUMERIC, 0),
        COALESCE((item->>'qty_returned')::NUMERIC, 0)
    FROM jsonb_array_elements(p_items) item;

    RETURN v_report;
END;
$$;

CREATE OR REPLACE FUNCTION create_supplier_return_with_items(
    p_return_date DATE DEFAULT NULL,
    p_return_type TEXT DEFAULT 'purchase',
    p_rr_id TEXT DEFAULT NULL,
    p_rr_no TEXT DEFAULT NULL,
    p_supplier_id TEXT DEFAULT NULL,
    p_supplier_name TEXT DEFAULT NULL,
    p_po_no TEXT DEFAULT NULL,
    p_remarks TEXT DEFAULT NULL,
    p_created_by UUID DEFAULT auth.uid(),
    p_items JSONB DEFAULT '[]'::JSONB
)
RETURNS supplier_returns
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_return supplier_returns%ROWTYPE;
    v_return_no TEXT;
    v_grand_total NUMERIC := 0;
    v_item JSONB;
    v_req RECORD;
    v_qty_received NUMERIC := 0;
    v_qty_already_returned NUMERIC := 0;
    v_remaining NUMERIC := 0;
BEGIN
    IF p_return_date IS NULL THEN
        RAISE EXCEPTION 'Return date is required';
    END IF;

    IF p_supplier_id IS NULL OR btrim(p_supplier_id) = '' THEN
        RAISE EXCEPTION 'Supplier is required';
    END IF;

    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'At least one return item is required';
    END IF;

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
    LOOP
        IF COALESCE((v_item->>'qty_returned')::NUMERIC, 0) <= 0 THEN
            RAISE EXCEPTION 'qty_returned must be greater than 0';
        END IF;
        IF COALESCE(NULLIF(btrim(v_item->>'rr_item_id'), ''), '') = '' THEN
            RAISE EXCEPTION 'rr_item_id is required for return validation';
        END IF;
    END LOOP;

    -- Validate quantity guard against remaining returnable amounts.
    FOR v_req IN
        SELECT
            NULLIF(btrim(item->>'rr_item_id'), '') AS rr_item_id,
            SUM(COALESCE((item->>'qty_returned')::NUMERIC, 0)) AS qty_returned
        FROM jsonb_array_elements(p_items) item
        GROUP BY NULLIF(btrim(item->>'rr_item_id'), '')
    LOOP
        IF v_req.rr_item_id IS NULL THEN
            RAISE EXCEPTION 'rr_item_id is required for all return items';
        END IF;

        SELECT COALESCE(rri.qty_received, 0)
        INTO v_qty_received
        FROM receiving_report_items rri
        WHERE rri.id::TEXT = v_req.rr_item_id
          AND (p_rr_id IS NULL OR p_rr_id = '' OR rri.rr_id::TEXT = p_rr_id)
        LIMIT 1;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Receiving report item % was not found for this return', v_req.rr_item_id;
        END IF;

        SELECT COALESCE(SUM(sri.qty_returned), 0)
        INTO v_qty_already_returned
        FROM supplier_return_items sri
        JOIN supplier_returns sr ON sr.id = sri.return_id
        WHERE sri.rr_item_id::TEXT = v_req.rr_item_id
          AND COALESCE(sr.is_deleted, FALSE) = FALSE
          AND COALESCE(sr.status, 'Pending') <> 'Cancelled';

        v_remaining := v_qty_received - v_qty_already_returned;
        IF v_req.qty_returned > v_remaining THEN
            RAISE EXCEPTION 'Return quantity exceeds available amount for item %. Requested: %, Available: %',
                v_req.rr_item_id,
                v_req.qty_returned,
                v_remaining;
        END IF;
    END LOOP;

    v_return_no := generate_supplier_return_no();

    SELECT COALESCE(
        SUM(
            COALESCE(
                (item->>'total_amount')::NUMERIC,
                COALESCE((item->>'qty_returned')::NUMERIC, 0) * COALESCE((item->>'unit_cost')::NUMERIC, 0)
            )
        ),
        0
    )
    INTO v_grand_total
    FROM jsonb_array_elements(p_items) item;

    INSERT INTO supplier_returns (
        return_no,
        reference_no,
        return_date,
        return_type,
        rr_id,
        rr_no,
        supplier_id,
        supplier_name,
        po_no,
        status,
        remarks,
        grand_total,
        created_by
    )
    VALUES (
        v_return_no,
        v_return_no,
        p_return_date,
        COALESCE(NULLIF(p_return_type, ''), 'purchase'),
        NULLIF(p_rr_id, ''),
        NULLIF(p_rr_no, ''),
        p_supplier_id,
        p_supplier_name,
        NULLIF(p_po_no, ''),
        'Pending',
        NULLIF(p_remarks, ''),
        v_grand_total,
        COALESCE(p_created_by, auth.uid())
    )
    RETURNING * INTO v_return;

    INSERT INTO supplier_return_items (
        return_id,
        rr_item_id,
        item_id,
        item_code,
        part_no,
        description,
        qty_returned,
        unit_cost,
        total_amount,
        return_reason,
        remarks
    )
    SELECT
        v_return.id,
        NULLIF(btrim(item->>'rr_item_id'), ''),
        NULLIF(btrim(item->>'item_id'), ''),
        NULLIF(btrim(item->>'item_code'), ''),
        NULLIF(btrim(item->>'part_no'), ''),
        NULLIF(btrim(item->>'description'), ''),
        COALESCE((item->>'qty_returned')::NUMERIC, 0),
        COALESCE((item->>'unit_cost')::NUMERIC, 0),
        COALESCE(
            (item->>'total_amount')::NUMERIC,
            COALESCE((item->>'qty_returned')::NUMERIC, 0) * COALESCE((item->>'unit_cost')::NUMERIC, 0)
        ),
        NULLIF(btrim(item->>'return_reason'), ''),
        NULLIF(btrim(item->>'remarks'), '')
    FROM jsonb_array_elements(p_items) item;

    RETURN v_return;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_receiving_report_no() TO authenticated;
GRANT EXECUTE ON FUNCTION generate_supplier_return_no() TO authenticated;
GRANT EXECUTE ON FUNCTION create_receiving_report_with_items(TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION create_supplier_return_with_items(DATE, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, JSONB) TO authenticated;
