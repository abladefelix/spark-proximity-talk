-- All public location disclosure requires a new, finite manual check-in.
alter table public.locations alter column is_visible set default false;
update public.locations set is_visible = false;
create table private.location_checkins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  lat double precision not null, lng double precision not null,
  accuracy_m double precision, expires_at timestamptz not null
);
alter table private.location_checkins enable row level security;
revoke all on private.location_checkins from public, anon, authenticated;

create or replace function private.guard_location_visibility() returns trigger
language plpgsql security definer set search_path = public, private as $$
begin
  if not new.is_visible then
    delete from private.location_checkins where user_id = new.user_id;
  end if;
  new.is_visible := new.is_visible and exists (
    select 1 from private.location_checkins c where c.user_id = new.user_id and c.expires_at > now()
  );
  return new;
end;
$$;
revoke all on function private.guard_location_visibility() from public, anon, authenticated;
create trigger guard_location_visibility before insert or update on public.locations
for each row execute function private.guard_location_visibility();

create or replace function public.begin_location_checkin(_lat double precision, _lng double precision, _accuracy double precision default null)
returns timestamptz language plpgsql security definer set search_path = public, private as $$
declare me uuid := auth.uid(); until_at timestamptz := now() + interval '15 minutes';
begin
  if me is null then raise exception 'Sign in first'; end if;
  if exists(select 1 from public.profiles where id=me and banned) then raise exception 'Account suspended'; end if;
  if _lat is null or _lng is null or not (_lat between -90 and 90) or not (_lng between -180 and 180) then
    raise exception 'Invalid location';
  end if;
  insert into private.location_checkins values(me,_lat,_lng,_accuracy,until_at)
    on conflict(user_id) do update set lat=excluded.lat,lng=excluded.lng,accuracy_m=excluded.accuracy_m,expires_at=excluded.expires_at;
  insert into public.locations(user_id,lat,lng,accuracy_m,is_visible,updated_at)
    values(me,_lat,_lng,_accuracy,true,now()) on conflict(user_id) do update
    set lat=excluded.lat,lng=excluded.lng,accuracy_m=excluded.accuracy_m,is_visible=true,updated_at=now();
  return until_at;
end;
$$;
create or replace function public.end_location_checkin() returns void
language plpgsql security definer set search_path = public, private as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first'; end if;
  delete from private.location_checkins where user_id=me;
  update public.locations set is_visible=false where user_id=me;
end;
$$;
revoke all on function public.begin_location_checkin(double precision,double precision,double precision) from public,anon;
revoke all on function public.end_location_checkin() from public,anon;
grant execute on function public.begin_location_checkin(double precision,double precision,double precision) to authenticated;
grant execute on function public.end_location_checkin() to authenticated;

create table public.hidden_broadcasts (
  user_id uuid not null references auth.users(id) on delete cascade,
  broadcast_id uuid not null references public.broadcasts(id) on delete cascade,
  primary key(user_id,broadcast_id)
);
alter table public.hidden_broadcasts enable row level security;
grant select,insert,delete on public.hidden_broadcasts to authenticated;
grant all on public.hidden_broadcasts to service_role;
create policy own_hidden_posts on public.hidden_broadcasts for all to authenticated
using(user_id=auth.uid()) with check(user_id=auth.uid());

create table public.community_acceptances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  version text not null, accepted_at timestamptz not null default now()
);
alter table public.community_acceptances enable row level security;
grant select on public.community_acceptances to authenticated;
grant all on public.community_acceptances to service_role;
create policy own_acceptance on public.community_acceptances for select to authenticated using(user_id=auth.uid());
create or replace function public.accept_community_rules(_version text) returns void
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if _version <> '2026-11-11' then raise exception 'Read the current community rules'; end if;
  insert into public.community_acceptances(user_id,version) values(auth.uid(),_version)
  on conflict(user_id) do update set version=excluded.version,accepted_at=now();
end;
$$;
revoke all on function public.accept_community_rules(text) from public,anon;
grant execute on function public.accept_community_rules(text) to authenticated;

-- Apply the existing text filter to direct writes too, including modified clients.
create or replace function private.guard_community_content() returns trigger
language plpgsql security definer set search_path=public,private as $$
declare writer uuid; body text;
begin
  if tg_table_name='messages' then writer:=new.sender_id; body:=case when new.kind='text' then new.content else '' end;
  elsif tg_table_name='broadcasts' then writer:=new.user_id; body:=new.question || ' ' || array_to_string(new.options,' ');
  elsif tg_table_name='signals' then writer:=new.from_user; body:=coalesce(new.intent_note,'');
  elsif tg_table_name='help_beacons' then writer:=new.user_id; body:=coalesce(new.note,'');
  end if;
  if exists(select 1 from public.profiles where id=writer and banned) then raise exception 'Account suspended'; end if;
  if auth.uid() is not null and not exists(select 1 from public.community_acceptances where user_id=auth.uid() and version='2026-11-11') then
    raise exception 'Accept the community rules before posting';
  end if;
  if private.is_objectionable_text(body) then raise exception 'content_not_allowed'; end if;
  return new;
end;
$$;
revoke all on function private.guard_community_content() from public,anon,authenticated;
create trigger guard_community_messages before insert or update of content on public.messages for each row execute function private.guard_community_content();
create trigger guard_community_broadcasts before insert or update of question,options on public.broadcasts for each row execute function private.guard_community_content();
create trigger guard_community_signals before insert or update of intent_note on public.signals for each row execute function private.guard_community_content();

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

create or replace function public.nearby_broadcasts(radius_m double precision default 1000)
returns table(
  id uuid,
  author_id uuid,
  username text,
  question text,
  options text[],
  counts integer[],
  total integer,
  my_answer integer,
  mine boolean,
  distance_m double precision,
  expires_at timestamptz,
  match_id uuid
)
language plpgsql
stable security definer
set search_path to 'public', 'extensions'
as $$
declare
  me uuid := auth.uid();
  mylat double precision;
  mylng double precision;
  mygeo extensions.geography;
begin
  if me is null then return; end if;

  select l.lat, l.lng into mylat, mylng
  from public.locations l
  where l.user_id = me;



  mygeo := extensions.ST_SetSRID(
    extensions.ST_MakePoint(mylng, mylat), 4326
  )::extensions.geography;

  return query
  select
    b.id,
    b.user_id,
    p.username,
    b.question,
    b.options,
    (select coalesce(array_agg(c.n order by c.i), array[]::integer[]) from (
      select gs.i as i,
        (select count(*)::integer
         from public.broadcast_answers a
         where a.broadcast_id = b.id
           and a.option_index = gs.i - 1) as n
      from generate_series(1, coalesce(array_length(b.options, 1), 0)) gs(i)
    ) c),
    (select count(*)::integer
     from public.broadcast_answers a
     where a.broadcast_id = b.id),
    (select a.option_index
     from public.broadcast_answers a
     where a.broadcast_id = b.id
       and a.user_id = me),
    (b.user_id = me),
    case when b.review_owner is not null then null::double precision else d.dist end,
    b.expires_at,
    (select m.id
     from public.matches m
     where m.user_a = least(me, b.user_id)
       and m.user_b = greatest(me, b.user_id)
     limit 1)
  from public.broadcasts b
  join public.profiles p on p.id = b.user_id
  cross join lateral (
    select extensions.ST_Distance(
      mygeo,
      extensions.ST_SetSRID(
        extensions.ST_MakePoint(b.lng, b.lat), 4326
      )::extensions.geography,
      true
    )::double precision as dist
  ) d
  where b.expires_at > now()
    and not exists(select 1 from public.hidden_broadcasts h where h.user_id=me and h.broadcast_id=b.id)
    and not p.banned
    and ((b.review_owner = me) or
      (b.review_owner is null and mylat is not null
       and d.dist <= least(greatest(coalesce(radius_m, 1000), 50), 5000)))
    and not exists (
      select 1
      from public.blocks bl
      where (bl.blocker = me and bl.blocked = b.user_id)
         or (bl.blocker = b.user_id and bl.blocked = me)
    )
  order by b.created_at desc
  limit 30;
end;
$$;

revoke execute on function public.nearby_broadcasts(double precision) from anon, public;
grant execute on function public.nearby_broadcasts(double precision) to authenticated;



create or replace function public.report_broadcast(_broadcast_id uuid, _reason text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  me uuid := auth.uid();
  author uuid;
  snapshot text;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if length(trim(coalesce(_reason, ''))) < 3 then raise exception 'Add a report reason'; end if;

  select b.user_id, b.question
    into author, snapshot
  from public.broadcasts b
  where b.id = _broadcast_id
    and b.expires_at > now()
    and (b.review_owner is null or b.review_owner = me);

  if author is null then raise exception 'Question is no longer available'; end if;
  if author = me then raise exception 'You cannot report your own question'; end if;

  insert into public.reports (
    reporter,
    reported,
    reason,
    content_type,
    content_id,
    content_snapshot
  )
  values (
    me,
    author,
    left(trim(_reason), 500),
    'broadcast',
    _broadcast_id,
    left(snapshot, 500)
  );
  insert into public.hidden_broadcasts(user_id,broadcast_id) values(me,_broadcast_id) on conflict do nothing;
end;
$$;

revoke execute on function public.report_broadcast(uuid, text) from anon, public;
grant execute on function public.report_broadcast(uuid, text) to authenticated;



-- Confirmed owner-designated safety inbox; keep it visible in the app.
update public.app_settings set support_email='niiabladefelix@gmail.com' where id='global';
update public.pro_features set pro_only=false where key='invisible_mode';

create or replace function private.guard_profile_text() returns trigger
language plpgsql security definer set search_path=public,private as $$
begin
  if private.is_objectionable_text(coalesce(new.username,'') || ' ' || coalesce(new.display_name,'') || ' ' || coalesce(new.bio,'') || ' ' || coalesce(new.intent_note,'') || ' ' || coalesce(new.mood,'')) then
    raise exception 'content_not_allowed';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_profile_text() from public,anon,authenticated;
create trigger guard_profile_text before insert or update of username,display_name,bio,intent_note,mood on public.profiles
for each row execute function private.guard_profile_text();
create trigger guard_community_beacons before insert or update of note on public.help_beacons
for each row execute function private.guard_community_content();

-- A moderator confirms a violation before taking this action; reports alone
-- never automatically ban a member. Keep the original report as evidence.
alter table public.reports add column if not exists actioned_at timestamptz;
create or replace function public.admin_enforce_content_report(_report_id uuid) returns void
language plpgsql security definer set search_path=public,private as $$
declare offender uuid;
begin
  if auth.uid() is null or not private.is_staff(auth.uid()) then raise exception 'not authorized'; end if;
  select reported into offender from public.reports where id=_report_id;
  if offender is null then raise exception 'Report not found'; end if;
  perform public.admin_set_ban(offender,true,'Confirmed objectionable content report');
  delete from public.broadcasts where user_id=offender;
  delete from public.help_beacons where user_id=offender;
  delete from public.messages where sender_id=offender;
  update public.profiles set bio=null,avatar_url=null where id=offender;
  delete from private.location_checkins where user_id=offender;
  update public.locations set is_visible=false where user_id=offender;
  update public.reports set actioned_at=now() where id=_report_id;
end;
$$;
revoke all on function public.admin_enforce_content_report(uuid) from public,anon;
grant execute on function public.admin_enforce_content_report(uuid) to authenticated;

-- An admin setting cannot lower the adult-only minimum.
create or replace function public.enforce_min_age()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare _min integer;
begin
  select coalesce(min_age, 18) into _min from public.app_settings where id = 'global';
  _min := greatest(coalesce(_min, 18), 18);
  if NEW.date_of_birth is null then
    raise exception 'date of birth is required';
  end if;
  if NEW.date_of_birth > (current_date - make_interval(years => _min)) then
    raise exception 'you must be at least % years old', _min;
  end if;
  return NEW;
end;
$$;

revoke all on function public.enforce_min_age() from public, anon, authenticated;

