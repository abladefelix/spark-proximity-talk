CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  base_name text;
BEGIN
  base_name := lower(regexp_replace(
    coalesce(nullif(NEW.raw_user_meta_data->>'username',''), 'shatta_' || substr(NEW.id::text, 1, 8)),
    '\s+', '_', 'g'));
  IF length(base_name) < 3 THEN
    base_name := 'shatta_' || substr(NEW.id::text, 1, 8);
  END IF;

  -- Never silently rename: a taken username fails the sign-up with a clear,
  -- mappable code so the app can tell the person to pick another name.
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE lower(p.username) = base_name) THEN
    RAISE EXCEPTION 'username_already_taken' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.profiles (id, username, display_name, avatar_url, date_of_birth, gender)
  VALUES (
    NEW.id,
    base_name,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name'),
    NEW.raw_user_meta_data->>'avatar_url',
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'date_of_birth','') ~ '^\d{4}-\d{2}-\d{2}$'
        THEN (NEW.raw_user_meta_data->>'date_of_birth')::date
      ELSE NULL
    END,
    CASE
      WHEN NEW.raw_user_meta_data->>'gender' IN ('male','female','other')
        THEN NEW.raw_user_meta_data->>'gender'
      ELSE NULL
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;