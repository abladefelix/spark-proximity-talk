ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS chat_backgrounds jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS chat_background text;

DROP POLICY IF EXISTS "Members can view chat backgrounds" ON storage.objects;
CREATE POLICY "Members can view chat backgrounds" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'chat-backgrounds');

DROP POLICY IF EXISTS "Staff manage chat backgrounds" ON storage.objects;
CREATE POLICY "Staff manage chat backgrounds" ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'chat-backgrounds' AND public.is_staff(auth.uid()))
WITH CHECK (bucket_id = 'chat-backgrounds' AND public.is_staff(auth.uid()));