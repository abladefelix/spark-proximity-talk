DROP FUNCTION IF EXISTS public.nearby_people(double precision);

CREATE OR REPLACE FUNCTION public.nearby_people(radius_m double precision DEFAULT 1000)
 RETURNS TABLE(id uuid, username text, display_name text, bio text, avatar_url text, distance_m double precision, i_signaled boolean, they_signaled boolean, match_id uuid, verified boolean, is_online boolean, gender text, bearing_deg double precision, accuracy_m double precision, updated_age_s double precision)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me uuid := auth.uid();
  mylat double precision;
  mylng double precision;
  pmin integer;
begin
  if me is null then return; end if;
  if exists (select 1 from public.profiles p where p.id = me and p.banned) then return; end if;

  select coalesce(a.presence_timeout_min, 5)
    into pmin
    from public.app_settings a
   where a.id = 'global';
  pmin := coalesce(pmin, 5);

  select l.lat, l.lng
    into mylat, mylng
    from public.locations l
   where l.user_id = me;
  if mylat is null then return; end if;

  return query
  select
    p.id,
    p.username,
    p.display_name,
    p.bio,
    p.avatar_url,
    d.dist,
    exists (
      select 1 from public.signals s
       where s.from_user = me and s.to_user = p.id and s.expires_at > now()
    ),
    exists (
      select 1 from public.signals s
       where s.from_user = p.id and s.to_user = me and s.expires_at > now()
    ),
    (
      select m.id from public.matches m
       where m.user_a = least(me, p.id) and m.user_b = greatest(me, p.id)
      limit 1
    ),
    p.verified,
    (l.updated_at > now() - (pmin || ' minutes')::interval),
    p.gender,
    (
      (degrees(atan2(
        sin(radians(l.lng - mylng)) * cos(radians(l.lat)),
        cos(radians(mylat)) * sin(radians(l.lat)) -
        sin(radians(mylat)) * cos(radians(l.lat)) * cos(radians(l.lng - mylng))
      ))::numeric + 360)::double precision
    )::numeric % 360,
    null::double precision,
    extract(epoch from (now() - l.updated_at))::double precision
  from public.locations l
  join public.profiles p on p.id = l.user_id
  cross join lateral (
    select 6371000 * 2 * asin(sqrt(
      power(sin(radians(l.lat - mylat) / 2), 2) +
      cos(radians(mylat)) * cos(radians(l.lat)) *
      power(sin(radians(l.lng - mylng) / 2), 2)
    )) as dist
  ) d
  where l.user_id <> me
    and l.is_visible
    and not p.banned
    and l.updated_at > now() - (greatest(pmin * 6, 10) || ' minutes')::interval
    and d.dist <= radius_m
    and not exists (
      select 1 from public.blocks b
       where (b.blocker = me and b.blocked = p.id)
          or (b.blocker = p.id and b.blocked = me)
    )
  order by d.dist asc
  limit 100;
end;
$function$;

REVOKE ALL ON FUNCTION public.nearby_people(double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nearby_people(double precision) TO authenticated;