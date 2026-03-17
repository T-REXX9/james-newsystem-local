-- Mark recycle bin notification entries as restored when the notification is restored.

CREATE OR REPLACE FUNCTION public.restore_notification_from_recycle_bin(p_notification_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = v_actor_id
      AND role IN ('Owner', 'Developer')
  ) THEN
    RAISE EXCEPTION 'Only Owner or Developer can restore notifications';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.recycle_bin_items
    WHERE item_id = p_notification_id::TEXT
      AND item_type = 'notification'
      AND is_restored = FALSE
  ) THEN
    RAISE EXCEPTION 'Notification is not available in recycle bin';
  END IF;

  UPDATE public.notifications
  SET is_deleted = FALSE,
      deleted_at = NULL
  WHERE id = p_notification_id
    AND is_deleted = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Notification not found or already restored';
  END IF;

  UPDATE public.recycle_bin_items
  SET is_restored = TRUE,
      restored_at = NOW(),
      restored_by = v_actor_id::TEXT
  WHERE item_id = p_notification_id::TEXT
    AND item_type = 'notification'
    AND is_restored = FALSE;

  RETURN TRUE;
END;
$$;
