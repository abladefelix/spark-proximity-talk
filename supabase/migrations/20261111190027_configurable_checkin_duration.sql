-- A preference applies only when a member next manually checks in.
alter table public.profiles add column checkin_duration_minutes integer not null default 15
  check (checkin_duration_minutes in (15,30,60,120));
grant select(checkin_duration_minutes), update(checkin_duration_minutes) on public.profiles to authenticated;

create or replace function public.begin_location_checkin(_lat double precision, _lng double precision, _accuracy double precision default null)
returns timestamptz language plpgsql security definer set search_path = public, private as $$
declare me uuid := auth.uid(); until_at timestamptz; duration_minutes integer;
begin
  if me is null then raise exception 'Sign in first'; end if;
  if exists(select 1 from public.profiles where id=me and banned) then raise exception 'Account suspended'; end if;
  if _lat is null or _lng is null or not (_lat between -90 and 90) or not (_lng between -180 and 180) then
    raise exception 'Invalid location';
  end if;
  select checkin_duration_minutes into duration_minutes from public.profiles where id=me;
  until_at := now() + make_interval(mins => coalesce(duration_minutes,15));
  insert into private.location_checkins values(me,_lat,_lng,_accuracy,until_at)
    on conflict(user_id) do update set lat=excluded.lat,lng=excluded.lng,accuracy_m=excluded.accuracy_m,expires_at=excluded.expires_at;
  insert into public.locations(user_id,lat,lng,accuracy_m,is_visible,updated_at)
    values(me,_lat,_lng,_accuracy,true,now()) on conflict(user_id) do update
    set lat=excluded.lat,lng=excluded.lng,accuracy_m=excluded.accuracy_m,is_visible=true,updated_at=now();
  return until_at;
end;
$$;

CREATE OR REPLACE FUNCTION public.nearby_people(radius_m double precision DEFAULT 1000)
RETURNS TABLE(id uuid, username text, display_name text, bio text, avatar_url text, distance_m double precision, i_signaled boolean, they_signaled boolean, match_id uuid, verified boolean, is_online boolean, gender text, bearing_deg double precision, accuracy_m double precision, updated_age_s double precision, is_pro boolean, beacon_style text, intent text, intent_note text, mood text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  me uuid := auth.uid();
  mylat double precision;
  myaccuracy double precision;
  mylng double precision;
  mygeo extensions.geography;
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

  SELECT l.lat, l.lng, l.accuracy_m INTO mylat, mylng, myaccuracy
  FROM public.locations l
  WHERE l.user_id = me;
  IF mylat IS NULL THEN RETURN; END IF;

  mygeo := extensions.ST_SetSRID(extensions.ST_MakePoint(mylng, mylat), 4326)::extensions.geography;

  RETURN QUERY
  SELECT
    p.id,
    p.username,
    p.display_name,
    p.bio,
    p.avatar_url,
    g.dist,
    EXISTS (SELECT 1 FROM public.signals s WHERE s.from_user = me AND s.to_user = p.id AND s.expires_at > now()),
    EXISTS (SELECT 1 FROM public.signals s WHERE s.from_user = p.id AND s.to_user = me AND s.expires_at > now()),
    (SELECT m.id FROM public.matches m WHERE m.user_a = least(me, p.id) AND m.user_b = greatest(me, p.id) LIMIT 1),
    p.verified,
    (ci.expires_at > now()),
    p.gender,
    g.bearing,
    l.accuracy_m,
    extract(epoch FROM (now() - l.updated_at))::double precision,
    pro.active,
    CASE WHEN pro.active AND coalesce(pro_beacon, false) THEN p.beacon_style ELSE NULL END,
    CASE WHEN p.intent_expires_at > now() THEN p.intent ELSE NULL END,
    CASE WHEN p.intent_expires_at > now() THEN p.intent_note ELSE NULL END,
    p.mood
  FROM public.locations l
  JOIN public.profiles p ON p.id = l.user_id
  JOIN private.location_checkins ci ON ci.user_id = l.user_id AND ci.expires_at > now()
  CROSS JOIN LATERAL (
    SELECT
      extensions.ST_Distance(
        mygeo,
        extensions.ST_SetSRID(extensions.ST_MakePoint(ci.lng, ci.lat), 4326)::extensions.geography,
        true
      )::double precision AS dist,
      (degrees(extensions.ST_Azimuth(
        mygeo,
        extensions.ST_SetSRID(extensions.ST_MakePoint(ci.lng, ci.lat), 4326)::extensions.geography
      )) + 360.0)::numeric % 360.0 AS bearing_raw_maybe
  ) gsrc
  CROSS JOIN LATERAL (
    SELECT gsrc.dist AS dist,
           -- Identical coordinates give a NULL azimuth; fall back to a stable
           -- deterministic bearing so the beacon still renders on the radar.
           coalesce(gsrc.bearing_raw_maybe,
                    (('x' || substr(md5(l.user_id::text), 1, 4))::bit(16)::int % 360)::numeric
           )::double precision AS bearing
  ) g
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
    -- The explicit finite check-in lease determines visibility, not an old heartbeat.
    AND g.dist <= eff_radius + least(coalesce(myaccuracy, 0), 100) + least(coalesce(l.accuracy_m, 0), 100)
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker = me AND b.blocked = p.id) OR (b.blocker = p.id AND b.blocked = me)
    )
  ORDER BY pro.active DESC, g.dist ASC
  LIMIT 100;
END;
$function$;

REVOKE ALL ON FUNCTION public.nearby_people(double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nearby_people(double precision) TO authenticated, service_role;
