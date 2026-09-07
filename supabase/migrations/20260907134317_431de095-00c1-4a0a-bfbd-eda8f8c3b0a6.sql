-- 1) Backfill missing profiles: a location row whose account has no profile is
-- invisible on the radar because nearby_people joins profiles.
INSERT INTO public.profiles (id, username, display_name)
SELECT u.id,
       coalesce(
         nullif(lower(regexp_replace(coalesce(u.raw_user_meta_data->>'username',
                                              split_part(coalesce(u.email,''), '@', 1)), '[^a-zA-Z0-9_]', '', 'g')), ''),
         'user_' || substr(replace(u.id::text, '-', ''), 1, 8)
       ) || CASE WHEN EXISTS (
              SELECT 1 FROM public.profiles p2
              WHERE p2.username = coalesce(
                nullif(lower(regexp_replace(coalesce(u.raw_user_meta_data->>'username',
                                                     split_part(coalesce(u.email,''), '@', 1)), '[^a-zA-Z0-9_]', '', 'g')), ''),
                'user_' || substr(replace(u.id::text, '-', ''), 1, 8))
            ) THEN '_' || substr(replace(u.id::text, '-', ''), 1, 4) ELSE '' END,
       coalesce(u.raw_user_meta_data->>'display_name', u.raw_user_meta_data->>'username')
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

-- 2) Richer, privacy-safe diagnostic breakdown.
DROP FUNCTION IF EXISTS public.radar_self_check(double precision);

CREATE FUNCTION public.radar_self_check(radius_m double precision DEFAULT 1000)
RETURNS TABLE(
  my_location boolean,
  my_age_s double precision,
  my_visible boolean,
  my_profile boolean,
  others_total bigint,
  others_visible bigint,
  others_fresh bigint,
  fresh_no_profile bigint,
  fresh_banned bigint,
  fresh_blocked bigint,
  fresh_in_radius bigint,
  nearest_m double precision,
  eff_radius double precision,
  presence_timeout_min integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  me uuid := auth.uid();
  mylat double precision;
  mylng double precision;
  myacc double precision;
  mygeo extensions.geography;
  pmin integer;
  admin_max integer;
  free_max integer;
  pro_radius boolean;
  billing_on boolean;
  eff double precision;
BEGIN
  IF me IS NULL THEN RETURN; END IF;

  SELECT coalesce(a.presence_timeout_min, 5), coalesce(a.max_radius_m, 2000)
    INTO pmin, admin_max
  FROM public.app_settings a WHERE a.id = 'global';
  pmin := coalesce(pmin, 5);
  admin_max := coalesce(admin_max, 2000);

  SELECT b.free_max_radius_m, b.pro_extended_radius, b.enabled
    INTO free_max, pro_radius, billing_on
  FROM public.billing_settings b WHERE b.id = 'global';

  eff := least(greatest(coalesce(radius_m, 1000), 50), admin_max::double precision);
  IF coalesce(billing_on, false) AND coalesce(pro_radius, false)
     AND coalesce(free_max, 0) > 0 AND NOT private.is_pro(me) THEN
    eff := least(eff, free_max::double precision);
  END IF;

  SELECT l.lat, l.lng, l.accuracy_m INTO mylat, mylng, myacc
  FROM public.locations l WHERE l.user_id = me;

  IF mylat IS NOT NULL THEN
    mygeo := extensions.ST_SetSRID(extensions.ST_MakePoint(mylng, mylat), 4326)::extensions.geography;
  END IF;

  RETURN QUERY
  WITH fresh AS (
    SELECT l.user_id,
           CASE WHEN mygeo IS NULL THEN NULL ELSE extensions.ST_Distance(
             mygeo,
             extensions.ST_SetSRID(extensions.ST_MakePoint(l.lng, l.lat), 4326)::extensions.geography,
             true)::double precision END AS dist,
           l.accuracy_m
    FROM public.locations l
    WHERE l.user_id <> me AND l.is_visible
      AND l.updated_at > now() - (greatest(pmin * 6, 10) || ' minutes')::interval
  )
  SELECT
    mylat IS NOT NULL,
    (SELECT extract(epoch FROM (now() - l.updated_at))::double precision
       FROM public.locations l WHERE l.user_id = me),
    (SELECT l.is_visible FROM public.locations l WHERE l.user_id = me),
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = me),
    (SELECT count(*) FROM public.locations l WHERE l.user_id <> me),
    (SELECT count(*) FROM public.locations l WHERE l.user_id <> me AND l.is_visible),
    (SELECT count(*) FROM fresh),
    (SELECT count(*) FROM fresh f WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = f.user_id)),
    (SELECT count(*) FROM fresh f JOIN public.profiles p ON p.id = f.user_id WHERE p.banned),
    (SELECT count(*) FROM fresh f WHERE EXISTS (
        SELECT 1 FROM public.blocks b
        WHERE (b.blocker = me AND b.blocked = f.user_id) OR (b.blocker = f.user_id AND b.blocked = me))),
    (SELECT count(*) FROM fresh f
      WHERE f.dist IS NOT NULL
        AND f.dist <= eff + least(coalesce(myacc, 0), 100) + least(coalesce(f.accuracy_m, 0), 100)),
    (SELECT min(f.dist) FROM fresh f),
    eff,
    pmin;
END;
$function$;

REVOKE ALL ON FUNCTION public.radar_self_check(double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.radar_self_check(double precision) TO authenticated, service_role;