-- Apple App Review guideline 1.2 hardening for local-question UGC.

alter table public.reports
  add column if not exists content_type text,
  add column if not exists content_id uuid,
  add column if not exists content_snapshot text;

-- Basic server-side safety filter. This is intentionally conservative and is
-- enforced in the database so a modified client cannot bypass it.
create or replace function private.is_objectionable_text(_text text)
returns boolean
language sql
immutable
set search_path to 'public'
as $$
  select lower(coalesce(_text, '')) ~
    '(kill[[:space:]]+yourself|rape|child[[:space:]]*(sex|porn)|csam|porn|nudes?|explicit[[:space:]]+sex|fuck|fucking|bitch|cunt|terrorist[[:space:]]+threat|bomb[[:space:]]+threat|scam[[:space:]]+link)'
$$;

revoke all on function private.is_objectionable_text(text) from public, anon, authenticated;

create or replace function public.post_broadcast(_question text, _options text[])
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  me uuid := auth.uid();
  mylat double precision;
  mylng double precision;
  newid uuid;
  opt text;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if length(trim(coalesce(_question, ''))) < 3 then raise exception 'Question is too short'; end if;
  if coalesce(array_length(_options, 1), 0) < 2 then raise exception 'Add at least two answers'; end if;

  if private.is_objectionable_text(_question) then
    raise exception 'content_not_allowed';
  end if;

  foreach opt in array _options loop
    if private.is_objectionable_text(opt) then
      raise exception 'content_not_allowed';
    end if;
  end loop;

  select l.lat, l.lng into mylat, mylng
  from public.locations l
  where l.user_id = me;

  if mylat is null then raise exception 'We need your location first'; end if;

  insert into public.broadcasts (user_id, question, options, lat, lng)
  values (
    me,
    left(trim(_question), 160),
    (select array_agg(left(trim(x), 40)) from unnest(_options[1:4]) x where trim(x) <> ''),
    mylat,
    mylng
  )
  returning id into newid;

  return newid;
end;
$$;

revoke execute on function public.post_broadcast(text, text[]) from anon, public;
grant execute on function public.post_broadcast(text, text[]) to authenticated;

drop function if exists public.nearby_broadcasts(double precision);

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

  if mylat is null then return; end if;

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
    d.dist,
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
    and not p.banned
    and d.dist <= least(greatest(coalesce(radius_m, 1000), 50), 5000)
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

create or replace function public.delete_my_broadcast(_broadcast_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Not signed in'; end if;

  delete from public.broadcasts
  where id = _broadcast_id
    and user_id = me;

  if not found then raise exception 'Question not found or not yours'; end if;
end;
$$;

revoke execute on function public.delete_my_broadcast(uuid) from anon, public;
grant execute on function public.delete_my_broadcast(uuid) to authenticated;

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
    and b.expires_at > now();

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
end;
$$;

revoke execute on function public.report_broadcast(uuid, text) from anon, public;
grant execute on function public.report_broadcast(uuid, text) to authenticated;

create or replace function public.admin_remove_reported_content(_report_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  kind text;
  cid uuid;
begin
  if not private.is_staff(auth.uid()) then raise exception 'not authorized'; end if;

  select r.content_type, r.content_id
    into kind, cid
  from public.reports r
  where r.id = _report_id;

  if kind = 'broadcast' and cid is not null then
    delete from public.broadcasts where id = cid;
  end if;
end;
$$;

revoke execute on function public.admin_remove_reported_content(uuid) from anon, public;
grant execute on function public.admin_remove_reported_content(uuid) to authenticated;
