CREATE OR REPLACE FUNCTION public.radar_self_check(radius_m double precision DEFAULT 1000)
RETURNS TABLE(
  my_location boolean,
  my_age_s double precision,
  my_visible boolean,
  others_total bigint,
  others_visible bigint,
  others_fresh bigint,
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

  SELECT l.lat, l.lng INTO mylat, mylng
  FROM public.locations l WHERE l.user_id = me;

  IF mylat IS NOT NULL THEN
    mygeo := extensions.ST_SetSRID(extensions.ST_MakePoint(mylng, mylat), 4326)::extensions.geography;
  END IF;

  RETURN QUERY
  SELECT
    mylat IS NOT NULL,
    (SELECT extract(epoch FROM (now() - l.updated_at))::double precision
       FROM public.locations l WHERE l.user_id = me),
    (SELECT l.is_visible FROM public.locations l WHERE l.user_id = me),
    (SELECT count(*) FROM public.locations l WHERE l.user_id <> me),
    (SELECT count(*) FROM public.locations l WHERE l.user_id <> me AND l.is_visible),
    (SELECT count(*) FROM public.locations l
      WHERE l.user_id <> me AND l.is_visible
        AND l.updated_at > now() - (greatest(pmin * 6, 10) || ' minutes')::interval),
    (SELECT min(extensions.ST_Distance(
        mygeo,
        extensions.ST_SetSRID(extensions.ST_MakePoint(l.lng, l.lat), 4326)::extensions.geography,
        true)::double precision)
       FROM public.locations l
      WHERE mygeo IS NOT NULL AND l.user_id <> me AND l.is_visible
        AND l.updated_at > now() - (greatest(pmin * 6, 10) || ' minutes')::interval),
    eff,
    pmin;
END;
$function$;

REVOKE ALL ON FUNCTION public.radar_self_check(double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.radar_self_check(double precision) TO authenticated, service_role;