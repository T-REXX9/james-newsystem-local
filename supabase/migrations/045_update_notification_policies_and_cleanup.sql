-- Align notification RLS with soft delete semantics and remove unused helper RPCs.

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
  ON public.notifications
  FOR SELECT
  USING (recipient_id = auth.uid() AND is_deleted = FALSE);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
  ON public.notifications
  FOR UPDATE
  USING (recipient_id = auth.uid() AND is_deleted = FALSE)
  WITH CHECK (recipient_id = auth.uid());

REVOKE UPDATE ON public.notifications FROM authenticated;
GRANT UPDATE (is_read, read_at, is_deleted, deleted_at) ON public.notifications TO authenticated;

DROP FUNCTION IF EXISTS public.mark_notification_as_read(UUID);
DROP FUNCTION IF EXISTS public.get_unread_count(UUID);
