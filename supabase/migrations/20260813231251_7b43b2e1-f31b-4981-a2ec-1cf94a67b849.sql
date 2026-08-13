alter table public.profiles add column if not exists gender text check (gender in ('male','female','other'));

drop function if exists public.nearby_people(double precision);
create or replace function public.nearby_people(radius_m double precision default 1000)
returns table (
  id uuid, username text, display_name text, bio text, avatar_url text,
  distance_m double precision, i_signaled boolean, they_signaled boolean, match_id uuid,
  verified boolean, is_online boolean, gender text
)
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); mylat double precision; mylng double precision;
begin
  if me is null then return; end if;
  select l.lat, l.lng into mylat, mylng from public.locations l where l.user_id = me;
  if mylat is null then return; end if;
  return query
  select p.id, p.username, p.display_name, p.bio, p.avatar_url,
    d.dist,
    exists (select 1 from public.signals s where s.from_user = me and s.to_user = p.id and s.expires_at > now()),
    exists (select 1 from public.signals s where s.from_user = p.id and s.to_user = me and s.expires_at > now()),
    (select m.id from public.matches m where m.user_a = least(me, p.id) and m.user_b = greatest(me, p.id)),
    p.verified,
    (l.updated_at > now() - interval '5 minutes'),
    p.gender
  from public.locations l
  join public.profiles p on p.id = l.user_id
  cross join lateral (
    select 6371000 * 2 * asin(sqrt(
      power(sin(radians(l.lat - mylat) / 2), 2) +
      cos(radians(mylat)) * cos(radians(l.lat)) * power(sin(radians(l.lng - mylng) / 2), 2)
    )) as dist
  ) d
  where l.user_id <> me
    and l.is_visible
    and l.updated_at > now() - interval '30 minutes'
    and d.dist <= radius_m
    and not exists (select 1 from public.blocks b where (b.blocker = me and b.blocked = p.id) or (b.blocker = p.id and b.blocked = me))
  order by d.dist asc
  limit 100;
end;
$$;
revoke all on function public.nearby_people(double precision) from public, anon;
grant execute on function public.nearby_people(double precision) to authenticated;