drop function if exists public.nearby_people(double precision);

create function public.nearby_people(radius_m double precision default 1000)
returns table(id uuid, username text, display_name text, bio text, avatar_url text, distance_m double precision, i_signaled boolean, they_signaled boolean, match_id uuid, verified boolean, is_online boolean, gender text, bearing_deg double precision, accuracy_m double precision, updated_age_s double precision, is_pro boolean, beacon_style text)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
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
begin
  if me is null then return; end if;
  if exists (select 1 from public.profiles p where p.id = me and p.banned) then return; end if;

  select coalesce(a.presence_timeout_min, 5), coalesce(a.max_radius_m, 2000)
    into pmin, admin_max
  from public.app_settings a where a.id = 'global';
  pmin := coalesce(pmin, 5);
  admin_max := coalesce(admin_max, 2000);

  select b.free_max_radius_m, b.pro_extended_radius, b.enabled, b.pro_custom_beacon
    into free_max, pro_radius, billing_on, pro_beacon
  from public.billing_settings b where b.id = 'global';

  eff_radius := least(greatest(coalesce(radius_m, 1000), 50), admin_max::double precision);

  if coalesce(billing_on, false) and coalesce(pro_radius, false)
     and coalesce(free_max, 0) > 0 and not private.is_pro(me) then
    eff_radius := least(eff_radius, free_max::double precision);
  end if;

  select l.lat, l.lng into mylat, mylng from public.locations l where l.user_id = me;
  if mylat is null then return; end if;

  return query
  select
    p.id,
    p.username,
    p.display_name,
    p.bio,
    p.avatar_url,
    (round(d.dist / 10.0) * 10.0)::double precision,
    exists (select 1 from public.signals s where s.from_user = me and s.to_user = p.id and s.expires_at > now()),
    exists (select 1 from public.signals s where s.from_user = p.id and s.to_user = me and s.expires_at > now()),
    (select m.id from public.matches m where m.user_a = least(me, p.id) and m.user_b = greatest(me, p.id) limit 1),
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
    null::double precision,
    extract(epoch from (now() - l.updated_at))::double precision,
    private.is_pro(p.id),
    case when private.is_pro(p.id) and coalesce(pro_beacon, false) then p.beacon_style else null end
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
    and d.dist <= eff_radius
    and not exists (
      select 1 from public.blocks b
       where (b.blocker = me and b.blocked = p.id) or (b.blocker = p.id and b.blocked = me)
    )
  order by private.is_pro(p.id) desc, d.dist asc
  limit 100;
end;
$function$;

revoke all on function public.nearby_people(double precision) from public, anon;
grant execute on function public.nearby_people(double precision) to authenticated;