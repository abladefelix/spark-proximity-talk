-- ROLES ---------------------------------------------------------------
create type public.app_role as enum ('admin', 'moderator', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
revoke all on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;

create policy "user_roles_select_own" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- BLOCKS --------------------------------------------------------------
create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker uuid not null references auth.users(id) on delete cascade,
  blocked uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker, blocked)
);
grant select, insert, delete on public.blocks to authenticated;
grant all on public.blocks to service_role;
alter table public.blocks enable row level security;
create policy "blocks_select_own" on public.blocks for select to authenticated using (blocker = auth.uid());
create policy "blocks_insert_own" on public.blocks for insert to authenticated with check (blocker = auth.uid() and blocker <> blocked);
create policy "blocks_delete_own" on public.blocks for delete to authenticated using (blocker = auth.uid());

-- REPORTS -------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null references auth.users(id) on delete cascade,
  reported uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 500),
  created_at timestamptz not null default now()
);
grant insert, select on public.reports to authenticated;
grant all on public.reports to service_role;
alter table public.reports enable row level security;
create policy "reports_insert_own" on public.reports for insert to authenticated with check (reporter = auth.uid() and reporter <> reported);
create policy "reports_select_admin" on public.reports for select to authenticated using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'moderator'));

-- SIGNAL EXPIRY -------------------------------------------------------
alter table public.signals add column expires_at timestamptz not null default (now() + interval '6 hours');
create index signals_expires_idx on public.signals (expires_at);

create or replace function public.purge_expired_signals()
returns void language sql security definer set search_path = public as $$
  delete from public.signals s
  where s.expires_at < now()
    and not exists (
      select 1 from public.matches m
      where m.user_a = least(s.from_user, s.to_user) and m.user_b = greatest(s.from_user, s.to_user)
    );
$$;
revoke all on function public.purge_expired_signals() from public, anon;
grant execute on function public.purge_expired_signals() to authenticated;

create or replace function public.handle_signal() returns trigger
language plpgsql security definer set search_path = public as $$
declare a uuid; b uuid;
begin
  if exists (
    select 1 from public.signals s
    where s.from_user = NEW.to_user and s.to_user = NEW.from_user and s.expires_at > now()
  ) then
    a := least(NEW.from_user, NEW.to_user);
    b := greatest(NEW.from_user, NEW.to_user);
    insert into public.matches (user_a, user_b) values (a, b) on conflict do nothing;
  end if;
  return NEW;
end;
$$;
revoke all on function public.handle_signal() from public, anon, authenticated;

-- VERIFICATION --------------------------------------------------------
alter table public.profiles add column verified boolean not null default false;

create table public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  selfie_path text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
grant select, insert, update, delete on public.verification_requests to authenticated;
grant all on public.verification_requests to service_role;
alter table public.verification_requests enable row level security;
create policy "vr_select" on public.verification_requests for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'moderator'));
create policy "vr_insert_own" on public.verification_requests for insert to authenticated with check (user_id = auth.uid());
create policy "vr_delete_own" on public.verification_requests for delete to authenticated using (user_id = auth.uid());
create policy "vr_update_admin" on public.verification_requests for update to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'moderator'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'moderator'));

create policy "verifications_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'verifications' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "verifications_read_own_or_mod" on storage.objects for select to authenticated
  using (bucket_id = 'verifications' and ((storage.foldername(name))[1] = auth.uid()::text
    or public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'moderator')));

-- MEET-UP PINS --------------------------------------------------------
alter table public.messages add column kind text not null default 'text' check (kind in ('text','pin'));
alter table public.messages add column lat double precision;
alter table public.messages add column lng double precision;

-- LAST ACTIVE ---------------------------------------------------------
alter table public.profiles add column last_seen timestamptz not null default now();

create or replace function public.touch_last_seen() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set last_seen = now() where id = NEW.user_id;
  return NEW;
end;
$$;
revoke all on function public.touch_last_seen() from public, anon, authenticated;
create trigger locations_touch_last_seen after insert or update on public.locations
for each row execute function public.touch_last_seen();

-- NEARBY --------------------------------------------------------------
drop function if exists public.nearby_people(double precision);
create or replace function public.nearby_people(radius_m double precision default 1000)
returns table (
  id uuid, username text, display_name text, bio text, avatar_url text,
  distance_m double precision, i_signaled boolean, they_signaled boolean, match_id uuid,
  verified boolean, is_online boolean
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
    (l.updated_at > now() - interval '5 minutes')
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