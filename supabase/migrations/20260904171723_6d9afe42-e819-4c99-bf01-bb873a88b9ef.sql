CREATE OR REPLACE FUNCTION public.username_available(_username text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select length(coalesce(trim(_username), '')) >= 3
     and not exists (
       select 1 from public.profiles p
       where lower(p.username) = lower(trim(_username))
     )
$$;

REVOKE ALL ON FUNCTION public.username_available(text) FROM public;
GRANT EXECUTE ON FUNCTION public.username_available(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  base_name text;
  final_name text;
  n integer := 0;
BEGIN
  base_name := lower(regexp_replace(
    coalesce(nullif(NEW.raw_user_meta_data->>'username',''), 'shatta_' || substr(NEW.id::text, 1, 8)),
    '\s+', '_', 'g'));
  IF length(base_name) < 3 THEN
    base_name := 'shatta_' || substr(NEW.id::text, 1, 8);
  END IF;
  final_name := base_name;
  WHILE EXISTS (SELECT 1 FROM public.profiles p WHERE lower(p.username) = final_name) LOOP
    n := n + 1;
    final_name := base_name || n::text;
    IF n > 50 THEN
      final_name := base_name || '_' || substr(NEW.id::text, 1, 6);
      EXIT;
    END IF;
  END LOOP;

  INSERT INTO public.profiles (id, username, display_name, avatar_url, date_of_birth, gender)
  VALUES (
    NEW.id,
    final_name,
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