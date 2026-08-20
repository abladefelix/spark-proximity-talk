CREATE OR REPLACE FUNCTION public.nearby_people(radius_m double precision DEFAULT 1000)
 RETURNS TABLE(id uuid, username text, display_name text, bio text, avatar_url text, distance_m double precision, i_signaled boolean, they_signaled boolean, match_id uuid, verified boolean, is_online boolean, gender text, bearing_deg double precision, accuracy_m double precision, updated_age_s double precision, is_pro boolean, beacon_style text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  me uuid := auth.uid();
  mylat double precision;
  mylng double precision;
  pmin integer;
  admin_max integer;
  free_max integer;
  pro_radius boolean;
  billing_on boolean;
  pro_beacon boolean;
  eff_radius double precision;
BEGIN
  IF me IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = me AND p.banned) THEN RETURN; END IF;

  SELECT coalesce(a.presence_timeout_min, 5), coalesce(a.max_radius_m, 2000)
    INTO pmin, admin_max
  FROM public.app_settings a WHERE a.id = 'global';
  pmin := coalesce(pmin, 5);
  admin_max := coalesce(admin_max, 2000);

  SELECT b.free_max_radius_m, b.pro_extended_radius, b.enabled, b.pro_custom_beacon
    INTO free_max, pro_radius, billing_on, pro_beacon
  FROM public.billing_settings b WHERE b.id = 'global';

  eff_radius := least(greatest(coalesce(radius_m, 1000), 50), admin_max::double precision);

  IF coalesce(billing_on, false) AND coalesce(pro_radius, false)
     AND coalesce(free_max, 0) > 0 AND NOT private.is_pro(me) THEN
    eff_radius := least(eff_radius, free_max::double precision);
  END IF;

  SELECT l.lat, l.lng INTO mylat, mylng FROM public.locations l WHERE l.user_id = me;
  IF mylat IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.username,
    p.display_name,
    p.bio,
    p.avatar_url,
    (round(d.dist::numeric, 1))::double precision,
    EXISTS (SELECT 1 FROM public.signals s WHERE s.from_user = me AND s.to_user = p.id AND s.expires_at > now()),
    EXISTS (SELECT 1 FROM public.signals s WHERE s.from_user = p.id AND s.to_user = me AND s.expires_at > now()),
    (SELECT m.id FROM public.matches m WHERE m.user_a = least(me, p.id) AND m.user_b = greatest(me, p.id) LIMIT 1),
    p.verified,
    (l.updated_at > now() - (pmin || ' minutes')::interval),
    p.gender,
    (mod((round(
      mod(
        degrees(atan2(
          sin(radians(l.lng - mylng)) * cos(radians(l.lat)),
          cos(radians(mylat)) * sin(radians(l.lat)) -
          sin(radians(mylat)) * cos(radians(l.lat)) * cos(radians(l.lng - mylng))
        ))::numeric + 360,
        360
      ) / 15.0
    ) * 15.0) + 360, 360))::double precision,
    NULL::double precision,
    extract(epoch FROM (now() - l.updated_at))::double precision,
    pro.active,
    CASE WHEN pro.active AND coalesce(pro_beacon, false) THEN p.beacon_style ELSE NULL END
  FROM public.locations l
  JOIN public.profiles p ON p.id = l.user_id
  CROSS JOIN LATERAL (
    SELECT 6371000 * 2 * asin(sqrt(
      power(sin(radians(l.lat - mylat) / 2), 2) +
      cos(radians(mylat)) * cos(radians(l.lat)) *
      power(sin(radians(l.lng - mylng) / 2), 2)
    )) AS dist
  ) d
  CROSS JOIN LATERAL (
    SELECT EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.user_id = p.id
        AND s.status = 'active'
        AND (s.expires_at IS NULL OR s.expires_at > now())
    ) AS active
  ) pro
  WHERE l.user_id <> me
    AND l.is_visible
    AND NOT p.banned
    AND l.updated_at > now() - (greatest(pmin * 6, 10) || ' minutes')::interval
    AND d.dist <= eff_radius
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker = me AND b.blocked = p.id) OR (b.blocker = p.id AND b.blocked = me)
    )
  ORDER BY pro.active DESC, d.dist ASC
  LIMIT 100;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.nearby_people(double precision) FROM anon;
GRANT EXECUTE ON FUNCTION public.nearby_people(double precision) TO authenticated;