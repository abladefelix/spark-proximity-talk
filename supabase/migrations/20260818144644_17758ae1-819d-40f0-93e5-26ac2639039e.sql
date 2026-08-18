CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  audience text NOT NULL DEFAULT 'all',
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications (user_id, created_at DESC);
CREATE INDEX notifications_created_idx ON public.notifications (created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_select ON public.notifications FOR SELECT TO authenticated
  USING (audience = 'all' OR user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY notifications_insert_staff ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND created_by = auth.uid());
CREATE POLICY notifications_delete_staff ON public.notifications FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE TABLE public.notification_reads (
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.notification_reads TO authenticated;
GRANT ALL ON public.notification_reads TO service_role;
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY notification_reads_own ON public.notification_reads FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY notification_reads_insert_own ON public.notification_reads FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY notification_reads_delete_own ON public.notification_reads FOR DELETE TO authenticated
  USING (user_id = auth.uid());