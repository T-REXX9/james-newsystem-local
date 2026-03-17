-- Restrict notification updates to read-state fields and route soft delete through secured RPCs.

REVOKE UPDATE ON public.notifications FROM authenticated;
GRANT UPDATE (is_read, read_at) ON public.notifications TO authenticated;

CREATE OR REPLACE FUNCTION public.soft_delete_notification(p_notification_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_notification public.notifications%ROWTYPE;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT *
  INTO v_notification
  FROM public.notifications
  WHERE id = p_notification_id
    AND recipient_id = v_actor_id
    AND is_deleted = FALSE
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Notification not found or already deleted';
  END IF;

  INSERT INTO public.recycle_bin_items (
    item_type,
    item_id,
    original_data,
    deleted_by,
    deleted_at
  )
  VALUES (
    'notification',
    p_notification_id::TEXT,
    to_jsonb(v_notification),
    v_actor_id::TEXT,
    NOW()
  );

  UPDATE public.notifications
  SET is_deleted = TRUE,
      deleted_at = NOW()
  WHERE id = p_notification_id;

  RETURN TRUE;
END;
$$;

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

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_notification(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_notification_from_recycle_bin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_notification(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_notification_from_recycle_bin(UUID) TO authenticated;
