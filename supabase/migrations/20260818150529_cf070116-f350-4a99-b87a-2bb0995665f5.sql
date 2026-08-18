ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS radar_tones jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS radar_sound boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS radar_tone text;

DROP POLICY IF EXISTS "Members can view radar tones" ON storage.objects;
CREATE POLICY "Members can view radar tones" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'radar-tones');

DROP POLICY IF EXISTS "Staff manage radar tones" ON storage.objects;
CREATE POLICY "Staff manage radar tones" ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'radar-tones' AND public.is_staff(auth.uid()))
WITH CHECK (bucket_id = 'radar-tones' AND public.is_staff(auth.uid()));