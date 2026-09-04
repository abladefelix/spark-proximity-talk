ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS inactivity_timeout_min integer NOT NULL DEFAULT 60;