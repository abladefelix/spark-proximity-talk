ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS verified_badge_style text NOT NULL DEFAULT 'check',
  ADD COLUMN IF NOT EXISTS verified_badge_color text NOT NULL DEFAULT '#22c55e';

CREATE POLICY "matches_delete_involved" ON public.matches
  FOR DELETE TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);