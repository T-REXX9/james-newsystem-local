-- Add an explicit notification category so the new UI can preserve the old
-- split between regular notifications and alerts.

ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS category TEXT;

UPDATE public.notifications
SET category = CASE
  WHEN COALESCE(metadata->>'category', '') IN ('notification', 'alert') THEN metadata->>'category'
  WHEN COALESCE(metadata->>'alert_type', '') <> '' THEN 'alert'
  ELSE 'notification'
END
WHERE category IS NULL;

ALTER TABLE public.notifications
ALTER COLUMN category SET DEFAULT 'notification';

UPDATE public.notifications
SET category = 'notification'
WHERE category IS NULL;

ALTER TABLE public.notifications
ALTER COLUMN category SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notifications_category_check'
      AND conrelid = 'public.notifications'::regclass
  ) THEN
    ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_category_check
    CHECK (category IN ('notification', 'alert'));
  END IF;
END $$;

UPDATE public.notifications
SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('category', category);

CREATE OR REPLACE FUNCTION public.sync_notification_category_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_category TEXT;
BEGIN
  v_category := LOWER(COALESCE(
    NEW.category,
    NEW.metadata->>'category',
    CASE
      WHEN COALESCE(NEW.metadata->>'alert_type', '') <> '' THEN 'alert'
      ELSE 'notification'
    END
  ));

  IF v_category NOT IN ('notification', 'alert') THEN
    v_category := CASE
      WHEN COALESCE(NEW.metadata->>'alert_type', '') <> '' THEN 'alert'
      ELSE 'notification'
    END;
  END IF;

  NEW.category := v_category;
  NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb) || jsonb_build_object('category', v_category);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_notification_category_metadata ON public.notifications;
CREATE TRIGGER trigger_sync_notification_category_metadata
BEFORE INSERT OR UPDATE OF category, metadata
ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.sync_notification_category_metadata();

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_category_created
ON public.notifications(recipient_id, category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_category_unread
ON public.notifications(recipient_id, category, is_read);
