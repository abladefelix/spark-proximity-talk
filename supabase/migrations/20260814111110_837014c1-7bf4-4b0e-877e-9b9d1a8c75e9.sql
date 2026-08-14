alter table public.app_settings
  add column if not exists tagline text not null default 'Find people around you',
  add column if not exists welcome_text text not null default 'Turn on location to see who is nearby.',
  add column if not exists empty_radar_text text not null default 'No one around right now.',
  add column if not exists chat_prompt_text text not null default 'Say hello',
  add column if not exists terms_text text not null default '',
  add column if not exists privacy_text text not null default '',
  add column if not exists chat_enabled boolean not null default true,
  add column if not exists location_sharing_enabled boolean not null default true,
  add column if not exists verification_enabled boolean not null default true,
  add column if not exists reports_enabled boolean not null default true,
  add column if not exists signups_enabled boolean not null default true,
  add column if not exists push_enabled boolean not null default true,
  add column if not exists radar_sweep_enabled boolean not null default true,
  add column if not exists signal_expiry_hours integer not null default 6,
  add column if not exists presence_timeout_min integer not null default 5,
  add column if not exists default_radius_m integer not null default 500,
  add column if not exists max_message_len integer not null default 1000,
  add column if not exists daily_signal_limit integer not null default 100,
  add column if not exists color_male text not null default '#3b82f6',
  add column if not exists color_female text not null default '#ec4899',
  add column if not exists color_other text not null default '#f59e0b',
  add column if not exists default_theme text not null default 'dark',
  add column if not exists font_family text not null default 'Sora';

create or replace function public.apply_signal_rules()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare hrs integer; lim integer; sent integer;
begin
  select signal_expiry_hours, daily_signal_limit into hrs, lim
  from public.app_settings where id = 'global';
  hrs := coalesce(hrs, 6);
  lim := coalesce(lim, 100);

  NEW.expires_at := now() + (hrs || ' hours')::interval;

  if lim > 0 then
    select count(*) into sent from public.signals s
    where s.from_user = NEW.from_user and s.created_at > now() - interval '24 hours';
    if sent >= lim then
      raise exception 'daily signal limit reached';
    end if;
  end if;
  return NEW;
end;
$$;

revoke all on function public.apply_signal_rules() from public, anon;

drop trigger if exists signals_apply_rules on public.signals;
create trigger signals_apply_rules
  before insert on public.signals
  for each row execute function public.apply_signal_rules();

create or replace function public.nearby_people(radius_m double precision DEFAULT 1000)
 returns TABLE(id uuid, username text, display_name text, bio text, avatar_url text, distance_m double precision, i_signaled boolean, they_signaled boolean, match_id uuid, verified boolean, is_online boolean, gender text)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $$
declare me uuid := auth.uid(); mylat double precision; mylng double precision; pmin integer;
begin
  if me is null then return; end if;
  if exists (select 1 from public.profiles p where p.id = me and p.banned) then return; end if;
  select coalesce(presence_timeout_min, 5) into pmin from public.app_settings where id = 'global';
  pmin := coalesce(pmin, 5);
  select l.lat, l.lng into mylat, mylng from public.locations l where l.user_id = me;
  if mylat is null then return; end if;
  return query
  select p.id, p.username, p.display_name, p.bio, p.avatar_url,
    d.dist,
    exists (select 1 from public.signals s where s.from_user = me and s.to_user = p.id and s.expires_at > now()),
    exists (select 1 from public.signals s where s.from_user = p.id and s.to_user = me and s.expires_at > now()),
    (select m.id from public.matches m where m.user_a = least(me, p.id) and m.user_b = greatest(me, p.id)),
    p.verified,
    (l.updated_at > now() - (pmin || ' minutes')::interval),
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
    and l.updated_at > now() - (greatest(pmin * 6, 10) || ' minutes')::interval
    and d.dist <= radius_m
    and not exists (select 1 from public.blocks b where (b.blocker = me and b.blocked = p.id) or (b.blocker = p.id and b.blocked = me))
  order by d.dist asc
  limit 100;
end;
$$;

revoke all on function public.nearby_people(double precision) from public, anon;
grant execute on function public.nearby_people(double precision) to authenticated;