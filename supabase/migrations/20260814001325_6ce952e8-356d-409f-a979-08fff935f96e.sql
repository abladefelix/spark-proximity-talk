ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS app_name text NOT NULL DEFAULT 'SHATTA',
  ADD COLUMN IF NOT EXISTS logo_url text;

CREATE POLICY "branding_read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'branding');
CREATE POLICY "branding_admin_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "branding_admin_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin')) WITH CHECK (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "branding_admin_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'));