ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS support_email text NOT NULL DEFAULT '';
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS min_age integer NOT NULL DEFAULT 18;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url, date_of_birth)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'username',''), 'shatta_' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name'),
    NEW.raw_user_meta_data->>'avatar_url',
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'date_of_birth','') ~ '^\d{4}-\d{2}-\d{2}$'
        THEN (NEW.raw_user_meta_data->>'date_of_birth')::date
      ELSE NULL
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;