-- Patch notification soft-delete RPC to populate required recycle bin fields.

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
    deleted_at,
    restore_token,
    expires_at
  )
  VALUES (
    'notification',
    p_notification_id::TEXT,
    to_jsonb(v_notification),
    v_actor_id::TEXT,
    NOW(),
    generate_restore_token(),
    NOW() + INTERVAL '30 days'
  );

  UPDATE public.notifications
  SET is_deleted = TRUE,
      deleted_at = NOW()
  WHERE id = p_notification_id;

  RETURN TRUE;
END;
$$;
