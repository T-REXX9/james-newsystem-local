-- 036_create_inquiry_alert_system.sql
-- Migration to track products with multiple inquiries but no purchases

-- Create materialized view to identify products with 2+ inquiries and 0 purchases in last 30 days
CREATE MATERIALIZED VIEW IF NOT EXISTS public.product_inquiry_alerts AS
WITH recent_inquiries AS (
  -- Get all inquiry items from the last 30 days
  SELECT 
    sii.item_code,
    sii.part_no,
    sii.description,
    si.contact_id,
    si.sales_date,
    sii.unit_price,
    sii.amount
  FROM public.sales_inquiry_items sii
  INNER JOIN public.sales_inquiries si ON si.id = sii.inquiry_id
  WHERE 
    si.sales_date >= CURRENT_DATE - INTERVAL '30 days'
    AND sii.item_code IS NOT NULL
    AND sii.item_code != ''
    AND si.deleted_at IS NULL  -- Exclude soft-deleted inquiries
),
inquiry_stats AS (
  -- Aggregate inquiry statistics by item_code
  SELECT 
    item_code,
    MAX(part_no) as part_no,
    MAX(description) as description,
    COUNT(DISTINCT contact_id) as unique_customers,
    COUNT(*) as inquiry_count,
    MAX(sales_date) as last_inquiry_date,
    SUM(amount) as total_inquiry_value,
    AVG(unit_price) as avg_inquiry_price
  FROM recent_inquiries
  GROUP BY item_code
  HAVING COUNT(*) >= 2  -- Only items with 2+ inquiries
),
recent_purchases AS (
  -- Get all invoice items (actual purchases) from the last 30 days
  SELECT DISTINCT
    ii.item_code
  FROM public.invoice_items ii
  INNER JOIN public.invoices inv ON inv.id = ii.invoice_id
  WHERE 
    inv.sales_date >= CURRENT_DATE - INTERVAL '30 days'
    AND ii.item_code IS NOT NULL
    AND ii.item_code != ''
    AND inv.deleted_at IS NULL
)
-- Final result: inquiry stats for items that have NOT been purchased
SELECT 
  iq.item_code,
  iq.part_no,
  iq.description,
  iq.inquiry_count,
  iq.unique_customers,
  iq.last_inquiry_date,
  iq.total_inquiry_value,
  iq.avg_inquiry_price
FROM inquiry_stats iq
WHERE NOT EXISTS (
  SELECT 1 
  FROM recent_purchases rp 
  WHERE rp.item_code = iq.item_code
)
ORDER BY iq.inquiry_count DESC, iq.last_inquiry_date DESC;

-- Create index on the materialized view for faster queries
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_inquiry_alerts_item_code 
ON public.product_inquiry_alerts(item_code);

CREATE INDEX IF NOT EXISTS idx_product_inquiry_alerts_inquiry_count 
ON public.product_inquiry_alerts(inquiry_count DESC);

CREATE INDEX IF NOT EXISTS idx_product_inquiry_alerts_last_inquiry 
ON public.product_inquiry_alerts(last_inquiry_date DESC);

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION public.refresh_inquiry_alerts_materialized_view()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.product_inquiry_alerts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.refresh_inquiry_alerts_materialized_view() TO authenticated;

-- Function to check inquiry threshold and create notifications for owners
CREATE OR REPLACE FUNCTION public.check_inquiry_threshold_and_notify()
RETURNS TRIGGER AS $$
DECLARE
  v_inquiry_count INTEGER;
  v_has_purchases BOOLEAN;
  v_owner_profile RECORD;
  v_item_description TEXT;
  v_part_no TEXT;
  v_notification_exists BOOLEAN;
BEGIN
  -- Only process if item_code is present
  IF NEW.item_code IS NULL OR NEW.item_code = '' THEN
    RETURN NEW;
  END IF;

  -- Get item description and part_no
  SELECT description, part_no INTO v_item_description, v_part_no
  FROM public.sales_inquiry_items
  WHERE id = NEW.id;

  -- Count inquiries for this item_code in last 30 days
  SELECT COUNT(DISTINCT sii.id) INTO v_inquiry_count
  FROM public.sales_inquiry_items sii
  INNER JOIN public.sales_inquiries si ON si.id = sii.inquiry_id
  WHERE 
    sii.item_code = NEW.item_code
    AND si.sales_date >= CURRENT_DATE - INTERVAL '30 days'
    AND si.deleted_at IS NULL;

  -- Check if this item has been purchased in last 30 days
  SELECT EXISTS (
    SELECT 1
    FROM public.invoice_items ii
    INNER JOIN public.invoices inv ON inv.id = ii.invoice_id
    WHERE 
      ii.item_code = NEW.item_code
      AND inv.sales_date >= CURRENT_DATE - INTERVAL '30 days'
      AND inv.deleted_at IS NULL
  ) INTO v_has_purchases;

  -- If threshold met (2+ inquiries, 0 purchases), notify all owners
  IF v_inquiry_count >= 2 AND NOT v_has_purchases THEN
    -- Loop through all owner profiles
    FOR v_owner_profile IN 
      SELECT id, full_name 
      FROM public.profiles 
      WHERE role = 'Owner'
    LOOP
      -- Check if notification already exists for this item and owner (prevent duplicates)
      SELECT EXISTS (
        SELECT 1
        FROM public.notifications
        WHERE 
          recipient_id = v_owner_profile.id
          AND type = 'warning'
          AND metadata->>'item_code' = NEW.item_code
          AND metadata->>'alert_type' = 'inquiry_threshold'
          AND created_at >= CURRENT_DATE - INTERVAL '7 days'  -- Only check last 7 days to avoid spam
      ) INTO v_notification_exists;

      -- Create notification if it doesn't exist
      IF NOT v_notification_exists THEN
        INSERT INTO public.notifications (
          recipient_id,
          title,
          message,
          type,
          action_url,
          metadata,
          is_read
        ) VALUES (
          v_owner_profile.id,
          'Price Alert: High Inquiry, Low Conversion',
          format(
            '%s customers inquired about "%s" (%s) but none purchased. Consider price adjustment.',
            v_inquiry_count,
            COALESCE(v_item_description, 'Unknown Product'),
            COALESCE(v_part_no, NEW.item_code)
          ),
          'warning',
          '/dashboard',  -- Link to owner dashboard
          jsonb_build_object(
            'alert_type', 'inquiry_threshold',
            'item_code', NEW.item_code,
            'part_no', v_part_no,
            'description', v_item_description,
            'inquiry_count', v_inquiry_count,
            'triggered_at', NOW()
          ),
          FALSE
        );
      END IF;
    END LOOP;

    -- Refresh the materialized view to include this new alert
    PERFORM public.refresh_inquiry_alerts_materialized_view();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on sales_inquiry_items to check threshold after insert
DROP TRIGGER IF EXISTS trigger_check_inquiry_threshold ON public.sales_inquiry_items;
CREATE TRIGGER trigger_check_inquiry_threshold
  AFTER INSERT ON public.sales_inquiry_items
  FOR EACH ROW
  EXECUTE FUNCTION public.check_inquiry_threshold_and_notify();

-- Enable RLS on the materialized view (treated as a table for RLS purposes)
ALTER MATERIALIZED VIEW public.product_inquiry_alerts OWNER TO postgres;

-- Create policy to allow owners and managers to view inquiry alerts
-- Note: Materialized views don't support RLS directly, so we'll control access via the service layer
-- However, we can grant SELECT permissions appropriately
GRANT SELECT ON public.product_inquiry_alerts TO authenticated;

-- Initial refresh of the materialized view
REFRESH MATERIALIZED VIEW public.product_inquiry_alerts;

-- Optional: Create a pg_cron job to refresh the view periodically (every hour)
-- Uncomment if pg_cron extension is enabled
-- SELECT cron.schedule(
--   'refresh-inquiry-alerts',
--   '0 * * * *',  -- Every hour at minute 0
--   $$SELECT public.refresh_inquiry_alerts_materialized_view();$$
-- );
