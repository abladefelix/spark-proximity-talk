-- ---------------------------------------------------------------- intents
alter table public.profiles
  add column if not exists intent text,
  add column if not exists intent_note text,
  add column if not exists intent_expires_at timestamptz,
  add column if not exists mood text;

alter table public.signals
  add column if not exists intent text,
  add column if not exists intent_note text;

-- ------------------------------------------------------------ help beacons
create table if not exists public.help_beacons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  note text,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '3 minutes'
);
create index if not exists help_beacons_expires_idx on public.help_beacons (expires_at);

grant select, insert, update, delete on public.help_beacons to authenticated;
grant all on public.help_beacons to service_role;
alter table public.help_beacons enable row level security;

drop policy if exists "own help beacons" on public.help_beacons;
create policy "own help beacons" on public.help_beacons
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- -------------------------------------------------------------- broadcasts
create table if not exists public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question text not null,
  options text[] not null,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes'
);
create index if not exists broadcasts_expires_idx on public.broadcasts (expires_at);

create table if not exists public.broadcast_answers (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references public.broadcasts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  option_index integer not null,
  created_at timestamptz not null default now(),
  unique (broadcast_id, user_id)
);

grant select, insert, update, delete on public.broadcasts to authenticated;
grant all on public.broadcasts to service_role;
grant select, insert, update, delete on public.broadcast_answers to authenticated;
grant all on public.broadcast_answers to service_role;

alter table public.broadcasts enable row level security;
alter table public.broadcast_answers enable row level security;

drop policy if exists "own broadcasts" on public.broadcasts;
create policy "own broadcasts" on public.broadcasts
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own answers" on public.broadcast_answers;
create policy "own answers" on public.broadcast_answers
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ------------------------------------------------------------------- zones
create table if not exists public.zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  lat double precision not null,
  lng double precision not null,
  radius_m integer not null default 80,
  perk_text text not null default 'Buy 1 get 1 free coffee',
  perk_prefix text not null default 'SKAN',
  active boolean not null default true,
  expires_at timestamptz,
  contact_email text,
  created_at timestamptz not null default now()
);

create table if not exists public.zone_perk_claims (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.zones(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  created_at timestamptz not null default now()
);
create index if not exists zone_claims_user_idx on public.zone_perk_claims (user_id, created_at desc);

create table if not exists public.zone_requests (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  contact_email text not null,
  address text,
  notes text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

grant select on public.zones to authenticated;
grant all on public.zones to service_role;
grant select, insert on public.zone_perk_claims to authenticated;
grant all on public.zone_perk_claims to service_role;
grant insert on public.zone_requests to anon, authenticated;
grant all on public.zone_requests to service_role;

alter table public.zones enable row level security;
alter table public.zone_perk_claims enable row level security;
alter table public.zone_requests enable row level security;

drop policy if exists "read active zones" on public.zones;
create policy "read active zones" on public.zones
  for select to authenticated using (active and (expires_at is null or expires_at > now()));

drop policy if exists "staff manage zones" on public.zones;
create policy "staff manage zones" on public.zones
  for all to authenticated
  using (private.is_staff(auth.uid()))
  with check (private.is_staff(auth.uid()));

drop policy if exists "own claims" on public.zone_perk_claims;
create policy "own claims" on public.zone_perk_claims
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "anyone can request a zone" on public.zone_requests;
create policy "anyone can request a zone" on public.zone_requests
  for insert to anon, authenticated with check (true);

drop policy if exists "staff read zone requests" on public.zone_requests;
create policy "staff read zone requests" on public.zone_requests
  for select to authenticated using (private.is_staff(auth.uid()));

-- --------------------------------------------------------- vanishing chats
alter table public.matches
  add column if not exists vanish_hours integer not null default 0,
  add column if not exists vanish_on_leave boolean not null default false;

-- ---------------------------------------------------------------- functions
drop function if exists public.nearby_people(double precision);

create or replace function public.nearby_people(radius_m double precision default 1000)
returns table(
  id uuid, username text, display_name text, bio text, avatar_url text,
  distance_m double precision, i_signaled boolean, they_signaled boolean,
  match_id uuid, verified boolean, is_online boolean, gender text,
  bearing_deg double precision, accuracy_m double precision,
  updated_age_s double precision, is_pro boolean, beacon_style text,
  intent text, intent_note text, mood text
)
language plpgsql
stable security definer
set search_path to 'public', 'extensions'
as $function$
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

  SELECT l.lat, l.lng INTO mylat, mylng
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
      )) + 360.0)::numeric % 360.0 AS bearing_raw
  ) gsrc
  CROSS JOIN LATERAL (
    SELECT gsrc.dist AS dist, gsrc.bearing_raw::double precision AS bearing
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
    AND l.updated_at > now() - (greatest(pmin * 6, 10) || ' minutes')::interval
    AND g.dist <= eff_radius
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker = me AND b.blocked = p.id) OR (b.blocker = p.id AND b.blocked = me)
    )
  ORDER BY pro.active DESC, g.dist ASC
  LIMIT 100;
END;
$function$;

revoke execute on function public.nearby_people(double precision) from anon, public;
grant execute on function public.nearby_people(double precision) to authenticated, service_role;

create or replace function public.set_my_intent(_intent text, _note text, _minutes integer default 60)
returns void
language sql
security definer
set search_path to 'public'
as $$
  update public.profiles set
    intent = nullif(_intent, ''),
    intent_note = nullif(left(coalesce(_note, ''), 80), ''),
    intent_expires_at = case when nullif(_intent, '') is null
      then null else now() + (greatest(least(coalesce(_minutes, 60), 480), 5) || ' minutes')::interval end
  where id = auth.uid();
$$;
revoke execute on function public.set_my_intent(text, text, integer) from anon, public;
grant execute on function public.set_my_intent(text, text, integer) to authenticated;

create or replace function public.set_my_mood(_mood text)
returns void
language sql
security definer
set search_path to 'public'
as $$
  update public.profiles set mood = nullif(left(coalesce(_mood, ''), 40), '') where id = auth.uid();
$$;
revoke execute on function public.set_my_mood(text) from anon, public;
grant execute on function public.set_my_mood(text) to authenticated;

create or replace function public.drop_help_beacon(_kind text, _note text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare me uuid := auth.uid(); mylat double precision; mylng double precision; newid uuid;
begin
  if me is null then raise exception 'Not signed in'; end if;
  select l.lat, l.lng into mylat, mylng from public.locations l where l.user_id = me;
  if mylat is null then raise exception 'We need your location first'; end if;
  delete from public.help_beacons where user_id = me and expires_at > now();
  insert into public.help_beacons (user_id, kind, note, lat, lng)
  values (me, left(_kind, 40), nullif(left(coalesce(_note, ''), 120), ''), mylat, mylng)
  returning id into newid;
  return newid;
end;
$$;
revoke execute on function public.drop_help_beacon(text, text) from anon, public;
grant execute on function public.drop_help_beacon(text, text) to authenticated;

create or replace function public.nearby_help_beacons()
returns table(
  id uuid, user_id uuid, username text, display_name text, avatar_url text,
  kind text, note text, distance_m double precision, bearing_deg double precision,
  expires_at timestamptz, mine boolean, match_id uuid
)
language plpgsql
stable security definer
set search_path to 'public', 'extensions'
as $$
declare me uuid := auth.uid(); mylat double precision; mylng double precision; mygeo extensions.geography;
begin
  if me is null then return; end if;
  select l.lat, l.lng into mylat, mylng from public.locations l where l.user_id = me;
  if mylat is null then return; end if;
  mygeo := extensions.ST_SetSRID(extensions.ST_MakePoint(mylng, mylat), 4326)::extensions.geography;

  return query
  select h.id, h.user_id, p.username, p.display_name, p.avatar_url, h.kind, h.note,
    d.dist, d.bearing, h.expires_at, (h.user_id = me),
    (select m.id from public.matches m
      where m.user_a = least(me, h.user_id) and m.user_b = greatest(me, h.user_id) limit 1)
  from public.help_beacons h
  join public.profiles p on p.id = h.user_id
  cross join lateral (
    select extensions.ST_Distance(mygeo,
        extensions.ST_SetSRID(extensions.ST_MakePoint(h.lng, h.lat), 4326)::extensions.geography, true
      )::double precision as dist,
      ((degrees(extensions.ST_Azimuth(mygeo,
        extensions.ST_SetSRID(extensions.ST_MakePoint(h.lng, h.lat), 4326)::extensions.geography
      )) + 360.0)::numeric % 360.0)::double precision as bearing
  ) d
  where h.expires_at > now()
    and not p.banned
    and d.dist <= 200
    and not exists (
      select 1 from public.blocks b
      where (b.blocker = me and b.blocked = h.user_id) or (b.blocker = h.user_id and b.blocked = me)
    )
  order by d.dist asc
  limit 20;
end;
$$;
revoke execute on function public.nearby_help_beacons() from anon, public;
grant execute on function public.nearby_help_beacons() to authenticated;

create or replace function public.post_broadcast(_question text, _options text[])
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare me uuid := auth.uid(); mylat double precision; mylng double precision; newid uuid;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if coalesce(array_length(_options, 1), 0) < 2 then raise exception 'Add at least two answers'; end if;
  select l.lat, l.lng into mylat, mylng from public.locations l where l.user_id = me;
  if mylat is null then raise exception 'We need your location first'; end if;
  insert into public.broadcasts (user_id, question, options, lat, lng)
  values (me, left(_question, 160), _options[1:4], mylat, mylng)
  returning id into newid;
  return newid;
end;
$$;
revoke execute on function public.post_broadcast(text, text[]) from anon, public;
grant execute on function public.post_broadcast(text, text[]) to authenticated;

create or replace function public.nearby_broadcasts(radius_m double precision default 1000)
returns table(
  id uuid, question text, options text[], counts integer[], total integer,
  my_answer integer, mine boolean, distance_m double precision, expires_at timestamptz,
  match_id uuid
)
language plpgsql
stable security definer
set search_path to 'public', 'extensions'
as $$
declare me uuid := auth.uid(); mylat double precision; mylng double precision; mygeo extensions.geography;
begin
  if me is null then return; end if;
  select l.lat, l.lng into mylat, mylng from public.locations l where l.user_id = me;
  if mylat is null then return; end if;
  mygeo := extensions.ST_SetSRID(extensions.ST_MakePoint(mylng, mylat), 4326)::extensions.geography;

  return query
  select b.id, b.question, b.options,
    (select coalesce(array_agg(c.n order by c.i), array[]::integer[]) from (
        select gs.i as i, (select count(*)::integer from public.broadcast_answers a
                      where a.broadcast_id = b.id and a.option_index = gs.i - 1) as n
        from generate_series(1, coalesce(array_length(b.options, 1), 0)) gs(i)
      ) c),
    (select count(*)::integer from public.broadcast_answers a where a.broadcast_id = b.id),
    (select a.option_index from public.broadcast_answers a where a.broadcast_id = b.id and a.user_id = me),
    (b.user_id = me),
    d.dist,
    b.expires_at,
    (select m.id from public.matches m
      where m.user_a = least(me, b.user_id) and m.user_b = greatest(me, b.user_id) limit 1)
  from public.broadcasts b
  cross join lateral (
    select extensions.ST_Distance(mygeo,
      extensions.ST_SetSRID(extensions.ST_MakePoint(b.lng, b.lat), 4326)::extensions.geography, true
    )::double precision as dist
  ) d
  where b.expires_at > now()
    and d.dist <= least(greatest(coalesce(radius_m, 1000), 50), 5000)
    and not exists (
      select 1 from public.blocks bl
      where (bl.blocker = me and bl.blocked = b.user_id) or (bl.blocker = b.user_id and bl.blocked = me)
    )
  order by b.created_at desc
  limit 30;
end;
$$;
revoke execute on function public.nearby_broadcasts(double precision) from anon, public;
grant execute on function public.nearby_broadcasts(double precision) to authenticated;

create or replace function public.answer_broadcast(_broadcast_id uuid, _option_index integer)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Not signed in'; end if;
  if not exists (select 1 from public.broadcasts b where b.id = _broadcast_id and b.expires_at > now()) then
    raise exception 'That question has expired';
  end if;
  insert into public.broadcast_answers (broadcast_id, user_id, option_index)
  values (_broadcast_id, me, greatest(_option_index, 0))
  on conflict (broadcast_id, user_id) do update set option_index = excluded.option_index;
end;
$$;
revoke execute on function public.answer_broadcast(uuid, integer) from anon, public;
grant execute on function public.answer_broadcast(uuid, integer) to authenticated;

create or replace function public.signal_broadcast_author(_broadcast_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare me uuid := auth.uid(); author uuid;
begin
  if me is null then raise exception 'Not signed in'; end if;
  select b.user_id into author from public.broadcasts b where b.id = _broadcast_id and b.expires_at > now();
  if author is null or author = me then raise exception 'That question is no longer live'; end if;
  insert into public.signals (from_user, to_user, intent, intent_note)
  values (me, author, 'answer', 'has an answer to your question')
  on conflict do nothing;
  return author;
end;
$$;
revoke execute on function public.signal_broadcast_author(uuid) from anon, public;
grant execute on function public.signal_broadcast_author(uuid) to authenticated;

create or replace function public.my_zone()
returns table(id uuid, name text, description text, perk_text text, distance_m double precision, claimed_code text)
language plpgsql
stable security definer
set search_path to 'public', 'extensions'
as $$
declare me uuid := auth.uid(); mylat double precision; mylng double precision; mygeo extensions.geography;
begin
  if me is null then return; end if;
  select l.lat, l.lng into mylat, mylng from public.locations l where l.user_id = me;
  if mylat is null then return; end if;
  mygeo := extensions.ST_SetSRID(extensions.ST_MakePoint(mylng, mylat), 4326)::extensions.geography;

  return query
  select z.id, z.name, z.description, z.perk_text, d.dist,
    (select c.code from public.zone_perk_claims c
      where c.zone_id = z.id and c.user_id = me and c.created_at > now() - interval '24 hours'
      order by c.created_at desc limit 1)
  from public.zones z
  cross join lateral (
    select extensions.ST_Distance(mygeo,
      extensions.ST_SetSRID(extensions.ST_MakePoint(z.lng, z.lat), 4326)::extensions.geography, true
    )::double precision as dist
  ) d
  where z.active and (z.expires_at is null or z.expires_at > now()) and d.dist <= z.radius_m
  order by d.dist asc
  limit 1;
end;
$$;
revoke execute on function public.my_zone() from anon, public;
grant execute on function public.my_zone() to authenticated;

create or replace function public.claim_zone_perk(_zone_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare me uuid := auth.uid(); existing text; prefix text; newcode text;
begin
  if me is null then raise exception 'Not signed in'; end if;
  select c.code into existing from public.zone_perk_claims c
    where c.zone_id = _zone_id and c.user_id = me and c.created_at > now() - interval '24 hours'
    order by c.created_at desc limit 1;
  if existing is not null then return existing; end if;
  select z.perk_prefix into prefix from public.zones z
    where z.id = _zone_id and z.active and (z.expires_at is null or z.expires_at > now());
  if prefix is null then raise exception 'That zone is not active'; end if;
  newcode := upper(prefix) || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  insert into public.zone_perk_claims (zone_id, user_id, code) values (_zone_id, me, newcode);
  return newcode;
end;
$$;
revoke execute on function public.claim_zone_perk(uuid) from anon, public;
grant execute on function public.claim_zone_perk(uuid) to authenticated;

create or replace function public.set_chat_vanish(_match_id uuid, _hours integer, _on_leave boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Not signed in'; end if;
  update public.matches m
     set vanish_hours = greatest(coalesce(_hours, 0), 0),
         vanish_on_leave = coalesce(_on_leave, false)
   where m.id = _match_id and (m.user_a = me or m.user_b = me);
  if not found then raise exception 'Not your chat'; end if;
end;
$$;
revoke execute on function public.set_chat_vanish(uuid, integer, boolean) from anon, public;
grant execute on function public.set_chat_vanish(uuid, integer, boolean) to authenticated;

create or replace function public.purge_vanished_messages()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare removed integer := 0; n integer;
begin
  with gone as (
    delete from public.messages msg
    using public.matches m
    where msg.match_id = m.id
      and m.vanish_hours > 0
      and msg.created_at < now() - (m.vanish_hours || ' hours')::interval
    returning 1
  ) select count(*)::integer into n from gone;
  removed := removed + coalesce(n, 0);

  with left_behind as (
    delete from public.messages msg
    using public.matches m
    where msg.match_id = m.id
      and m.vanish_on_leave
      and exists (
        select 1 from public.locations l
        where l.user_id in (m.user_a, m.user_b)
          and l.updated_at < now() - interval '1 hour'
      )
    returning 1
  ) select count(*)::integer into n from left_behind;
  removed := removed + coalesce(n, 0);

  delete from public.help_beacons where expires_at < now() - interval '1 hour';
  delete from public.broadcasts where expires_at < now() - interval '1 hour';

  return removed;
end;
$$;
revoke execute on function public.purge_vanished_messages() from anon, public;
grant execute on function public.purge_vanished_messages() to authenticated, service_role;