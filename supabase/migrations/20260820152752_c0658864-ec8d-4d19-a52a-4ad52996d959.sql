create or replace function public.admin_stats()
returns table(people bigint, online bigint, verified bigint, signals bigint, matches bigint, messages bigint, reports bigint, blocks bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff(auth.uid()) then raise exception 'not authorized'; end if;
  return query select
    (select count(*) from public.profiles p),
    (select count(*) from public.locations l where l.updated_at > now() - interval '5 minutes' and l.is_visible),
    (select count(*) from public.profiles p2 where p2.verified),
    (select count(*) from public.signals s),
    (select count(*) from public.matches m),
    (select count(*) from public.messages ms),
    (select count(*) from public.reports r),
    (select count(*) from public.blocks b);
end;
$$;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated, service_role;

-- Maintenance: purge empty matches with no messages older than N days
create or replace function public.admin_purge_empty_matches(_days integer default 3)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  if not public.is_staff(auth.uid()) then raise exception 'not authorized'; end if;
  with del as (
    delete from public.matches m
    where m.created_at < now() - make_interval(days => greatest(_days, 0))
      and not exists (select 1 from public.messages ms where ms.match_id = m.id)
    returning 1
  ) select count(*) into n from del;
  return n;
end;
$$;
revoke all on function public.admin_purge_empty_matches(integer) from public, anon;
grant execute on function public.admin_purge_empty_matches(integer) to authenticated, service_role;

-- Maintenance: purge old notifications (and their read receipts cascade)
create or replace function public.admin_purge_old_notifications(_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  if not public.is_staff(auth.uid()) then raise exception 'not authorized'; end if;
  delete from public.notification_reads nr
  using public.notifications nt
  where nr.notification_id = nt.id and nt.created_at < now() - make_interval(days => greatest(_days, 0));
  with del as (
    delete from public.notifications nt
    where nt.created_at < now() - make_interval(days => greatest(_days, 0))
    returning 1
  ) select count(*) into n from del;
  return n;
end;
$$;
revoke all on function public.admin_purge_old_notifications(integer) from public, anon;
grant execute on function public.admin_purge_old_notifications(integer) to authenticated, service_role;

-- Maintenance: purge old reports
create or replace function public.admin_purge_old_reports(_days integer default 90)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  if not public.is_staff(auth.uid()) then raise exception 'not authorized'; end if;
  with del as (
    delete from public.reports r where r.created_at < now() - make_interval(days => greatest(_days, 0))
    returning 1
  ) select count(*) into n from del;
  return n;
end;
$$;
revoke all on function public.admin_purge_old_reports(integer) from public, anon;
grant execute on function public.admin_purge_old_reports(integer) to authenticated, service_role;

-- Maintenance snapshot: how much cleanable junk exists right now
create or replace function public.admin_maintenance_overview()
returns table(expired_signals bigint, stale_locations bigint, empty_matches bigint, old_notifications bigint, old_reports bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff(auth.uid()) then raise exception 'not authorized'; end if;
  return query select
    (select count(*) from public.signals s where s.expires_at is not null and s.expires_at < now()),
    (select count(*) from public.locations l where l.updated_at < now() - interval '24 hours'),
    (select count(*) from public.matches m where m.created_at < now() - interval '3 days' and not exists (select 1 from public.messages ms where ms.match_id = m.id)),
    (select count(*) from public.notifications nt where nt.created_at < now() - interval '30 days'),
    (select count(*) from public.reports r where r.created_at < now() - interval '90 days');
end;
$$;
revoke all on function public.admin_maintenance_overview() from public, anon;
grant execute on function public.admin_maintenance_overview() to authenticated, service_role;