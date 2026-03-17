-- Remove invalid product expiry probes from inventory alert notifications.

CREATE OR REPLACE FUNCTION public.notify_inventory_threshold_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_stock INTEGER := COALESCE(NEW.stock_wh1, 0)
    + COALESCE(NEW.stock_wh2, 0)
    + COALESCE(NEW.stock_wh3, 0)
    + COALESCE(NEW.stock_wh4, 0)
    + COALESCE(NEW.stock_wh5, 0)
    + COALESCE(NEW.stock_wh6, 0);
  v_previous_total_stock INTEGER := COALESCE(OLD.stock_wh1, 0)
    + COALESCE(OLD.stock_wh2, 0)
    + COALESCE(OLD.stock_wh3, 0)
    + COALESCE(OLD.stock_wh4, 0)
    + COALESCE(OLD.stock_wh5, 0)
    + COALESCE(OLD.stock_wh6, 0);
  v_reorder_point INTEGER := GREATEST(COALESCE(NEW.reorder_quantity, 0), 0);
  v_alert_type TEXT := NULL;
  v_title TEXT := NULL;
  v_message TEXT := NULL;
  v_owner RECORD;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.is_deleted, FALSE) = TRUE THEN
    RETURN NEW;
  END IF;

  IF v_total_stock = 0 AND v_previous_total_stock <> 0 THEN
    v_alert_type := 'out_of_stock';
    v_title := 'Out of Stock Alert';
    v_message := format(
      '%s (%s) is out of stock.',
      COALESCE(NEW.description, NEW.item_code, NEW.part_no, 'Unknown Product'),
      COALESCE(NEW.part_no, NEW.item_code, NEW.id)
    );
  ELSIF v_reorder_point > 0 AND v_total_stock <= v_reorder_point AND (v_previous_total_stock > v_reorder_point OR v_previous_total_stock = 0) THEN
    v_alert_type := 'low_stock';
    v_title := 'Low Stock Alert';
    v_message := format(
      '%s (%s) is below the critical stock threshold. Remaining stock: %s.',
      COALESCE(NEW.description, NEW.item_code, NEW.part_no, 'Unknown Product'),
      COALESCE(NEW.part_no, NEW.item_code, NEW.id),
      v_total_stock
    );
  END IF;

  IF v_alert_type IS NULL THEN
    RETURN NEW;
  END IF;

  FOR v_owner IN
    SELECT id
    FROM public.profiles
    WHERE role = 'Owner'
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.notifications
      WHERE recipient_id = v_owner.id
        AND metadata->>'alert_type' = v_alert_type
        AND metadata->>'entity_id' = NEW.id::text
        AND created_at >= NOW() - INTERVAL '24 hours'
    ) THEN
      INSERT INTO public.notifications (
        recipient_id,
        title,
        message,
        type,
        action_url,
        metadata,
        is_read
      ) VALUES (
        v_owner.id,
        v_title,
        v_message,
        'warning',
        'warehouse-inventory-product-database',
        jsonb_build_object(
          'alert_type', v_alert_type,
          'entity_type', 'product',
          'entity_id', NEW.id,
          'action', v_alert_type,
          'status', v_alert_type,
          'action_url', 'warehouse-inventory-product-database',
          'part_no', NEW.part_no,
          'item_code', NEW.item_code,
          'description', NEW.description,
          'reorder_quantity', NEW.reorder_quantity,
          'total_stock', v_total_stock,
          'triggered_at', NOW()
        ),
        FALSE
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;
