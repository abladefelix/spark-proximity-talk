-- Forced live repair (idempotent): this new filename ensures servers that
-- already recorded the earlier repair rerun the corrected nearby function.
-- Restores the stale-location grace window in
-- public.nearby_people() that was silently regressed by
-- 20260904175357_36d449be-a3ae-4986-b5c4-2f9d95af3e07.sql.
--
-- Root cause -----------------------------------------------------------------
-- 20260904042446_a1d0fb0d-...sql (04:24 UTC) introduced a wider visibility
-- window: WHERE l.updated_at > now() - (greatest(pmin * 6, 10) || ' minutes')
-- to tolerate the client's 10s heartbeat being suspended by backgrounded
-- tabs / OS-throttled PWAs (see comment in src/routes/_authenticated/radar.tsx
-- around the `heartbeat` setInterval and `onWake` handler).
--
-- 20260904175357_36d449be-...sql (17:53 UTC, same day) re-issued
-- `CREATE OR REPLACE FUNCTION public.nearby_people` and, in the process,
-- reverted that WHERE clause back to the original tight window:
--   WHERE l.updated_at > now() - (pmin || ' minutes')::interval
-- (pmin defaults to app_settings.presence_timeout_min = 5).
-- It also hard-coded is_online to `true` instead of recomputing it from
-- l.updated_at, so clients can no longer tell a stale row from a fresh one.
--
-- Net effect: any two signed-in users whose last location write is older
-- than ~5 minutes (very common the moment a phone screen locks, a browser
-- tab backgrounds, or a self-hosted VM's realtime/postgrest connection hits
-- latency) silently drop out of *each other's* nearby_people() result set,
-- even though they are within radius and not blocked. Because the filter is
-- symmetric, this reliably reproduces as "mutual" undiscoverability rather
-- than a one-sided miss, which is what makes it easy to mistake for a client
-- bug instead of a migration drift on the self-hosted VM.
--
-- This migration is safe to re-run: CREATE OR REPLACE is idempotent and the
-- function signature/columns are unchanged from the last applied version.

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
    (l.updated_at > now() - (pmin || ' minutes')::interval),
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
  CROSS JOIN LATERAL (
    SELECT
      extensions.ST_Distance(
        mygeo,
        extensions.ST_SetSRID(extensions.ST_MakePoint(l.lng, l.lat), 4326)::extensions.geography,
        true
      )::double precision AS dist,
      (degrees(extensions.ST_Azimuth(
        mygeo,
        extensions.ST_SetSRID(extensions.ST_MakePoint(l.lng, l.lat), 4326)::extensions.geography
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
    -- Restored grace window (see header comment): a location fresher than
    -- pmin*6 (min 10) minutes still counts as "nearby", even though
    -- is_online correctly reports it as stale once older than pmin minutes.
    AND l.updated_at > now() - (greatest(pmin * 6, 10) || ' minutes')::interval
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
