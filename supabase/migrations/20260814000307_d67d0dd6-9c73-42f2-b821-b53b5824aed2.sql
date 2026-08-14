alter table public.profiles
  add column if not exists banned boolean not null default false,
  add column if not exists banned_reason text,
  add column if not exists banned_at timestamptz;

-- banned people never appear on radar
create or replace function public.nearby_people(radius_m double precision DEFAULT 1000)
 returns TABLE(id uuid, username text, display_name text, bio text, avatar_url text, distance_m double precision, i_signaled boolean, they_signaled boolean, match_id uuid, verified boolean, is_online boolean, gender text)
 language plpgsql stable security definer set search_path to 'public'
as $function$
declare me uuid := auth.uid(); mylat double precision; mylng double precision;
begin
  if me is null then return; end if;
  if exists (select 1 from public.profiles p where p.id = me and p.banned) then return; end if;
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
    and not p.banned
    and l.updated_at > now() - interval '30 minutes'
    and d.dist <= radius_m
    and not exists (select 1 from public.blocks b where (b.blocker = me and b.blocked = p.id) or (b.blocker = p.id and b.blocked = me))
  order by d.dist asc
  limit 100;
end;
$function$;

-- reactivation appeals from banned members
create table if not exists public.reactivation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

grant select, insert on public.reactivation_requests to authenticated;
grant all on public.reactivation_requests to service_role;
alter table public.reactivation_requests enable row level security;

create policy rr_insert_own on public.reactivation_requests
  for insert to authenticated with check (user_id = auth.uid());
create policy rr_select on public.reactivation_requests
  for select to authenticated using (user_id = auth.uid() or public.is_staff(auth.uid()));
create policy rr_update_staff on public.reactivation_requests
  for update to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy rr_delete_staff on public.reactivation_requests
  for delete to authenticated using (public.is_staff(auth.uid()));
grant update, delete on public.reactivation_requests to authenticated;

-- staff ban / unban with side effects
create or replace function public.admin_set_ban(_user_id uuid, _banned boolean, _reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff(auth.uid()) then raise exception 'not authorized'; end if;
  if _banned and public.has_role(_user_id, 'admin') and not public.has_role(auth.uid(), 'admin') then
    raise exception 'cannot ban an admin';
  end if;
  update public.profiles
    set banned = _banned,
        banned_reason = case when _banned then _reason else null end,
        banned_at = case when _banned then now() else null end
  where id = _user_id;
  if _banned then
    update public.locations set is_visible = false where user_id = _user_id;
    delete from public.signals where from_user = _user_id or to_user = _user_id;
  end if;
end;
$$;

revoke all on function public.admin_set_ban(uuid, boolean, text) from public;
grant execute on function public.admin_set_ban(uuid, boolean, text) to authenticated;

-- review an appeal (approve = unban)
create or replace function public.admin_review_reactivation(_id uuid, _approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.is_staff(auth.uid()) then raise exception 'not authorized'; end if;
  select user_id into uid from public.reactivation_requests where id = _id;
  if uid is null then raise exception 'not found'; end if;
  update public.reactivation_requests
    set status = case when _approve then 'approved' else 'rejected' end, reviewed_at = now()
  where id = _id;
  if _approve then
    update public.profiles set banned = false, banned_reason = null, banned_at = null where id = uid;
  end if;
end;
$$;

revoke all on function public.admin_review_reactivation(uuid, boolean) from public;
grant execute on function public.admin_review_reactivation(uuid, boolean) to authenticated;