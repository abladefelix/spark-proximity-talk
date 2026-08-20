ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS beacon_style text NOT NULL DEFAULT 'default';

COMMENT ON COLUMN public.profiles.beacon_style IS 'Member-selected radar beacon appearance; premium display remains enforced by nearby_people.';