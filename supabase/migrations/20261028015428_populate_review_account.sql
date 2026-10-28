-- Persist fixtures in the normal app tables. No sample location is invented.
alter table public.broadcasts add column if not exists review_owner uuid references auth.users(id) on delete cascade;
-- Clients cannot create or relabel fixtures; service-role provisioning owns this field.
create policy "broadcast fixture insert guard" on public.broadcasts as restrictive
for insert to authenticated with check (review_owner is null);
create policy "broadcast fixture update guard" on public.broadcasts as restrictive
for update to authenticated using (review_owner is null) with check (review_owner is null);
create policy "broadcast fixture read guard" on public.broadcasts as restrictive
for select to authenticated using (review_owner is null or review_owner = auth.uid());

create table private.review_activity_sets (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  peer_ids uuid[] not null,
  enabled boolean not null default false
);
alter table private.review_activity_sets enable row level security;
revoke all on private.review_activity_sets from public, anon, authenticated;

-- Protect guessed question IDs as well as the listing RPC. This also covers
-- direct REST writes to broadcast_answers (whose own-row policy is permissive).
create or replace function private.guard_review_answer() returns trigger
language plpgsql security definer set search_path = public, private as $$
begin
  if exists (select 1 from public.broadcasts b where b.id = new.broadcast_id
             and b.review_owner is not null and b.review_owner <> new.user_id
             and not exists (select 1 from private.review_activity_sets s
               where s.owner_id = b.review_owner and new.user_id = any(s.peer_ids))) then
    raise exception 'Question not available';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_review_answer() from public, anon, authenticated;
create trigger guard_review_answer before insert or update on public.broadcast_answers
for each row execute function private.guard_review_answer();

-- This API is service-role-only. The app checks the administrator's fresh role
-- before calling it. All content changes below commit or roll back together.
create or replace function public.manage_review_activity(_owner uuid, _peers uuid[], _enabled boolean)
returns jsonb language plpgsql security invoker set search_path = public, private as $$
declare
  peer uuid; mid uuid; bid uuid; idx integer := 0; n integer;
  old_peers uuid[]; names text[] := array['Alex','Sam','Jordan','Taylor'];
  questions text[] := array[
    'Sample: Which weekend activity would you choose?',
    'Sample: What is your favourite way to meet new people?',
    'Sample: Coffee or tea for a friendly catch-up?',
    'Sample: Which outdoor activity should we try?'];
  lines text[] := array[
    'Hi! This is a sample conversation prepared for app review.',
    'Hello! It is nice to have a conversation ready to explore.',
    'We could organise a coffee meetup this weekend.',
    'That sounds good. A public cafe would be a nice place.',
    'You can send a new message here using the normal chat controls.',
    'Thanks! I will try the questions and chat settings too.'];
begin
  -- Serialize repeat clicks and concurrent provisioning for the same account.
  perform pg_advisory_xact_lock(hashtextextended(_owner::text, 0));
  if not exists (select 1 from public.profiles where id = _owner and username = 'ogyamwilson') then
    raise exception 'Unexpected review account';
  end if;
  select peer_ids into old_peers from private.review_activity_sets where owner_id = _owner;
  if _enabled then
    if cardinality(_peers) <> 4 or (select count(distinct x) from unnest(_peers) x) <> 4 then
      raise exception 'Four distinct sample peers required';
    end if;
    -- Server verifies protected Auth metadata before invoking this service-only API.
    -- Also refuse arbitrary production peers even if a caller has the service key.
    for n in 1..4 loop
      if not exists (select 1 from public.profiles p where p.id = _peers[n]
        and p.username = 'sample_' || lower(names[n]) || '_' || left(_owner::text,6)) then
        raise exception 'Unexpected sample identity';
      end if;
    end loop;
    if old_peers is not null and old_peers <> _peers then raise exception 'Sample account set changed'; end if;
    insert into private.review_activity_sets values (_owner, _peers, true)
    on conflict (owner_id) do update set enabled = true;
    foreach peer in array _peers loop
      idx := idx + 1;
      -- Preserve any reviewer-created messages on refresh. Only explicitly
      -- labelled seed messages get replaced, never real member conversations.
      insert into public.signals (from_user, to_user)
        values (_owner, peer), (peer, _owner) on conflict (from_user, to_user) do nothing;
      update public.signals set expires_at = now() + interval '30 days'
        where (from_user = _owner and to_user = peer) or (from_user = peer and to_user = _owner);
      insert into public.matches (user_a, user_b) values (least(_owner,peer), greatest(_owner,peer))
        on conflict (user_a,user_b) do nothing;
      select id into mid from public.matches where user_a = least(_owner,peer) and user_b = greatest(_owner,peer);
      update public.matches set vanish_hours = 0, vanish_on_leave = false where id = mid;
      -- Refresh only deterministic seed IDs, without overwriting messages sent by reviewers.
      for n in 1..6 loop
        if not exists (select 1 from public.messages where id = md5(_owner::text || peer::text || 'review-message-' || n)::uuid) then
        insert into public.messages (id, match_id, sender_id, content, created_at)
        values (md5(_owner::text || peer::text || 'review-message-' || n)::uuid,
          mid, case when n % 2 = 1 then peer else _owner end,
          lines[n], now() - make_interval(mins => 30 - n))
        on conflict (id) do nothing;
        end if;
        update public.messages set created_at = now() - make_interval(mins => 30 - n)
          where id = md5(_owner::text || peer::text || 'review-message-' || n)::uuid;
      end loop;
      bid := md5(_owner::text || 'review-question-' || idx)::uuid;
      insert into public.broadcasts (id,user_id,question,options,lat,lng,expires_at,review_owner)
      values (bid, case when idx = 4 then _owner else peer end, questions[idx],
        case idx when 1 then array['Coffee','Walk','Board games']
          when 2 then array['A shared hobby','A local event','A friendly chat']
          when 3 then array['Coffee','Tea'] else array['Walking','Cycling','Picnic'] end,
        0,0,now() + interval '30 days',_owner)
      on conflict (id) do update set expires_at = excluded.expires_at;
      for n in 1..3 loop
        insert into public.broadcast_answers (broadcast_id,user_id,option_index)
        values (bid,_peers[n],(n-1) % case when idx=3 then 2 else 3 end)
        on conflict (broadcast_id,user_id) do nothing;
      end loop;
    end loop;
  else
    -- Only data involving our dedicated fixture peers is removed. Their empty
    -- accounts are retained for idempotent re-enabling; never real accounts.
    delete from public.broadcasts where review_owner = _owner;
    delete from public.matches where
      (user_a = _owner and user_b = any(old_peers)) or
      (user_b = _owner and user_a = any(old_peers));
    delete from public.signals where
      (from_user = _owner and to_user = any(old_peers)) or
      (to_user = _owner and from_user = any(old_peers));
    update private.review_activity_sets set enabled = false where owner_id = _owner;
  end if;
  return jsonb_build_object('enabled', _enabled,
    'chats', (select count(*) from public.matches m where
      (m.user_a = _owner and m.user_b = any(_peers)) or
      (m.user_b = _owner and m.user_a = any(_peers))),
    'questions', (select count(*) from public.broadcasts where review_owner = _owner));
end;
$$;
revoke all on function public.manage_review_activity(uuid,uuid[],boolean) from public, anon, authenticated;
grant usage on schema private to service_role;
grant all on private.review_activity_sets to service_role;
grant execute on function public.manage_review_activity(uuid,uuid[],boolean) to service_role;

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
end;
$$;

revoke execute on function public.report_broadcast(uuid, text) from anon, public;
grant execute on function public.report_broadcast(uuid, text) to authenticated;


create or replace function public.signal_broadcast_author(_broadcast_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare me uuid := auth.uid(); author uuid; matched uuid;
begin
  if me is null then raise exception 'Not signed in'; end if;
  select b.user_id into author from public.broadcasts b where b.id = _broadcast_id and b.expires_at > now() and (b.review_owner is null or b.review_owner = me);
  if author is null or author = me then raise exception 'That question is no longer live'; end if;
  if exists (select 1 from public.blocks where (blocker=me and blocked=author) or (blocker=author and blocked=me)) then
    raise exception 'This user is blocked';
  end if;
  insert into public.signals (from_user, to_user, intent, intent_note)
  values (me, author, 'answer', 'has an answer to your question')
  on conflict do nothing;
  select id into matched from public.matches where user_a=least(me,author) and user_b=greatest(me,author);
  return matched;
end;
$$;
revoke execute on function public.signal_broadcast_author(uuid) from anon, public;
grant execute on function public.signal_broadcast_author(uuid) to authenticated;
