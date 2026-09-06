ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS web_app_enabled boolean NOT NULL DEFAULT false;

GRANT SELECT ON public.app_settings TO anon;
GRANT SELECT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

DROP POLICY IF EXISTS app_settings_update_admin ON public.app_settings;
CREATE POLICY app_settings_update_admin
  ON public.app_settings
  FOR UPDATE
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));